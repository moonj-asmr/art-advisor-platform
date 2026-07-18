"""Build the client-facing PDF from a curated selection.

One artwork per page, generous margins, a consistent typographic caption —
the point is that the result reads as the advisor's own document, not a
cobbled-together compilation of gallery layouts. Style options let each
advisor make it theirs.
"""

import io
import os
from dataclasses import dataclass, field
from typing import List, Optional

import fitz  # PyMuPDF

PAGE_W, PAGE_H = fitz.paper_size("a4")  # 595 x 842 pt

FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")

# Font families the advisor can pick (and the AI can set). The two classics
# use PDF base-14 faces; the rest are embedded TTFs shipped with the app.
FONT_FAMILIES = {
    "serif": {"label": "Times (classic serif)", "base14": ("tiro", "tibo", "tiit")},
    "sans": {"label": "Helvetica (modern sans)", "base14": ("helv", "hebo", "heit")},
    "garamond": {"label": "EB Garamond", "files": "ebgaramond"},
    "playfair": {"label": "Playfair Display", "files": "playfair"},
    "cormorant": {"label": "Cormorant Garamond", "files": "cormorant"},
    "inter": {"label": "Inter", "files": "inter"},
    "lato": {"label": "Lato", "files": "lato"},
}


@dataclass
class StyleOptions:
    title: str = ""                # cover / header title, e.g. "Art Basel Selections"
    client_name: str = ""          # e.g. "Prepared for Alice Chen"
    advisor_name: str = ""         # footer credit
    advisor_address: str = ""      # printed under the advisory name on the cover
    align: str = "left"            # left | center
    image_scale: float = 1.0       # 0.6 (intimate) .. 1.2 (full-bleed-ish)
    show_price: bool = True
    show_gallery: bool = True
    show_description: bool = False
    font: str = "serif"            # a FONT_FAMILIES key
    accent_hex: str = "#1a1a1a"    # artist names, prices, cover title
    background_hex: str = "#ffffff"  # page background
    text_hex: str = "#262626"      # body caption text
    base_font_pt: float = 10.0     # caption body size; everything scales from it
    heading_font_pt: float = 13.0  # artist-name size
    logo_path: Optional[str] = None
    notes: dict = field(default_factory=dict)  # artwork_id -> advisor note


def _hex_to_rgb(h: str, fallback=(0.1, 0.1, 0.1)):
    h = (h or "").lstrip("#")
    if len(h) != 6:
        return fallback
    try:
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return fallback


class _Faces:
    """Regular/bold/italic for the chosen family — base-14 names or TTF files.
    insert_textbox needs (fontname, fontfile) pairs; TTFs register per page."""

    def __init__(self, family: str):
        fam = FONT_FAMILIES.get(family) or FONT_FAMILIES["serif"]
        if "base14" in fam:
            reg, bold, italic = fam["base14"]
            self.reg = {"fontname": reg}
            self.bold = {"fontname": bold}
            self.italic = {"fontname": italic}
        else:
            stem = os.path.join(FONT_DIR, fam["files"])
            self.reg = {"fontname": "FamR", "fontfile": f"{stem}-regular.ttf"}
            self.bold = {"fontname": "FamB", "fontfile": f"{stem}-bold.ttf"}
            self.italic = {"fontname": "FamI", "fontfile": f"{stem}-italic.ttf"}


