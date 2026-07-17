import os
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

import logging

from ..models.database import MEDIA_DIR, get_db
from ..models.models import Artwork, Collection, Upload
from ..services.extraction import extract_artworks, guess_gallery_name
from ..services.llm_extraction import ai_available, extract_artworks_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_SIZE = 50 * 1024 * 1024


@router.post("")
async def upload_pdf(
    file: UploadFile = File(...),
    collection_id: int | None = Form(None),
    gallery: str = Form(""),
    db: Session = Depends(get_db),
):
    """Ingest a gallery PDF: extract artworks and queue them in the deck."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "PDF larger than 50MB")

    if collection_id is not None and not db.get(Collection, collection_id):
        raise HTTPException(404, "Collection not found")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        parsed = None
        gallery_name = ""
        engine = "basic"
        if ai_available():
            try:
                parsed, ai_gallery = extract_artworks_ai(tmp_path, MEDIA_DIR, original_filename=file.filename or "")
                gallery_name = gallery.strip() or ai_gallery
                engine = "ai"
            except Exception:
                logger.exception("AI extraction failed; falling back to heuristics")
                parsed = None
        if parsed is None:
            parsed = extract_artworks(tmp_path, MEDIA_DIR)
            gallery_name = gallery.strip() or guess_gallery_name(tmp_path, fallback_name=file.filename)
        import fitz

        with fitz.open(tmp_path) as d:
            page_count = d.page_count
    finally:
        os.unlink(tmp_path)

    # the caption parser can mistake the gallery's own name for the artist
    if gallery_name:
        g = gallery_name.lower()
        for art in parsed:
            a = art.artist.lower()
            if a and (a in g or g in a):
                art.artist = ""

    upload = Upload(
        filename=file.filename, gallery=gallery_name,
        page_count=page_count, collection_id=collection_id,
    )
    db.add(upload)
    db.flush()

    max_pos = db.query(Artwork).count()
    for i, art in enumerate(parsed):
        db.add(Artwork(
            upload_id=upload.id,
            collection_id=collection_id,
            artist=art.artist, title=art.title, year=art.year,
            medium=art.medium, dimensions=art.dimensions, price=art.price,
            edition=art.edition, description=art.description,
            gallery=gallery_name,
            image_path=art.image_path, detail_image_paths=art.detail_image_paths,
            raw_text=art.raw_text, pages=art.pages,
            position=max_pos + i,
        ))
    db.commit()
    db.refresh(upload)

    return {
        "upload_id": upload.id,
        "filename": upload.filename,
        "gallery": gallery_name,
        "page_count": page_count,
        "artworks_found": len(parsed),
        "engine": engine,
    }


@router.get("")
def list_uploads(db: Session = Depends(get_db)):
    uploads = db.query(Upload).order_by(Upload.created_at.desc()).all()
    return [
        {
            "id": u.id, "filename": u.filename, "gallery": u.gallery,
            "page_count": u.page_count, "collection_id": u.collection_id,
            "artwork_count": len(u.artworks),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in uploads
    ]


class UploadPatch(BaseModel):
    gallery: str


@router.patch("/{upload_id}")
def update_upload(upload_id: int, body: UploadPatch, db: Session = Depends(get_db)):
    """Rename the gallery on a processed PDF — flows through to its artworks."""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(404, "Upload not found")
    gallery = body.gallery.strip()
    upload.gallery = gallery
    for art in upload.artworks:
        art.gallery = gallery
    db.commit()
    return {"id": upload.id, "gallery": upload.gallery, "artworks_updated": len(upload.artworks)}


@router.delete("/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    """Remove a processed PDF and everything that came from it — the artworks
    (wherever they sit in the library) and their extracted images on disk."""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(404, "Upload not found")
    for art in upload.artworks:
        for path in [art.image_path, *(art.detail_image_paths or [])]:
            if not path:
                continue
            file_path = os.path.join(MEDIA_DIR, os.path.basename(path))
            try:
                os.unlink(file_path)
            except OSError:
                pass
        art.collections = []
    db.delete(upload)
    db.commit()
    return {"deleted": upload_id}
