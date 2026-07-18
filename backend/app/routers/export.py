import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import MEDIA_DIR, get_db
from ..models.models import Artwork
from ..services.pdf_builder import FONT_FAMILIES, StyleOptions, build_pdf
from .settings import get_settings_row

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    """Per-export choices. Layout, logo, and the advisory identity come from
    the saved Settings — the export sheet only asks what changes per client."""

    artwork_ids: list[int]
    title: str = ""
    client_name: str = ""
    show_price: bool = True
    show_gallery: bool = True
    show_description: bool = False
    notes: dict[str, str] = {}


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    """Kept for compatibility; the advisory logo now lives in Settings."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Logo must be PNG or JPEG")
    name = f"logo_{uuid.uuid4().hex}{ext}"
    content = await file.read()
    with open(os.path.join(MEDIA_DIR, name), "wb") as f:
        f.write(content)
    return {"logo_media": name}


@router.post("")
def export_pdf(body: ExportRequest, db: Session = Depends(get_db)):
    """Render the curated selection using the advisory's saved house style."""
    if not body.artwork_ids:
        raise HTTPException(400, "No artworks selected")
    arts = db.query(Artwork).filter(Artwork.id.in_(body.artwork_ids)).all()
    by_id = {a.id: a for a in arts}
    ordered = [by_id[i].to_dict() | {"image_path": by_id[i].image_path}
               for i in body.artwork_ids if i in by_id]
    if not ordered:
        raise HTTPException(404, "Artworks not found")

    settings = get_settings_row(db)
    logo_path = None
    if settings.logo_media:
        candidate = os.path.join(MEDIA_DIR, os.path.basename(settings.logo_media))
        if os.path.exists(candidate):
            logo_path = candidate

    style = StyleOptions(
        title=body.title,
        client_name=body.client_name,
        advisor_name=settings.advisory_name,
        advisor_address=settings.advisory_address,
        align=settings.align if settings.align in ("left", "center") else "left",
        image_scale=settings.image_scale or 1.0,
        show_price=body.show_price,
        show_gallery=body.show_gallery,
        show_description=body.show_description,
        font=settings.font if settings.font in FONT_FAMILIES else "serif",
        accent_hex=settings.accent_hex or "#1a1a1a",
        background_hex=settings.background_hex or "#ffffff",
        text_hex=settings.text_hex or "#262626",
        base_font_pt=settings.base_font_pt or 10.0,
        heading_font_pt=settings.heading_font_pt or 13.0,
        logo_path=logo_path,
        notes=body.notes,
    )
    pdf_bytes = build_pdf(ordered, MEDIA_DIR, style)
    filename = (body.title or "selection").strip().replace(" ", "-").lower() or "selection"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )
