"""AI-powered PDF understanding via the Claude API.

The heuristic extractor (extraction.py) pattern-matches captions; it works on
well-behaved PDFs but real gallery mailings are wildly inconsistent. This
module sends the whole PDF to Claude — which reads the text *and* sees the
page images — and asks for structured artwork data: who the artist is (vs.
the dealer), which pages belong to which work, prices as printed, and the
gallery behind the document.

Requires ANTHROPIC_API_KEY in the environment. When it is missing or a call
fails, callers fall back to the heuristic extractor.
"""

import base64
import json
import os
import uuid
from typing import List, Tuple

import anthropic
import fitz

from .extraction import ParsedArtwork, _extract_page_images

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
MAX_PDF_BYTES = 24 * 1024 * 1024  # base64 inflates ~4/3; stay under the 32MB request cap

SCHEMA = {
    "type": "object",
    "properties": {
        "gallery": {
            "type": "string",
            "description": "Name of the gallery/dealer that produced this PDF, empty string if unknown",
        },
        "artworks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "artist": {"type": "string"},
                    "title": {"type": "string"},
                    "year": {"type": "string"},
                    "medium": {"type": "string"},
                    "dimensions": {"type": "string"},
                    "price": {"type": "string"},
                    "edition": {"type": "string"},
                    "description": {"type": "string"},
                    "pages": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["artist", "title", "year", "medium", "dimensions",
                             "price", "edition", "description", "pages"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["gallery", "artworks"],
    "additionalProperties": False,
}

SYSTEM = """You extract structured artwork data from gallery PDFs for an art advisor.

Context: art advisors receive availability PDFs from galleries — for exhibitions
and art fairs. Formats vary wildly: some show one artwork per page with a caption
(artist, title, year, medium, dimensions, price); others give each artwork several
pages (a lead image, then detail shots, installation views, scale shots, and
sometimes an artist biography or a text about the work); solo-exhibition PDFs
often name the artist only once on the cover.

Rules:
- Identify EVERY distinct artwork offered in the document. Detail shots,
  installation views and texts belong to the artwork they illustrate — they are
  not separate artworks. Cover pages, contact pages and price-list summaries are
  not artworks.
- The artist is the person who made the work. Gallery names, dealer names,
  catalogue publishers ("... Gallery", "... Fine Art", "... Catalogues") are
  NEVER the artist. If the PDF names the artist only on the cover or in a running
  header, apply it to every artwork it covers.
- Copy the price exactly as printed, including currency symbol and formatting.
  Empty string if no price is given for that work.
- Use empty strings for anything genuinely not stated. Do not invent data.
- "pages" lists the 1-indexed PDF page numbers belonging to each artwork, the
  page with the primary image first.
- "description" holds artist-bio or about-the-work text only when the PDF
  provides it for that artwork; never contact details or legal boilerplate."""


def ai_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def extract_artworks_ai(pdf_path: str, media_dir: str, original_filename: str = "") -> Tuple[List[ParsedArtwork], str]:
    """Full-document extraction with Claude. Returns (artworks, gallery_name).

    Raises on any API problem — callers fall back to the heuristic extractor.
    """
    client = anthropic.Anthropic(timeout=280.0, max_retries=1)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    # Pull the raster images out of every page up front — Claude decides which
    # pages belong to which artwork; we attach the images from those pages.
    page_images = [_extract_page_images(doc, page, media_dir) for page in doc]

    content = []
    if len(pdf_bytes) <= MAX_PDF_BYTES and page_count <= 550:
        content.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.standard_b64encode(pdf_bytes).decode(),
            },
        })
    else:
        # Too large to send as a document — fall back to page-delimited text.
        parts = []
        for i in range(page_count):
            parts.append(f"--- PAGE {i + 1} ---\n{doc[i].get_text('text').strip()}")
        content.append({"type": "text", "text": "<pdf_text>\n" + "\n\n".join(parts) + "\n</pdf_text>"})

    content.append({
        "type": "text",
        "text": (
            f'This gallery PDF is named "{original_filename or os.path.basename(pdf_path)}" '
            f"and has {page_count} pages. Extract every artwork."
        ),
    })

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": content}],
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("model declined the document")
        text = next(b.text for b in response.content if b.type == "text")
        data = json.loads(text)

        artworks: List[ParsedArtwork] = []
        for item in data.get("artworks", []):
            pages = [p for p in item.get("pages", []) if isinstance(p, int) and 1 <= p <= page_count]
            images = []
            for p in pages:
                images.extend(page_images[p - 1])
            art = ParsedArtwork(
                artist=(item.get("artist") or "").strip(),
                title=(item.get("title") or "").strip(),
                year=(item.get("year") or "").strip(),
                medium=(item.get("medium") or "").strip(),
                dimensions=(item.get("dimensions") or "").strip(),
                price=(item.get("price") or "").strip(),
                edition=(item.get("edition") or "").strip(),
                description=(item.get("description") or "").strip(),
                pages=pages,
            )
            if images:
                art.image_path = images[0]
                art.detail_image_paths = images[1:]
            elif pages:
                # No embedded raster image (vector art, flattened layout) —
                # render the lead page itself as the card image.
                name = f"{uuid.uuid4().hex}.png"
                doc[pages[0] - 1].get_pixmap(dpi=120).save(os.path.join(media_dir, name))
                art.image_path = name
            if art.image_path or art.title or art.artist:
                artworks.append(art)

        if not artworks:
            raise RuntimeError("AI extraction returned no artworks")
        return artworks, (data.get("gallery") or "").strip()
    finally:
        doc.close()
