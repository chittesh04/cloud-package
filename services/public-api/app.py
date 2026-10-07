import os
import socket
import time
import threading
import uuid
from collections import Counter, deque
import statistics
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
import psycopg
import requests
from flask import Flask, g, jsonify, request
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
DB_URL = os.environ["DATABASE_URL"]
JWT_SECRET = os.environ["JWT_SECRET"]
INTERNAL_SECRET = os.environ["INTERNAL_SERVICE_SECRET"]
PRIVATE_API_URL = os.environ["PRIVATE_API_URL"].rstrip("/")
SERVICE_ID = socket.gethostname()
METRICS = Counter()
STARTED = time.time()
LATENCIES = deque(maxlen=1000)

POOL = ConnectionPool(DB_URL, min_size=2, max_size=10, kwargs={"row_factory": dict_row})

def db():
    return POOL.connection()


def seed_demo_users():
    demo = [
        ("Demo Student", "student@college.edu", "Student@123", "Computer Applications", 3, "student"),
        ("Demo Administrator", "admin@college.edu", "Admin@123", "Administration", 1, "admin"),
    ]
    with db() as conn:
        for name, email, password, department, year, role in demo:
            conn.execute(
                """INSERT INTO students (full_name,email,password_hash,department,study_year,role)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash""",
                (name, email, generate_password_hash(password), department, year, role),
            )


def token_for(user):
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user["id"]), "email": user["email"], "role": user["role"], "iat": now, "exp": now + timedelta(hours=2)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_auth(admin=False):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify(error="Missing bearer token"), 401
            try:
                g.user = jwt.decode(header[7:], JWT_SECRET, algorithms=["HS256"])
            except jwt.PyJWTError:
                return jsonify(error="Invalid or expired token"), 401
            if admin and g.user["role"] != "admin":
                return jsonify(error="Administrator access is required"), 403
            return fn(*args, **kwargs)
        return wrapped
    return decorator


@app.before_request
def track_request():
    g.start_time = time.perf_counter()
    g.request_id = request.headers.get("X-Request-ID", f"HC-{uuid.uuid4().hex[:8].upper()}")
    if request.path != "/health":
        METRICS["requests"] += 1


@app.after_request
def response_headers(response):
    response.headers["X-Public-Service"] = SERVICE_ID
    response.headers["X-Request-ID"] = getattr(g, "request_id", "UNKNOWN")
    if request.path != "/health" and hasattr(g, 'start_time'):
        latency = (time.perf_counter() - g.start_time) * 1000
        LATENCIES.append(latency)
        if response.status_code >= 400:
            METRICS["errors"] += 1
    return response


@app.get("/health")
def health():
    try:
        with db() as conn:
            conn.execute("SELECT 1")
        return jsonify(status="healthy", service="public-api", instance=SERVICE_ID)
    except Exception as exc:
        return jsonify(status="unhealthy", detail=str(exc)), 503


