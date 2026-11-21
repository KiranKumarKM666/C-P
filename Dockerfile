# Build the React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY facultyflow/frontend-react/package*.json ./
RUN npm ci
COPY facultyflow/frontend-react/ ./
RUN npm run build

# Lightweight production runtime
FROM python:3.11-slim AS base

WORKDIR /app

# Prevent Python from buffering stdout/stderr and bytecode generation
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY facultyflow/backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend and freshly built frontend
COPY facultyflow/backend /app/backend
COPY --from=frontend-build /build/../frontend /app/frontend

WORKDIR /app/backend

# Expose HTTP port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch deployment entrypoint
CMD ["python", "entrypoint.py"]
