import os
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..models.database import MEDIA_DIR, get_db
from ..models.models import Artwork, Collection, Upload
from ..services.extraction import extract_artworks, guess_gallery_name

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
        parsed = extract_artworks(tmp_path, MEDIA_DIR)
        gallery_name = gallery.strip() or guess_gallery_name(tmp_path)
        import fitz

        with fitz.open(tmp_path) as d:
            page_count = d.page_count
    finally:
        os.unlink(tmp_path)

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


@router.delete("/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(404, "Upload not found")
    db.delete(upload)
    db.commit()
    return {"deleted": upload_id}
