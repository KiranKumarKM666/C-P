import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app import seed  # noqa: E402
from app.main import app  # noqa: E402
from app.services.analytics import attendance_pct, classify  # noqa: E402

seed.main()
client = TestClient(app)


def login(email, pw):
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_classify_edges():
    assert classify(74.99) == "Critical"
    assert classify(75) == "Advisory"
    assert classify(85) == "Advisory"
    assert classify(85.01) == "Safe"
    assert classify(attendance_pct(0, 0)) == "No Data"
    assert attendance_pct(42, 50) == 84.0


def test_bad_login():
    assert client.post("/api/auth/login", json={"email": "x@y.z", "password": "no"}).status_code == 401


def test_spa_dashboard_refresh_and_api_separation():
    dashboard_page = client.get("/dashboard", headers={"Accept": "text/html"})
    assert dashboard_page.status_code == 200
    assert "text/html" in dashboard_page.headers["content-type"]
    assert b"FacultyFlow" in dashboard_page.content

    unauthenticated_api = client.get("/api/dashboard")
    assert unauthenticated_api.status_code == 401
    assert unauthenticated_api.json() == {"detail": "Not logged in"}


def test_access_control():
    meera, ravi = login("meera@college.edu", "faculty123"), login("ravi@college.edu", "faculty123")
    courses = client.get("/api/courses", headers=meera).json()
    cid = courses[0]["course_id"]
    assert client.get(f"/api/courses/{cid}/students", headers=meera).status_code == 200
    assert client.get(f"/api/courses/{cid}/students", headers=ravi).status_code == 403
    assert client.get("/api/courses").status_code == 401
    stu = login("asha@college.edu", "student123")
    assert client.get("/api/courses", headers=stu).status_code == 403
    assert client.post("/api/users", headers=meera, json={}).status_code == 403


def test_marks_validation():
    h = login("meera@college.edu", "faculty123")
    cid = client.get("/api/courses", headers=h).json()[0]["course_id"]
    sid = client.get(f"/api/courses/{cid}/students", headers=h).json()[0]["student_id"]
    base = {"course_id": cid, "assessment_name": "T", "max_marks": 25}
    for bad in (-5, 26):
        r = client.post("/api/marks", headers=h, json={**base, "records": [{"student_id": sid, "marks_obtained": bad}]})
        assert r.status_code == 422
    r = client.post("/api/marks", headers=h, json={**base, "records": [{"student_id": sid, "marks_obtained": "abc"}]})
    assert r.status_code == 422
    r = client.post("/api/marks", headers=h, json={**base, "records": [{"student_id": sid, "absent": True}]})
    assert r.status_code == 200


def test_attendance_validation_and_future_date():
    h = login("meera@college.edu", "faculty123")
    cid = client.get("/api/courses", headers=h).json()[0]["course_id"]
    sid = client.get(f"/api/courses/{cid}/students", headers=h).json()[0]["student_id"]
    r = client.post("/api/attendance", headers=h, json={"course_id": cid, "date": "2999-01-01",
                    "records": [{"student_id": sid, "status": "Present"}]})
    assert r.status_code == 422
    r = client.post("/api/attendance", headers=h, json={"course_id": cid, "date": "2026-01-05",
                    "records": [{"student_id": sid, "status": "Maybe"}]})
    assert r.status_code == 422


def test_same_usn_can_be_enrolled_in_different_courses():
    hod = login("hod@college.edu", "admin123")
    users = client.get("/api/users", headers=hod).json()
    ravi = next(u for u in users if u["email"] == "ravi@college.edu")
    course = client.post("/api/courses", headers=hod, json={
        "course_name": "Cross Course Test",
        "course_code": "CCT999",
        "semester": 2,
        "faculty_id": ravi["user_id"],
    })
    assert course.status_code == 201
    cid = course.json()["course_id"]

    # The seed roster already contains this USN in its original course.
    r = client.post(f"/api/courses/{cid}/students", headers=hod, json={
        "usn": "1XX23CS001",
        "name": "Asha Rao",
        "email": "asha@college.edu",
    })
    assert r.status_code == 201


def test_deficits_upload_ai_reports():
    h = login("meera@college.edu", "faculty123")
    cid = client.get("/api/courses", headers=h).json()[0]["course_id"]
    d = client.get(f"/api/courses/{cid}/deficits", headers=h).json()
    assert d and all(x["reasons"] for x in d)
    assert d[0]["priority"] in ("High", "Medium")

    csv = b"usn,date,status\n1XX23CS001,2026-01-05,Present\nNOPE,2026-01-05,Present\n1XX23CS001,2026-01-05,Absent\n"
    r = client.post(f"/api/attendance/upload?course_id={cid}", headers=h, files={"file": ("a.csv", csv)})
    assert r.status_code == 200 and r.json()["imported"] == 1 and len(r.json()["errors"]) == 2
    r = client.post(f"/api/attendance/upload?course_id={cid}", headers=h, files={"file": ("a.txt", b"x")})
    assert r.status_code == 400

    sid = d[0]["student_id"]
    r = client.post("/api/advisories/draft", headers=h, json={"student_id": sid, "course_id": cid, "issue_type": "attendance"})
    assert r.status_code == 201
    aid = r.json()["advisory_id"]
    assert client.get(f"/api/courses/{cid}/advisories", headers=h).json() == []  # not approved yet
    assert client.post(f"/api/advisories/{aid}/approve", headers=h, json={"final_message": "Edited note"}).status_code == 200
    assert len(client.get(f"/api/courses/{cid}/advisories", headers=h).json()) == 1

    for kind in ("attendance", "cie", "deficit"):
        for fmt in ("pdf", "xlsx"):
            r = client.get(f"/api/reports/{kind}?course_id={cid}&format={fmt}", headers=h)
            assert r.status_code == 200 and len(r.content) > 500
