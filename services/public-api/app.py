import os
import socket
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
import psycopg
import requests
from flask import Flask, g, jsonify, request
from psycopg.rows import dict_row
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
DB_URL = os.environ["DATABASE_URL"]
JWT_SECRET = os.environ["JWT_SECRET"]
INTERNAL_SECRET = os.environ["INTERNAL_SERVICE_SECRET"]
PRIVATE_API_URL = os.environ["PRIVATE_API_URL"].rstrip("/")
SERVICE_ID = socket.gethostname()
METRICS = Counter()
STARTED = time.time()


def db():
    return psycopg.connect(DB_URL, row_factory=dict_row)


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
    if request.path != "/health":
        METRICS["requests"] += 1


@app.after_request
def response_headers(response):
    response.headers["X-Public-Service"] = SERVICE_ID
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
        response = requests.get(f"{PRIVATE_API_URL}/{resource}/{g.user['sub']}", headers={"X-Hybrid-Service-Token": internal}, timeout=5)
        return jsonify(response.json()), response.status_code
    except requests.RequestException:
        METRICS["private_failures"] += 1
        return jsonify(error="Private-cloud service is currently unavailable"), 503


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
    return jsonify({
        "instance": SERVICE_ID,
        "uptimeSeconds": int(time.time() - STARTED),
        "configuredPublicReplicas": int(os.getenv("PUBLIC_REPLICAS", "1")),
        "publicCloud": {**public_counts, "requestsThisInstance": METRICS["requests"], "errorsThisInstance": METRICS["errors"], "loginsThisInstance": METRICS["logins"]},
        "hybridConnection": {"status": "healthy", "privateCallsThisInstance": METRICS["private_calls"], "failedCallsThisInstance": METRICS["private_failures"], "transport": "internal Docker hybrid_net + short-lived service JWT"},
        "privateCloud": {"status": "reachable through gateway only", "database": "private-db is on internal private_net"},
    })


if __name__ == "__main__":
    seed_demo_users()
    app.run(host="0.0.0.0", port=5000)
else:
    # Gunicorn imports this module; seed once per worker safely via PostgreSQL UPSERT.
    seed_demo_users()
