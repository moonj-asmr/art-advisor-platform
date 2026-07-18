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
from ..services.pdf_builder import FONT_FAMILIES, StyleOptions, build_pdf

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
    background_hex: str | None = None
    text_hex: str | None = None
    base_font_pt: float | None = None
    heading_font_pt: float | None = None
    image_scale: float | None = None
    style_request: str | None = None


FONT_KEYS = list(FONT_FAMILIES.keys())

STYLE_SCHEMA = {
    "type": "object",
    "properties": {
        "align": {"type": "string", "enum": ["left", "center"]},
        "font": {"type": "string", "enum": FONT_KEYS},
        "image_scale": {"type": "number", "description": "0.6 (intimate) to 1.25 (large)"},
        "accent_hex": {"type": "string", "description": "hex color for artist names, prices, cover title"},
        "background_hex": {"type": "string", "description": "hex page background color, #ffffff for plain white"},
        "text_hex": {"type": "string", "description": "hex color of the caption body text"},
        "base_font_pt": {"type": "number", "description": "caption body size in points, 8 to 16"},
        "heading_font_pt": {"type": "number", "description": "artist-name size in points, 10 to 24"},
        "summary": {"type": "string", "description": "one plain sentence telling the advisor what was applied"},
    },
    "required": ["align", "font", "image_scale", "accent_hex", "background_hex",
                 "text_hex", "base_font_pt", "heading_font_pt", "summary"],
    "additionalProperties": False,
}


def _clamp_hex(value, fallback: str) -> str:
    if isinstance(value, str) and value.startswith("#") and len(value) in (4, 7):
        return value[:7]
    return fallback