def build_pdf(artworks: List[dict], media_dir: str, style: StyleOptions) -> bytes:
    doc = fitz.open()
    accent = _hex_to_rgb(style.accent_hex)
    bg = _hex_to_rgb(style.background_hex, fallback=(1, 1, 1))
    body = _hex_to_rgb(style.text_hex, fallback=(0.15, 0.15, 0.15))
    # secondary text: body color eased toward the background so it stays
    # legible whatever page color the advisor picked
    grey = tuple(b * 0.62 + g * 0.38 for b, g in zip(body, bg))
    faces = _Faces(style.font)
    base = max(7.0, min(float(style.base_font_pt or 10.0), 16.0))
    heading = max(base, min(float(style.heading_font_pt or base * 1.3), 26.0))
    margin = 56.0
    centered = style.align == "center"

    def paint_background(page):
        if bg != (1, 1, 1):
            page.draw_rect(page.rect, color=None, fill=bg)

    # ---- cover page ----
    if style.title or style.client_name:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        paint_background(page)
        y = PAGE_H * 0.42
        if style.logo_path and os.path.exists(style.logo_path):
            rect = fitz.Rect(PAGE_W / 2 - 60, y - 150, PAGE_W / 2 + 60, y - 60)
            page.insert_image(rect, filename=style.logo_path, keep_proportion=True)
        if style.title:
            cover_size = heading * 1.85
            page.insert_textbox(
                fitz.Rect(margin, y, PAGE_W - margin, y + cover_size * 2.6),
                style.title, fontsize=cover_size, color=accent, align=fitz.TEXT_ALIGN_CENTER,
                **faces.bold,
            )
            y += cover_size * 2.6 + 6
        if style.client_name:
            page.insert_textbox(
                fitz.Rect(margin, y, PAGE_W - margin, y + base * 3),
                f"Prepared for {style.client_name}", fontsize=base * 1.3,
                color=grey, align=fitz.TEXT_ALIGN_CENTER, **faces.italic,
            )
        if style.advisor_name or style.advisor_address:
            credit = style.advisor_name
            if style.advisor_address:
                credit = (credit + "\n" if credit else "") + style.advisor_address
            page.insert_textbox(
                fitz.Rect(margin, PAGE_H - margin - 60, PAGE_W - margin, PAGE_H - margin + 10),
                credit, fontsize=base * 0.9, color=grey,
                align=fitz.TEXT_ALIGN_CENTER, **faces.reg,
            )

    # ---- artwork pages ----
    for art in artworks:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        paint_background(page)
        text_align = fitz.TEXT_ALIGN_CENTER if centered else fitz.TEXT_ALIGN_LEFT

        header_h = 0.0
        if style.logo_path and os.path.exists(style.logo_path):
            page.insert_image(fitz.Rect(margin, 24, margin + 70, 54),
                              filename=style.logo_path, keep_proportion=True)
            header_h = 40
        elif style.title:
            page.insert_textbox(fitz.Rect(margin, 26, PAGE_W - margin, 26 + base * 2.2),
                                style.title, fontsize=base * 0.85, color=grey,
                                align=text_align, **faces.reg)
            header_h = 26

        # image area: top portion of the page, scaled by preference
        img_area_h = (PAGE_H * 0.52) * max(0.5, min(style.image_scale, 1.25))
        img_top = margin + header_h
        img_rect = fitz.Rect(margin, img_top, PAGE_W - margin, img_top + img_area_h)
        img_file = os.path.join(media_dir, os.path.basename(art.get("image_path") or ""))
        drawn_bottom = img_top
        if art.get("image_path") and os.path.exists(img_file):
            page.insert_image(img_rect, filename=img_file, keep_proportion=True)
            # compute the actually-drawn rect to place the caption right below
            try:
                pix = fitz.Pixmap(img_file)
                scale = min(img_rect.width / pix.width, img_rect.height / pix.height)
                drawn_h = pix.height * scale
                drawn_bottom = img_top + (img_rect.height + drawn_h) / 2 if centered else img_top + drawn_h
                # insert_image centers within rect; bottom of drawn image:
                drawn_bottom = img_top + (img_rect.height - drawn_h) / 2 + drawn_h
                pix = None
            except Exception:
                drawn_bottom = img_rect.y1
        else:
            drawn_bottom = img_top + 40

        # ---- caption block ----
        y = drawn_bottom + 28
        x0, x1 = margin, PAGE_W - margin

        def line(txt, face, size, color, dy=None):
            nonlocal y
            if not txt:
                return
            h = (dy or size + 6)
            # generous box height: insert_textbox silently drops text that
            # doesn't fully fit, and bold faces need extra room
            page.insert_textbox(fitz.Rect(x0, y, x1, y + h + 14), txt,
                                fontsize=size, color=color, align=text_align, **face)
            y += h

        # the whole caption uses the advisor's caption-text color at full
        # strength — no auto-muting, so the color dial does what it says
        line(art.get("artist", ""), faces.bold, heading, accent, heading + 6)
        title_year = art.get("title", "")
        if art.get("year"):
            title_year = f"{title_year}, {art['year']}" if title_year else art["year"]
        line(title_year, faces.italic, base * 1.15, body, base * 1.15 + 5.5)
        line(art.get("medium", ""), faces.reg, base, body, base + 5)
        dims_ed = " · ".join(x for x in [art.get("dimensions", ""), art.get("edition", "")] if x)
        line(dims_ed, faces.reg, base, body, base + 5)
        if style.show_gallery and art.get("gallery"):
            line(art["gallery"], faces.reg, base, body, base + 5)
        if style.show_price and art.get("price"):
            y += 4
            line(art["price"], faces.bold, base * 1.1, accent, base * 1.1 + 6)

        note = (style.notes or {}).get(str(art.get("id")))
        if note:
            y += 6
            page.insert_textbox(fitz.Rect(x0, y, x1, y + 60), note,
                                fontsize=base * 0.95, color=body,
                                align=text_align, **faces.italic)
            y += 50

        if style.show_description and art.get("description"):
            desc = art["description"][:1200]
            page.insert_textbox(fitz.Rect(x0, y + 8, x1, PAGE_H - margin - 20), desc,
                                fontsize=base * 0.9, color=body,
                                align=fitz.TEXT_ALIGN_LEFT, **faces.reg)

        # footer
        if style.advisor_name:
            page.insert_textbox(
                fitz.Rect(margin, PAGE_H - 40, PAGE_W - margin, PAGE_H - 22),
                style.advisor_name, fontsize=base * 0.8, color=grey, align=text_align, **faces.reg)

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()
