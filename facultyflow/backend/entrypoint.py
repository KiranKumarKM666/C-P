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