def _apply_style_request(row: Settings, request_text: str) -> str:
    """Translate the advisor's own words into the PDF style dials via Claude."""
    import anthropic

    client = anthropic.Anthropic(timeout=60.0, max_retries=1)
    font_menu = ", ".join(f"{k} ({v['label']})" for k, v in FONT_FAMILIES.items())
    current = (f"align={row.align}, font={row.font}, image_scale={row.image_scale}, "
               f"accent_hex={row.accent_hex}, background_hex={row.background_hex}, "
               f"text_hex={row.text_hex}, base_font_pt={row.base_font_pt}, "
               f"heading_font_pt={row.heading_font_pt}")
    response = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8"),
        max_tokens=2000,
        thinking={"type": "adaptive"},
        system=(
            "You configure the layout of an art advisor's client-facing PDF. "
            "Dials you can set: align (left|center); font — one of: " + font_menu + "; "
            "image_scale (0.6 small/intimate images to 1.25 large); accent_hex "
            "(artist names, prices, cover title); background_hex (whole-page "
            "background — e.g. a light green request means something like #e8f2e8, "
            "keep backgrounds pale enough that text stays readable); text_hex "
            "(caption body color); base_font_pt (body text size, 8-16); "
            "heading_font_pt (artist-name size, 10-24). Apply the advisor's request "
            "literally where a dial exists for it; keep every dial they did not "
            "mention at its current value. If part of the request has no dial, "
            "choose the closest achievable combination and say so plainly in summary."
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
    row.font = data["font"] if data["font"] in FONT_FAMILIES else row.font
    row.image_scale = min(1.25, max(0.5, float(data["image_scale"])))
    row.accent_hex = _clamp_hex(data["accent_hex"], row.accent_hex)
    row.background_hex = _clamp_hex(data["background_hex"], row.background_hex)
    row.text_hex = _clamp_hex(data["text_hex"], row.text_hex)
    row.base_font_pt = min(16.0, max(8.0, float(data["base_font_pt"])))
    row.heading_font_pt = min(24.0, max(10.0, float(data["heading_font_pt"])))
    return data.get("summary", "Style updated.")


class LoginRequest(BaseModel):
    email: str
    password: str


def _hash_password(password: str, salt: str | None = None) -> str:
    import hashlib
    import secrets

    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return f"{salt}${digest.hex()}"


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Single-advisor login. The first login creates the account; after that
    the stored password must match."""
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(400, "Email and password are required")
    row = get_settings_row(db)
    if not row.password_hash:
        row.email = email
        row.password_hash = _hash_password(body.password)
        db.commit()
        return {"ok": True, "created": True, "email": email}
    salt = row.password_hash.split("$", 1)[0]
    if _hash_password(body.password, salt) != row.password_hash:
        raise HTTPException(401, "Wrong email or password")
    if email != (row.email or "").strip().lower():
        raise HTTPException(401, "Wrong email or password")
    return {"ok": True, "created": False, "email": email}


@router.get("")
def read_settings(db: Session = Depends(get_db)):
    result = get_settings_row(db).to_dict()
    result["font_options"] = [{"key": k, "label": v["label"]} for k, v in FONT_FAMILIES.items()]
    return result


@router.put("")
def save_settings(body: SettingsPatch, db: Session = Depends(get_db)):
    """Persist settings verbatim. The AI translation of style_request happens
    in POST /style-request, explicitly — saving never restyles anything."""
    row = get_settings_row(db)
    updates = body.model_dump(exclude_none=True)
    style_request = updates.pop("style_request", None)
    for key, value in updates.items():
        setattr(row, key, value)
    if style_request is not None:
        row.style_request = style_request.strip()
    db.commit()
    return row.to_dict()


class DialsBody(BaseModel):
    """The dials as currently shown on screen — possibly unsaved."""

    align: str | None = None
    font: str | None = None
    image_scale: float | None = None
    accent_hex: str | None = None
    background_hex: str | None = None
    text_hex: str | None = None
    base_font_pt: float | None = None
    heading_font_pt: float | None = None


class StyleRequestBody(DialsBody):
    style_request: str


DIAL_FIELDS = ("align", "font", "image_scale", "accent_hex", "background_hex",
               "text_hex", "base_font_pt", "heading_font_pt")


@router.post("/style-request")
def run_style_request(body: StyleRequestBody, db: Session = Depends(get_db)):
    """Translate the advisor's words into dial values and return them —
    nothing is saved; the screen updates and the advisor previews/saves."""
    if not body.style_request.strip():
        raise HTTPException(400, "Describe the style first")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "AI styling needs the ANTHROPIC_API_KEY set on the server")
    from types import SimpleNamespace

    row = get_settings_row(db)
    dials = SimpleNamespace(**{
        f: getattr(body, f) if getattr(body, f) is not None else getattr(row, f)
        for f in DIAL_FIELDS
    })
    try:
        summary = _apply_style_request(dials, body.style_request.strip())
    except Exception:
        logger.exception("style request failed")
        raise HTTPException(502, "The AI could not process that request right now — try again")
    return {"summary": summary, "dials": {f: getattr(dials, f) for f in DIAL_FIELDS}}


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


def _build_preview_bytes(db: Session, overrides: dict | None = None) -> bytes:
    """A sample client PDF — saved style, with any on-screen (unsaved) dial
    values layered on top so Preview always shows what the advisor sees."""
    row = get_settings_row(db)
    dial = lambda f: (overrides or {}).get(f) if (overrides or {}).get(f) is not None else getattr(row, f)  # noqa: E731
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

    align = dial("align")
    font = dial("font")
    style = StyleOptions(
        title="Style Preview",
        client_name="Sample Client",
        advisor_name=row.advisory_name,
        advisor_address=row.advisory_address,
        align=align if align in ("left", "center") else "left",
        image_scale=dial("image_scale") or 1.0,
        font=font if font in FONT_FAMILIES else "serif",
        accent_hex=dial("accent_hex") or "#1a1a1a",
        background_hex=dial("background_hex") or "#ffffff",
        text_hex=dial("text_hex") or "#262626",
        base_font_pt=dial("base_font_pt") or 10.0,
        heading_font_pt=dial("heading_font_pt") or 13.0,
        logo_path=logo_path,
    )
    return build_pdf(artworks, MEDIA_DIR, style)


def _pdf_to_page_images(pdf_bytes: bytes) -> list[str]:
    import base64

    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = [
        "data:image/png;base64,"
        + base64.b64encode(page.get_pixmap(dpi=120).tobytes("png")).decode()
        for page in doc
    ]
    doc.close()
    return pages


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
    return {"pages": _pdf_to_page_images(_build_preview_bytes(db))}


@router.post("/preview/images")
def preview_images_live(body: DialsBody | None = None, db: Session = Depends(get_db)):
    """Preview with the dials exactly as shown on screen — no save required."""
    overrides = {f: getattr(body, f) for f in DIAL_FIELDS} if body else None
    return {"pages": _pdf_to_page_images(_build_preview_bytes(db, overrides))}
