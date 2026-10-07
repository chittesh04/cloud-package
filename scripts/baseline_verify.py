"""Phase 0 - Automated baseline verification for Hybrid Cloud College Application.

Run this AFTER `docker compose up --build` with all containers healthy.

Usage:
    python scripts/baseline_verify.py [--base-url http://localhost:8080]

It exercises every API endpoint and prints a pass/fail summary.
"""
import argparse
import io
import os
import sys

# Force UTF-8 output on Windows to avoid cp1252 encoding errors
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import json
import time
import uuid

import requests


class VerificationRunner:
    """Runs numbered checks and records pass/fail."""

    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.results: list[tuple[str, str, bool, str]] = []
        self._student_token: str | None = None
        self._admin_token: str | None = None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _check(self, step: str, name: str, passed: bool, detail: str = ""):
        self.results.append((step, name, passed, detail))
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {step} — {name}" + (f"  ({detail})" if detail else ""))

    def _get(self, path: str, headers: dict | None = None, **kw) -> requests.Response:
        return requests.get(f"{self.base}/api/{path}", headers=headers, timeout=15, **kw)

    def _post(self, path: str, body: dict, headers: dict | None = None) -> requests.Response:
        return requests.post(f"{self.base}/api/{path}", json=body, headers=headers, timeout=15)

    def _auth_headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    # ------------------------------------------------------------------
    # Test groups
    # ------------------------------------------------------------------

    def check_health(self):
        print("\n── Step 1: Docker / Health ──")
        try:
            r = self._get("../health", allow_redirects=False)
        except requests.ConnectionError:
            # Nginx doesn't have /health at root; try the API health
            pass

        # Public API health through Nginx
        try:
            r = requests.get(f"{self.base}/api/health", timeout=10)
            ok = r.status_code == 200 and r.json().get("status") == "healthy"
            self._check("1.1", "Public API health endpoint reachable", ok, f"status={r.status_code}")
        except Exception as exc:
            self._check("1.1", "Public API health endpoint reachable", False, str(exc))

        # Frontend reachable
        try:
            r = requests.get(self.base, timeout=10)
            ok = r.status_code == 200 and "PSG" in r.text
            self._check("1.2", "Frontend loads at /", ok, f"status={r.status_code}")
        except Exception as exc:
            self._check("1.2", "Frontend loads at /", False, str(exc))

    def check_login(self):
        print("\n── Step 2: Login ──")

        # Student login
        r = self._post("auth/login", {"email": "student@college.edu", "password": "Student@123"})
        ok = r.status_code == 200 and "token" in r.json()
        self._check("2.1", "Student login succeeds", ok, f"status={r.status_code}")
        if ok:
            data = r.json()
            self._student_token = data["token"]
            self._check("2.2", "Student role = 'student'", data["user"]["role"] == "student", data["user"]["role"])

        # Admin login
        r = self._post("auth/login", {"email": "admin@college.edu", "password": "Admin@123"})
        ok = r.status_code == 200 and "token" in r.json()
        self._check("2.3", "Admin login succeeds", ok, f"status={r.status_code}")
        if ok:
            data = r.json()
            self._admin_token = data["token"]
            self._check("2.4", "Admin role = 'admin'", data["user"]["role"] == "admin", data["user"]["role"])

        # Bad credentials
        r = self._post("auth/login", {"email": "student@college.edu", "password": "wrong"})
        self._check("2.5", "Bad password rejected (401)", r.status_code == 401, f"status={r.status_code}")

    def check_admission(self):
        print("\n── Step 3: Admission ──")
        unique_email = f"verify-{uuid.uuid4().hex[:8]}@test.edu"
        r = self._post("admissions", {
            "applicant_name": "Baseline Verify",
            "email": unique_email,
            "programme": "MCA",
            "prior_qualification": "BCA",
        })
        ok = r.status_code == 201
        self._check("3.1", "Admission form accepted (201)", ok, f"status={r.status_code}")
        if ok:
            data = r.json()
            self._check("3.2", "Returns application ID", "application" in data and "id" in data["application"], "")

        # Missing fields
        r = self._post("admissions", {"applicant_name": "Incomplete"})
        self._check("3.3", "Incomplete admission rejected (400)", r.status_code == 400, f"status={r.status_code}")

    def check_courses(self):
        print("\n── Step 4: Course Registration ──")
        if not self._student_token:
            self._check("4.1", "Courses list (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._student_token)

        r = self._get("courses", headers=h)
        ok = r.status_code == 200
        courses = r.json() if ok else []
        self._check("4.1", "Courses list loads", ok and len(courses) >= 3, f"{len(courses)} courses")

        # Register for a course — may fail on duplicate if script run twice
        r = self._post("registrations", {"course_id": 1, "semester": "Semester 5"}, headers=h)
        ok = r.status_code in (201, 409)
        self._check("4.2", "Course registration accepted or duplicate caught", ok, f"status={r.status_code}")

    def check_elearning(self):
        print("\n── Step 5: E-learning ──")
        if not self._student_token:
            self._check("5.1", "Materials list (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._student_token)

        r = self._get("materials", headers=h)
        ok = r.status_code == 200
        materials = r.json() if ok else []
        self._check("5.1", "Materials list loads", ok and len(materials) >= 3, f"{len(materials)} materials")
        if materials:
            has_url = all("resource_url" in m for m in materials)
            self._check("5.2", "Each material has resource_url", has_url, "")

    def check_academics(self):
        print("\n── Step 6: Academic Records (hybrid) ──")
        if not self._student_token:
            self._check("6.1", "Academics (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._student_token)

        r = self._get("academics", headers=h)
        ok = r.status_code == 200
        self._check("6.1", "Academic records endpoint responds", ok, f"status={r.status_code}")
        if ok:
            data = r.json()
            self._check("6.2", "Classification = private-cloud", data.get("classification") == "private-cloud academic records", "")
            records = data.get("records", [])
            self._check("6.3", "Returns 3 academic records", len(records) == 3, f"{len(records)} records")

    def check_finance(self):
        print("\n── Step 7: Financial Records (hybrid) ──")
        if not self._student_token:
            self._check("7.1", "Finance (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._student_token)

        r = self._get("finance", headers=h)
        ok = r.status_code == 200
        self._check("7.1", "Financial records endpoint responds", ok, f"status={r.status_code}")
        if ok:
            data = r.json()
            self._check("7.2", "Classification = private-cloud", data.get("classification") == "private-cloud financial records", "")
            records = data.get("records", [])
            self._check("7.3", "Returns 3 financial records", len(records) == 3, f"{len(records)} records")

    def check_admin_metrics(self):
        print("\n── Step 8: Admin Dashboard / Metrics ──")
        if not self._admin_token:
            self._check("8.1", "Admin metrics (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._admin_token)

        r = self._get("admin/metrics", headers=h)
        ok = r.status_code == 200
        self._check("8.1", "Admin metrics endpoint responds", ok, f"status={r.status_code}")
        if ok:
            m = r.json()
            self._check("8.2", "Has instance field", "instance" in m, m.get("instance", ""))
            self._check("8.3", "Has uptimeSeconds", "uptimeSeconds" in m, str(m.get("uptimeSeconds", "")))
            self._check("8.4", "Has publicCloud stats", "publicCloud" in m, "")
            self._check("8.5", "Has hybridConnection", "hybridConnection" in m, m.get("hybridConnection", {}).get("status", ""))
            self._check("8.6", "Has privateCloud", "privateCloud" in m, "")

        # Student should be forbidden
        if self._student_token:
            r2 = self._get("admin/metrics", headers=self._auth_headers(self._student_token))
            self._check("8.7", "Student forbidden from admin metrics (403)", r2.status_code == 403, f"status={r2.status_code}")

    def check_service_header(self):
        print("\n── Step 9: Load Balancing / Service Header ──")
        if not self._student_token:
            self._check("9.1", "Service header (skipped — no token)", False, "login failed")
            return
        h = self._auth_headers(self._student_token)

        r = self._get("materials", headers=h)
        service_id = r.headers.get("X-Public-Service", "")
        self._check("9.1", "X-Public-Service header present", bool(service_id), service_id)

    def check_auth_protection(self):
        print("\n── Step 10: Auth Protection ──")
        # No token → 401
        r = self._get("courses")
        self._check("10.1", "Courses without token → 401", r.status_code == 401, f"status={r.status_code}")

        r = self._get("materials")
        self._check("10.2", "Materials without token → 401", r.status_code == 401, f"status={r.status_code}")

        r = self._get("academics")
        self._check("10.3", "Academics without token → 401", r.status_code == 401, f"status={r.status_code}")

        r = self._get("finance")
        self._check("10.4", "Finance without token → 401", r.status_code == 401, f"status={r.status_code}")

        r = self._get("admin/metrics")
        self._check("10.5", "Admin metrics without token → 401", r.status_code == 401, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # Runner
    # ------------------------------------------------------------------

    def run_all(self):
        print("=" * 60)
        print("  PHASE 0 — BASELINE VERIFICATION")
        print(f"  Target: {self.base}")
        print("=" * 60)

        self.check_health()
        self.check_login()
        self.check_admission()
        self.check_courses()
        self.check_elearning()
        self.check_academics()
        self.check_finance()
        self.check_admin_metrics()
        self.check_service_header()
        self.check_auth_protection()

        # Summary
        passed = sum(1 for _, _, ok, _ in self.results if ok)
        failed = sum(1 for _, _, ok, _ in self.results if not ok)
        total = len(self.results)

        print("\n" + "=" * 60)
        print(f"  SUMMARY: {passed}/{total} passed, {failed} failed")
        print("=" * 60)

        if failed:
            print("\n  FAILURES:")
            for step, name, ok, detail in self.results:
                if not ok:
                    print(f"    ✗ {step} — {name}" + (f"  ({detail})" if detail else ""))
            print()
            print("  ⚠  FIX THE FAILURES BEFORE PROCEEDING TO PHASE 1")
        else:
            print("\n  ✅ ALL CHECKS PASSED — safe to freeze baseline")
            print()
            print("  Run:")
            print("    git add .")
            print('    git commit -m "baseline working hybrid cloud project"')
            print()

        return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Phase 0 baseline verification")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Nginx gateway URL")
    args = parser.parse_args()

    runner = VerificationRunner(args.base_url)
    success = runner.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