@app.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    email, password = body.get("email", "").strip().lower(), body.get("password", "")
    with db() as conn:
        user = conn.execute("SELECT * FROM students WHERE email=%s", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(error="Incorrect email or password"), 401
    METRICS["logins"] += 1
    return jsonify(token=token_for(user), user={k: user[k] for k in ("id", "full_name", "email", "department", "study_year", "role")})


@app.post("/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    fields = ["full_name", "email", "password", "department", "study_year"]
    if any(not body.get(key) for key in fields):
        return jsonify(error="full_name, email, password, department and study_year are required"), 400
    try:
        with db() as conn:
            user = conn.execute(
                """INSERT INTO students (full_name,email,password_hash,department,study_year)
                VALUES (%s,%s,%s,%s,%s) RETURNING *""",
                (body["full_name"].strip(), body["email"].strip().lower(), generate_password_hash(body["password"]), body["department"].strip(), int(body["study_year"])),
            ).fetchone()
        return jsonify(token=token_for(user), user={k: user[k] for k in ("id", "full_name", "email", "department", "study_year", "role")}), 201
    except (psycopg.Error, ValueError):
        return jsonify(error="Could not create account; the email may already be used"), 400


@app.get("/courses")
@require_auth()
def courses():
    with db() as conn:
        rows = conn.execute("SELECT * FROM courses ORDER BY code").fetchall()
    return jsonify(rows)


@app.get("/materials")
@require_auth()
def materials():
    with db() as conn:
        rows = conn.execute("SELECT * FROM materials ORDER BY published_at DESC").fetchall()
    return jsonify(rows)


@app.post("/admissions")
def admission():
    body = request.get_json(silent=True) or {}
    required = ["applicant_name", "email", "programme", "prior_qualification"]
    if any(not body.get(k) for k in required):
        return jsonify(error="All admission fields are required"), 400
    with db() as conn:
        row = conn.execute(
            """INSERT INTO admissions (applicant_name,email,programme,prior_qualification)
            VALUES (%s,%s,%s,%s) RETURNING id,status,submitted_at""",
            tuple(body[k].strip() for k in required),
        ).fetchone()
    METRICS["admissions"] += 1
    return jsonify(message="Admission application submitted", application=row), 201


@app.post("/registrations")
@require_auth()
def register_course():
    body = request.get_json(silent=True) or {}
    if not body.get("course_id") or not body.get("semester"):
        return jsonify(error="course_id and semester are required"), 400
    try:
        with db() as conn:
            row = conn.execute(
                """INSERT INTO registrations (student_id,course_id,semester) VALUES (%s,%s,%s)
                RETURNING id,course_id,semester,registered_at""",
                (int(g.user["sub"]), int(body["course_id"]), body["semester"].strip()),
            ).fetchone()
        METRICS["registrations"] += 1
        return jsonify(message="Course registration confirmed", registration=row), 201
    except psycopg.Error:
        return jsonify(error="This course is already registered for the selected semester, or does not exist"), 409


def private_request(resource):
    internal = jwt.encode({"purpose": "hybrid-service", "subject_id": g.user["sub"], "role": g.user["role"], "exp": datetime.now(timezone.utc) + timedelta(seconds=60)}, INTERNAL_SECRET, algorithm="HS256")
    try:
        METRICS["private_calls"] += 1
        response = requests.get(f"{PRIVATE_API_URL}/{resource}/{g.user['sub']}", headers={"X-Hybrid-Service-Token": internal, "X-Request-ID": g.request_id}, timeout=5)
        data = response.json()
        if isinstance(data, dict):
            data["_trace"] = {
                "request_id": g.request_id,
                "private_service": response.headers.get("X-Private-Service", "unknown")
            }
        return jsonify(data), response.status_code
    except requests.RequestException:
        METRICS["private_failures"] += 1
        return jsonify(error="Private-cloud service is currently unavailable", request_id=g.request_id), 503


@app.get("/academics")
@require_auth()
def academics():
    return private_request("academics")


@app.get("/finance")
@require_auth()
def finance():
    return private_request("finance")


@app.get("/admin/metrics")
@require_auth(admin=True)
def metrics():
    with db() as conn:
        public_counts = {
            "students": conn.execute("SELECT COUNT(*) AS count FROM students").fetchone()["count"],
            "admissions": conn.execute("SELECT COUNT(*) AS count FROM admissions").fetchone()["count"],
            "registrations": conn.execute("SELECT COUNT(*) AS count FROM registrations").fetchone()["count"],
        }

    try:
        r = requests.get(f"{PRIVATE_API_URL}/health", timeout=1)
        private_status = "HEALTHY" if r.status_code == 200 else "DEGRADED"
        hybrid_status = "HEALTHY"
    except Exception:
        private_status = "UNREACHABLE"
        hybrid_status = "FAILED"

    lats = list(LATENCIES)
    avg_latency = statistics.mean(lats) if lats else 0
    p95_latency = sorted(lats)[int(len(lats)*0.95)] if lats else 0
    
    try:
        _, _, ips = socket.gethostbyname_ex("public-api")
        current_replicas = len(ips)
    except Exception:
        ips = [SERVICE_ID]
        current_replicas = 1

    uptime = time.time() - STARTED
    req_sec = METRICS["requests"] / uptime if uptime > 0 else 0
    error_rate = (METRICS["errors"] / METRICS["requests"] * 100) if METRICS["requests"] > 0 else 0

    return jsonify({
        "system": {
            "publicCloud": "HEALTHY",
            "privateCloud": private_status,
            "hybridLink": hybrid_status,
            "database": "HEALTHY"
        },
        "traffic": {
            "requestsPerSec": round(req_sec, 1),
            "avgLatencyMs": int(avg_latency),
            "p95LatencyMs": int(p95_latency),
            "errorRatePct": round(error_rate, 2),
            "totalRequests": METRICS["requests"]
        },
        "capacity": {
            "currentReplicas": current_replicas,
            "minReplicas": int(os.getenv("MIN_REPLICAS", "1")),
            "maxReplicas": int(os.getenv("MAX_REPLICAS", "3")),
            "scalingState": "BURST MODE" if current_replicas > 1 else "NORMAL"
        },
        "services": [f"public-api-{i+1} ({ip})" for i, ip in enumerate(ips)] + ["private-api", "public-db", "private-db"],
        "hybrid": {
            "totalRequests": METRICS["private_calls"],
            "successful": METRICS["private_calls"] - METRICS["private_failures"],
            "failed": METRICS["private_failures"]
        }
    })


@app.post("/admin/chaos/private")
@require_auth(admin=True)
def chaos_private():
    body = request.get_json(silent=True) or {}
    try:
        r = requests.post(f"{PRIVATE_API_URL}/admin/chaos", json={"active": body.get("active", False)}, timeout=2)
        return jsonify(message="Private cloud chaos updated")
    except:
        return jsonify(error="Failed to reach private cloud"), 503


def cpu_burner():
    end = time.time() + 30
    while time.time() < end:
        _ = [x**2 for x in range(10000)]

@app.post("/admin/chaos/public-cpu")
@require_auth(admin=True)
def chaos_public():
    threading.Thread(target=cpu_burner).start()
    return jsonify(message="Burning CPU for 30 seconds... Watch the autoscaler!")


if __name__ == "__main__":
    seed_demo_users()
    app.run(host="0.0.0.0", port=5000)
else:
    # Gunicorn imports this module; seed once per worker safely via PostgreSQL UPSERT.
    seed_demo_users()
