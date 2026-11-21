"""Fill the database with DUMMY data for development. Run: python -m app.seed"""
import datetime as dt
import os
import random

from .auth import hash_password
from .database import Base, SessionLocal, engine
from .models import Attendance, Course, Mark, Student, User

NAMES = ["Asha Rao", "Bharat Kumar", "Chitra Nair", "Deepak Shetty", "Esha Patil",
         "Farhan Khan", "Gita Hegde", "Harsh Verma", "Isha Menon", "Jayant Gowda",
         "Kavya Reddy", "Lokesh Naik"]


def main():
    if os.getenv("SEED_DEMO_DATA", "").strip().lower() not in ("1", "true", "yes"):
        raise RuntimeError("Demo seeding is disabled. Set SEED_DEMO_DATA=true only in an isolated development database.")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    random.seed(7)
    admin = User(name="Dr. HOD", email="hod@college.edu", role="admin",
                 password_hash=hash_password("admin123"))
    fac = User(name="Prof. Meera", email="meera@college.edu", role="faculty",
               password_hash=hash_password("faculty123"))
    fac2 = User(name="Prof. Ravi", email="ravi@college.edu", role="faculty",
                password_hash=hash_password("faculty123"))
    stu = User(name="Asha Rao", email="asha@college.edu", role="student",
               password_hash=hash_password("student123"))
    db.add_all([admin, fac, fac2, stu])
    db.flush()
    c1 = Course(course_name="Data Structures", course_code="CS301", semester=3, faculty_id=fac.user_id)
    c2 = Course(course_name="Database Systems", course_code="CS302", semester=3, faculty_id=fac2.user_id)
    db.add_all([c1, c2])
    db.flush()

    # Attendance habits: first students good, some borderline, some poor
    habits = [0.95, 0.9, 0.8, 0.6, 0.97, 0.7, 0.88, 0.5, 0.92, 0.82, 0.99, 0.65]
    score_level = [0.8, 0.75, 0.6, 0.3, 0.9, 0.35, 0.7, 0.25, 0.85, 0.55, 0.95, 0.45]
    days = []
    d = dt.date.today()
    while len(days) < 20:
        d -= dt.timedelta(days=1)
        if d.weekday() < 5:
            days.append(d)
    for i, nm in enumerate(NAMES):
        s = Student(usn=f"1XX23CS{i + 1:03d}", name=nm, course_id=c1.course_id,
                    email="asha@college.edu" if i == 0 else f"{nm.split()[0].lower()}@college.edu")
        db.add(s)
        db.flush()
        for day in days:
            db.add(Attendance(student_id=s.student_id, course_id=c1.course_id, date=day,
                              status="Present" if random.random() < habits[i] else "Absent"))
        for j, (an, mx) in enumerate([("Quiz 1", 10), ("Internal Test 1", 25), ("Assignment 1", 10)]):
            lvl = score_level[i]
            if i == 6 and j == 2:  # sudden drop example
                lvl = 0.2
            obtained = round(min(mx, max(0, mx * (lvl + random.uniform(-0.1, 0.1)))), 1)
            db.add(Mark(student_id=s.student_id, course_id=c1.course_id, assessment_name=an,
                        max_marks=mx, marks_obtained=obtained, is_absent=False))
    db.commit()
    print("Seeded. Logins:\n  hod@college.edu / admin123\n  meera@college.edu / faculty123\n"
          "  ravi@college.edu / faculty123\n  asha@college.edu / student123")


if __name__ == "__main__":
    main()
