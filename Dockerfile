# Single-image deploy: build the frontend, serve everything from FastAPI.
# Used by Railway (auto-detected) and any other Docker host.

FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=frontend /fe/dist ./frontend-dist

# /data holds the SQLite DB + extracted artwork images.
# Mount a persistent volume there so uploads survive redeploys.
ENV FRONTEND_DIST=/app/frontend-dist \
    ART_ADVISOR_DATA=/data

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
