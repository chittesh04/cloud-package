import os
import socket
from functools import wraps

import jwt
import psycopg
from flask import Flask, g, jsonify, request
from psycopg.rows import dict_row

app = Flask(__name__)
DB_URL = os.environ["DATABASE_URL"]
INTERNAL_SECRET = os.environ["INTERNAL_SERVICE_SECRET"]
SERVICE_ID = socket.gethostname()


def db():
    return psycopg.connect(DB_URL, row_factory=dict_row)


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
