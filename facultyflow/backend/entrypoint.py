import os
import subprocess
import sys

def init_db():
    try:
        print("[DEPLOY] Running Alembic migrations...")
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=False)
    except Exception as e:
        print(f"[DEPLOY] Alembic migration notice: {e}")

    try:
        from app import models  # Essential: register all models with Base.metadata
        from app.database import SessionLocal, engine, Base
        Base.metadata.create_all(bind=engine)
        
        db = SessionLocal()
        from app.models import User
        user_count = db.query(User).count()
        db.close()
        
        if user_count == 0:
            print("[DEPLOY] Seeding initial demo data...")
            from app.seed import main as seed_main
            seed_main()
            print("[DEPLOY] Demo data seeded successfully.")
        else:
            print(f"[DEPLOY] Database initialized ({user_count} users present).")
    except Exception as e:
        print(f"[DEPLOY] Seed / initialization error: {e}")

if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[DEPLOY] Starting FacultyFlow server on {host}:{port}...")
    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port)
