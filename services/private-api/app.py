import os
import socket
import time
from functools import wraps

import jwt
import psycopg
from flask import Flask, g, jsonify, request
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

app = Flask(__name__)
DB_URL = os.environ["DATABASE_URL"]
INTERNAL_SECRET = os.environ["INTERNAL_SERVICE_SECRET"]
SERVICE_ID = socket.gethostname()
CHAOS_ACTIVE = False

POOL = ConnectionPool(DB_URL, min_size=2, max_size=10, kwargs={"row_factory": dict_row})

@app.before_request
def trace_request():
    g.request_id = request.headers.get("X-Request-ID", "UNKNOWN")
    if CHAOS_ACTIVE and request.path != "/admin/chaos":
        time.sleep(2)
        return jsonify(error="Simulated private cloud hardware failure"), 503

@app.after_request
def response_headers(response):
    response.headers["X-Private-Service"] = SERVICE_ID
    response.headers["X-Request-ID"] = getattr(g, "request_id", "UNKNOWN")
    return response

@app.post("/admin/chaos")
def toggle_chaos():
    global CHAOS_ACTIVE
    body = request.get_json(silent=True) or {}
    CHAOS_ACTIVE = body.get("active", False)
    return jsonify(chaos=CHAOS_ACTIVE)


def db():
    return POOL.connection()


def hybrid_only(fn):
    @wraps(fn)
    def wrapped(student_id):
        token = request.headers.get("X-Hybrid-Service-Token", "")
        try:
            g.context = jwt.decode(token, INTERNAL_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify(error="Private API accepts requests only from the authenticated hybrid gateway"), 401
        if g.context.get("purpose") != "hybrid-service":
            return jsonify(error="Invalid hybrid service purpose"), 403
        if g.context.get("role") != "admin" and str(student_id) != str(g.context.get("subject_id")):
            return jsonify(error="You may access only your own private records"), 403
        return fn(student_id)
    return wrapped


@app.get("/health")
def health():
    try:
        with db() as conn:
            conn.execute("SELECT 1")
        return jsonify(status="healthy", service="private-api", instance=SERVICE_ID)
    except Exception as exc:
        return jsonify(status="unhealthy", detail=str(exc)), 503


@app.get("/academics/<int:student_id>")
@hybrid_only
def academics(student_id):
    with db() as conn:
        records = conn.execute("SELECT course_code,course_title,semester,marks,grade,updated_at FROM academic_records WHERE student_id=%s ORDER BY semester,course_code", (student_id,)).fetchall()
    return jsonify(classification="private-cloud academic records", records=records)


@app.get("/finance/<int:student_id>")
@hybrid_only
def finance(student_id):
    with db() as conn:
        records = conn.execute("SELECT description,amount,transaction_type,payment_status,transaction_date FROM financial_records WHERE student_id=%s ORDER BY transaction_date DESC", (student_id,)).fetchall()
    return jsonify(classification="private-cloud financial records", records=records)
