import json
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import MEDIA_DIR, get_db
from ..models.models import Artwork, Settings
from ..services.pdf_builder import StyleOptions, build_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


def get_settings_row(db: Session) -> Settings:
    row = db.get(Settings, 1)
    if row is None:
        row = Settings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


class SettingsPatch(BaseModel):
    email: str | None = None
    advisory_name: str | None = None
    advisory_address: str | None = None
    align: str | None = None
    font: str | None = None
    accent_hex: str | None = None
    image_scale: float | None = None
    style_request: str | None = None


STYLE_SCHEMA = {
    "type": "object",
    "properties": {
        "align": {"type": "string", "enum": ["left", "center"]},
        "font": {"type": "string", "enum": ["serif", "sans"]},
        "image_scale": {"type": "number", "description": "0.6 (intimate) to 1.25 (large)"},
        "accent_hex": {"type": "string", "description": "hex color like #1a1a1a for headings and prices"},
        "summary": {"type": "string", "description": "one plain sentence telling the advisor what was applied"},
    },
    "required": ["align", "font", "image_scale", "accent_hex", "summary"],
    "additionalProperties": False,
}


def _apply_style_request(row: Settings, request_text: str) -> str:
    """Translate the advisor's own words into the PDF style knobs via Claude."""
    import anthropic

    client = anthropic.Anthropic(timeout=60.0, max_retries=1)
    current = (f"align={row.align}, font={row.font}, image_scale={row.image_scale}, "
               f"accent_hex={row.accent_hex}")
    response = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8"),
        max_tokens=2000,
        thinking={"type": "adaptive"},
        system=(
            "You configure the layout of an art advisor's client-facing PDF. "
            "Available knobs: align (left|center), font (serif|sans), image_scale "
            "(0.6 small/intimate images to 1.25 large images), accent_hex (color of "
            "headings and prices). Map the advisor's request onto these knobs; keep "
            "any knob they did not mention at its current value. If they ask for "
            "something the knobs cannot do, keep values sensible and say so in summary."
        ),
        output_config={"format": {"type": "json_schema", "schema": STYLE_SCHEMA}},
        messages=[{
            "role": "user",
            "content": f"Current settings: {current}\n\nAdvisor's request: {request_text}",
        }],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("declined")
    data = json.loads(next(b.text for b in response.content if b.type == "text"))
    row.align = data["align"] if data["align"] in ("left", "center") else row.align
    row.font = data["font"] if data["font"] in ("serif", "sans") else row.font
    row.image_scale = min(1.25, max(0.5, float(data["image_scale"])))
    if isinstance(data["accent_hex"], str) and data["accent_hex"].startswith("#"):
        row.accent_hex = data["accent_hex"][:7]
    return data.get("summary", "Style updated.")


@router.get("")
def read_settings(db: Session = Depends(get_db)):
    return get_settings_row(db).to_dict()


@router.put("")
def save_settings(body: SettingsPatch, db: Session = Depends(get_db)):
    row = get_settings_row(db)
    updates = body.model_dump(exclude_none=True)
    style_request = updates.pop("style_request", None)
    for key, value in updates.items():
        setattr(row, key, value)

    style_summary = ""
    if style_request is not None and style_request.strip() and style_request.strip() != (row.style_request or "").strip():
        row.style_request = style_request.strip()
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                style_summary = _apply_style_request(row, style_request.strip())
            except Exception:
                logger.exception("style request could not be applied")
                style_summary = "Saved your request, but the AI could not apply it right now."
    elif style_request is not None:
        row.style_request = style_request.strip()

    db.commit()
    result = row.to_dict()
    if style_summary:
        result["style_summary"] = style_summary
    return result


@router.post("/logo")
async def upload_advisory_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Logo must be PNG or JPEG")
    name = f"advisory_logo_{uuid.uuid4().hex}{ext}"
    content = await file.read()
    with open(os.path.join(MEDIA_DIR, name), "wb") as f:
        f.write(content)
    row = get_settings_row(db)
    old = row.logo_media
    row.logo_media = name
    db.commit()
    if old:
        try:
            os.unlink(os.path.join(MEDIA_DIR, os.path.basename(old)))
        except OSError:
            pass
    return {"logo_media": name, "logo_url": f"/media/{name}"}


def _placeholder_artworks() -> list[dict]:
    """A tiny sample selection so the preview works before anything is swiped."""
    import fitz

    name = "settings_preview_placeholder.png"
    path = os.path.join(MEDIA_DIR, name)
    if not os.path.exists(path):
        doc = fitz.open()
        page = doc.new_page(width=450, height=550)
        page.draw_rect(fitz.Rect(0, 0, 450, 550), color=None, fill=(0.86, 0.84, 0.80))
        page.draw_rect(fitz.Rect(60, 80, 300, 330), color=None, fill=(0.16, 0.32, 0.44))
        page.draw_oval(fitz.Rect(210, 220, 400, 470), color=None, fill=(0.78, 0.55, 0.25))
        page.get_pixmap(dpi=96).save(path)
        doc.close()
    return [{
        "id": 0, "artist": "Sample Artist", "title": "Sample Work", "year": "2026",
        "medium": "Oil on canvas", "dimensions": "120 x 90 cm", "price": "$ 45,000",
        "edition": "", "gallery": "Sample Gallery", "description": "",
        "image_path": name,
    }]


def _build_preview_bytes(db: Session) -> bytes:
    """A sample client PDF in the advisor's saved style."""
    row = get_settings_row(db)
    liked = (
        db.query(Artwork).filter(Artwork.status == "liked")
        .order_by(Artwork.position, Artwork.id).limit(3).all()
    )
    artworks = [a.to_dict() | {"image_path": a.image_path} for a in liked] or _placeholder_artworks()

    logo_path = None
    if row.logo_media:
        candidate = os.path.join(MEDIA_DIR, os.path.basename(row.logo_media))
        if os.path.exists(candidate):
            logo_path = candidate

    style = StyleOptions(
        title="Style Preview",
        client_name="Sample Client",
        advisor_name=row.advisory_name,
        advisor_address=row.advisory_address,
        align=row.align if row.align in ("left", "center") else "left",
        image_scale=row.image_scale or 1.0,
        font=row.font if row.font in ("serif", "sans") else "serif",
        accent_hex=row.accent_hex or "#1a1a1a",
        logo_path=logo_path,
    )
    return build_pdf(artworks, MEDIA_DIR, style)


@router.get("/preview")
def preview_pdf(db: Session = Depends(get_db)):
    return Response(
        content=_build_preview_bytes(db),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="style-preview.pdf"'},
    )


@router.get("/preview/images")
def preview_images(db: Session = Depends(get_db)):
    """The preview as page images — iPhone Safari can't scroll an embedded PDF,
    so the app shows these in its own overlay with a proper close button."""
    import base64

    import fitz

    doc = fitz.open(stream=_build_preview_bytes(db), filetype="pdf")
    pages = [
        "data:image/png;base64,"
        + base64.b64encode(page.get_pixmap(dpi=120).tobytes("png")).decode()
        for page in doc
    ]
    doc.close()
    return {"pages": pages}
