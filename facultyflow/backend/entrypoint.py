import os
import subprocess
import sys

def init_db():
    try:
        print("[DEPLOY] Running Alembic migrations...")
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError("Database migration timed out") from e
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Database migration failed with exit code {e.returncode}") from e

    try:
        from app import models  # Essential: register all models with Base.metadata
        from app.database import SessionLocal, engine, Base
        Base.metadata.create_all(bind=engine)
        
        db = SessionLocal()
        try:
            from app.models import User
            user_count = db.query(User).count()

            if os.getenv("RESET_DEMO_PASSWORDS", "").strip().lower() in ("1", "true", "yes"):
                from app.auth import hash_password
                password_by_role = {
                    "hod@college.edu": ("admin123", "admin"),
                    "meera@college.edu": ("faculty123", "faculty"),
                    "ravi@college.edu": ("faculty123", "faculty"),
                    "asha@college.edu": ("student123", "student"),
                }
                for email, (password, role) in password_by_role.items():
                    user = db.query(User).filter(User.email == email).first()
                    if not user:
                        name = {
                            "hod@college.edu": "Dr. HOD",
                            "meera@college.edu": "Prof. Meera",
                            "ravi@college.edu": "Prof. Ravi",
                            "asha@college.edu": "Asha Rao",
                        }[email]
                        user = User(
                            name=name,
                            email=email,
                            role=role,
                            password_hash=hash_password(password),
                        )
                        db.add(user)
                    else:
                        user.password_hash = hash_password(password)
                        user.role = role
                db.commit()
                print("[DEPLOY] Demo account passwords synchronized explicitly.")

            if os.getenv("SEED_DEMO_DATA", "").strip().lower() in ("1", "true", "yes"):
                from app.models import Course

                faculty = db.query(User).filter(User.email == "meera@college.edu").first()
                faculty2 = db.query(User).filter(User.email == "ravi@college.edu").first()
                demo_courses = [
                    ("Data Structures", "CS301", 3, faculty),
                    ("Database Systems", "CS302", 3, faculty2),
                ]
                for name, code, semester, owner in demo_courses:
                    if owner and not db.query(Course).filter(Course.course_code == code).first():
                        db.add(Course(
                            course_name=name,
                            course_code=code,
                            semester=semester,
                            faculty_id=owner.user_id,
                        ))
                db.commit()
                print("[DEPLOY] Demo courses synchronized explicitly.")
        finally:
            db.close()
        print(f"[DEPLOY] Database initialized ({user_count} users present).")
    except Exception as e:
        raise RuntimeError(f"Database initialization failed: {e}") from e

if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[DEPLOY] Starting FacultyFlow server on {host}:{port}...")
    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port)
