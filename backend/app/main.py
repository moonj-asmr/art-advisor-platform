import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models.database import Base, engine, MEDIA_DIR
from .models import models  # noqa: F401 — register tables
from .routers import artworks, collections, export, uploads

Base.metadata.create_all(bind=engine)


def _migrate_legacy_collection_stamps():
    """Artworks used to carry a single collection_id; membership now lives in
    the artwork_collections table. Carry old stamps over once."""
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(text(
            "INSERT OR IGNORE INTO artwork_collections (artwork_id, collection_id) "
            "SELECT id, collection_id FROM artworks WHERE collection_id IS NOT NULL"
        ) if engine.dialect.name == "sqlite" else text(
            "INSERT INTO artwork_collections (artwork_id, collection_id) "
            "SELECT id, collection_id FROM artworks WHERE collection_id IS NOT NULL "
            "ON CONFLICT DO NOTHING"
        ))


_migrate_legacy_collection_stamps()

app = FastAPI(title="Art Advisor Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

app.include_router(uploads.router, prefix="/api")
app.include_router(artworks.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Single-service deploys (Docker/Railway) bake the built frontend into the
# image; serve it here so the whole app lives at one URL. In development the
# Vite dev server handles the frontend and this block is skipped.
FRONTEND_DIST = os.environ.get(
    "FRONTEND_DIST",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
)
if os.path.isdir(FRONTEND_DIST):

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        candidate = os.path.normpath(os.path.join(FRONTEND_DIST, path))
        if path and candidate.startswith(FRONTEND_DIST) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
