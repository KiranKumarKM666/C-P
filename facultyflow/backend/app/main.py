import logging
from collections import defaultdict
from pathlib import Path
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import CORS_ORIGINS
from .database import Base, engine
from .routers import advisories, attendance, auth_routes, courses, marks, reports

# Setup structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("facultyflow")

Base.metadata.create_all(bind=engine)

# Lightweight SQLite upgrade for installations created before absence reasons existed.
try:
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(attendance)")).fetchall()
        if cols and not any(row[1] == "reason" for row in cols):
            conn.execute(text("ALTER TABLE attendance ADD COLUMN reason VARCHAR(240)"))

        # Students are course-specific. Rebuild the SQLite students table once if
        # an older global USN uniqueness constraint is still present.
        student_cols = conn.execute(text("PRAGMA table_info(students)")).fetchall()
        if student_cols:
            global_usn_unique = False
            for index in conn.execute(text("PRAGMA index_list(students)")).fetchall():
                if index[2]:
                    index_name = str(index[1]).replace('"', '""')
                    index_columns = conn.execute(
                        text(f'PRAGMA index_info("{index_name}")')
                    ).fetchall()
                    if [row[2] for row in index_columns] == ["usn"]:
                        global_usn_unique = True
                        break

            if global_usn_unique:
                conn.execute(text("""
                    CREATE TABLE students_course_specific (
                        student_id INTEGER PRIMARY KEY,
                        usn VARCHAR(30) NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(120),
                        course_id INTEGER NOT NULL,
                        CONSTRAINT uq_student_usn_course UNIQUE (usn, course_id),
                        FOREIGN KEY(course_id) REFERENCES courses(course_id)
                    )
                """))
                conn.execute(text("""
                    INSERT INTO students_course_specific
                        (student_id, usn, name, email, course_id)
                    SELECT student_id, usn, name, email, course_id FROM students
                """))
                conn.execute(text("DROP TABLE students"))
                conn.execute(text("ALTER TABLE students_course_specific RENAME TO students"))
                conn.execute(text("CREATE INDEX ix_students_usn ON students(usn)"))
                conn.execute(text("CREATE INDEX ix_students_course_id ON students(course_id)"))
except Exception:
    logger.exception("Failed to apply SQLite schema upgrades")

app = FastAPI(title="FacultyFlow", version="1.0",
              description="AI drafts; the teacher always decides.")
app.add_middleware(CORSMiddleware,
                   allow_origins=CORS_ORIGINS,
                   allow_credentials=True if CORS_ORIGINS != ["*"] else False,
                   allow_methods=["*"],
                   allow_headers=["*"],
                   expose_headers=["Content-Disposition"])

MAX_REQUEST_BYTES = 10 * 1024 * 1024


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request payload exceeds the 10 MB limit"},
                )
        except ValueError:
            pass
    return await call_next(request)

# Rate limit for login (in-memory sliding window)
login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_LIMIT = 10          # max attempts per window
LOGIN_WINDOW_SEC = 60.0   # 1 minute window


@app.middleware("http")
async def rate_limit_login(request: Request, call_next):
    if request.url.path in ("/auth/login", "/api/auth/login") and request.method == "POST":
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Filter attempts within window
        recent = [t for t in login_attempts[client_ip] if now - t < LOGIN_WINDOW_SEC]
        login_attempts[client_ip] = recent
        if len(recent) >= LOGIN_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many login attempts. Please wait a minute before trying again."}
            )
        login_attempts[client_ip].append(now)
    return await call_next(request)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = (time.perf_counter() - start) * 1000
        client_ip = request.client.host if request.client else "unknown"
        logger.exception(f"{client_ip} - {request.method} {request.url.path} -> 500 ({duration_ms:.1f}ms): {exc}")
        raise exc
    duration_ms = (time.perf_counter() - start) * 1000
    client_ip = request.client.host if request.client else "unknown"
    # Never log body/passwords; safe structured line:
    logger.info(f"{client_ip} - {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)")
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health", tags=["system"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        logger.exception("Database health check failed")
        db_status = "unhealthy"
    is_ok = db_status == "connected"
    return JSONResponse(
        status_code=200 if is_ok else 503,
        content={"status": "ok" if is_ok else "degraded", "database": db_status}
    )


for r in (auth_routes, courses, attendance, marks, advisories, reports):
    app.include_router(r.router)
    app.include_router(r.router, prefix="/api")


# Serve client-side routes as HTML instead of routing them through API handlers.
# This keeps refreshes such as /dashboard and /attendance on the React SPA.
@app.middleware("http")
async def spa_fallback(request: Request, call_next):
    response = await call_next(request)
    if response.status_code != 404 or request.method != "GET":
        return response

    path = request.url.path
    if path.startswith("/api/") or path == "/api":
        return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})

    accept = request.headers.get("accept", "")
    if "text/html" not in accept:
        return response

    # FRONTEND is resolved below; resolve it here for the fallback too.
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    if not frontend.exists():
        frontend = Path(__file__).resolve().parents[1] / "frontend"
    if not frontend.exists():
        frontend = Path("/app/frontend")
    index = frontend / "index.html"
    if index.exists():
        return FileResponse(index)
    return response

# Serve the front end from the same server (API routes above take priority)
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
if not FRONTEND.exists():
    FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
if not FRONTEND.exists():
    FRONTEND = Path("/app/frontend")
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
