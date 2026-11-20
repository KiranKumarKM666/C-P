import logging
from collections import defaultdict
from pathlib import Path
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import CORS_ORIGINS
from .database import Base, engine
from .routers import advisories, attendance, auth_routes, courses, marks, reports

# Setup structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("facultyflow")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FacultyFlow", version="1.0",
              description="AI drafts; the teacher always decides.")
app.add_middleware(CORSMiddleware,
                   allow_origins=CORS_ORIGINS,
                   allow_credentials=True if CORS_ORIGINS != ["*"] else False,
                   allow_methods=["*"],
                   allow_headers=["*"],
                   expose_headers=["Content-Disposition"])

# Rate limit for login (in-memory sliding window)
login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_LIMIT = 10          # max attempts per window
LOGIN_WINDOW_SEC = 60.0   # 1 minute window


@app.middleware("http")
async def rate_limit_login(request: Request, call_next):
    if request.url.path == "/auth/login" and request.method == "POST":
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
    except Exception as exc:
        db_status = f"unhealthy: {exc}"
    is_ok = db_status == "connected"
    return JSONResponse(
        status_code=200 if is_ok else 503,
        content={"status": "ok" if is_ok else "degraded", "database": db_status}
    )


for r in (auth_routes, courses, attendance, marks, advisories, reports):
    app.include_router(r.router)

# Serve the front end from the same server (API routes above take priority)
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
if not FRONTEND.exists():
    FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
if not FRONTEND.exists():
    FRONTEND = Path("/app/frontend")
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
