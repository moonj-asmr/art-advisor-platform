import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .models.database import Base, engine, MEDIA_DIR
from .models import models  # noqa: F401 — register tables
from .routers import artworks, collections, export, uploads

Base.metadata.create_all(bind=engine)

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
