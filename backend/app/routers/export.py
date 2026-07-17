import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..models.database import MEDIA_DIR, get_db
from ..models.models import Artwork
from ..services.pdf_builder import StyleOptions, build_pdf

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    artwork_ids: list[int]
    title: str = ""
    client_name: str = ""
    advisor_name: str = ""
    align: str = "left"
    image_scale: float = Field(1.0, ge=0.5, le=1.25)
    show_price: bool = True
    show_gallery: bool = True
    show_description: bool = False
    font: str = "serif"
    accent_hex: str = "#1a1a1a"
    logo_media: str = ""  # media filename returned by POST /export/logo
    notes: dict[str, str] = {}


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    """Store the advisor's logo once; reference it in export requests."""
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
    """Render the curated selection into the advisor's formatted PDF."""
    if not body.artwork_ids:
        raise HTTPException(400, "No artworks selected")
    arts = db.query(Artwork).filter(Artwork.id.in_(body.artwork_ids)).all()
    by_id = {a.id: a for a in arts}
    ordered = [by_id[i].to_dict() | {"image_path": by_id[i].image_path}
               for i in body.artwork_ids if i in by_id]
    if not ordered:
        raise HTTPException(404, "Artworks not found")

    logo_path = None
    if body.logo_media:
        candidate = os.path.join(MEDIA_DIR, os.path.basename(body.logo_media))
        if os.path.exists(candidate):
            logo_path = candidate

    style = StyleOptions(
        title=body.title, client_name=body.client_name, advisor_name=body.advisor_name,
        align=body.align if body.align in ("left", "center") else "left",
        image_scale=body.image_scale, show_price=body.show_price,
        show_gallery=body.show_gallery, show_description=body.show_description,
        font=body.font if body.font in ("serif", "sans") else "serif",
        accent_hex=body.accent_hex, logo_path=logo_path, notes=body.notes,
    )
    pdf_bytes = build_pdf(ordered, MEDIA_DIR, style)
    filename = (body.title or "selection").strip().replace(" ", "-").lower() or "selection"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )
