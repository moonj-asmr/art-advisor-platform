import logging
import os
import tempfile

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import MEDIA_DIR, SessionLocal, get_db
from ..models.models import Artwork, Collection, Upload
from ..services.extraction import extract_artworks, guess_gallery_name
from ..services.llm_extraction import ai_available, extract_artworks_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_SIZE = 50 * 1024 * 1024


def process_upload(upload_id: int, tmp_path: str, gallery_override: str,
                   collection_id: int | None, original_filename: str):
    """Runs in the background after the upload response is sent. The advisor
    can keep uploading and browsing while the AI reads the PDF."""
    db = SessionLocal()
    try:
        parsed = None
        gallery_name = ""
        if ai_available():
            try:
                parsed, ai_gallery = extract_artworks_ai(tmp_path, MEDIA_DIR, original_filename=original_filename)
                gallery_name = gallery_override or ai_gallery
            except Exception:
                logger.exception("AI extraction failed; falling back to heuristics")
                parsed = None
        if parsed is None:
            parsed = extract_artworks(tmp_path, MEDIA_DIR)
            gallery_name = gallery_override or guess_gallery_name(tmp_path, fallback_name=original_filename)

        upload = db.get(Upload, upload_id)
        if upload is None:
            return  # deleted while processing
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
        upload.gallery = gallery_name
        upload.status = "done"
        db.commit()
    except Exception:
        logger.exception("upload %s failed to process", upload_id)
        try:
            upload = db.get(Upload, upload_id)
            if upload:
                upload.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post("")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection_id: int | None = Form(None),
    gallery: str = Form(""),
    db: Session = Depends(get_db),
):
    """Accept a gallery PDF and queue it for AI processing. Returns immediately;
    the upload appears under Processed PDFs with a spinner until it's done."""
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

    import fitz

    try:
        with fitz.open(tmp_path) as d:
            page_count = d.page_count
    except Exception:
        os.unlink(tmp_path)
        raise HTTPException(400, "Could not read that PDF")

    upload = Upload(
        filename=file.filename, gallery=gallery.strip(),
        page_count=page_count, collection_id=collection_id,
        status="processing",
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    background_tasks.add_task(
        process_upload, upload.id, tmp_path, gallery.strip(), collection_id, file.filename or "",
    )

    return {
        "upload_id": upload.id,
        "filename": upload.filename,
        "page_count": page_count,
        "status": "processing",
    }


@router.get("")
def list_uploads(db: Session = Depends(get_db)):
    uploads = db.query(Upload).order_by(Upload.created_at.desc()).all()
    return [
        {
            "id": u.id, "filename": u.filename, "gallery": u.gallery,
            "page_count": u.page_count, "collection_id": u.collection_id,
            "artwork_count": len(u.artworks),
            "status": u.status or "done",
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
