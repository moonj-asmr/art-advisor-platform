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


@dataclass
class StyleOptions:
    title: str = ""                # cover / header title, e.g. "Art Basel Selections"
    client_name: str = ""          # e.g. "Prepared for Alice Chen"
    advisor_name: str = ""         # footer credit
    align: str = "left"            # left | center
    image_scale: float = 1.0       # 0.6 (intimate) .. 1.2 (full-bleed-ish)
    show_price: bool = True
    show_gallery: bool = True
    show_description: bool = False
    font: str = "serif"            # serif | sans
    accent_hex: str = "#1a1a1a"
    logo_path: Optional[str] = None
    notes: dict = field(default_factory=dict)  # artwork_id -> advisor note


def _hex_to_rgb(h: str):
    h = h.lstrip("#")
    if len(h) != 6:
        return (0.1, 0.1, 0.1)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _fonts(style: StyleOptions):
    if style.font == "sans":
        return "helv", "hebo", "heit"  # regular, bold, italic
    return "tiro", "tibo", "tiit"


def build_pdf(artworks: List[dict], media_dir: str, style: StyleOptions) -> bytes:
    doc = fitz.open()
    accent = _hex_to_rgb(style.accent_hex)
    grey = (0.45, 0.45, 0.45)
    reg, bold, italic = _fonts(style)
    margin = 56.0
    centered = style.align == "center"

    # ---- cover page ----
    if style.title or style.client_name:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        y = PAGE_H * 0.42
        if style.logo_path and os.path.exists(style.logo_path):
            rect = fitz.Rect(PAGE_W / 2 - 60, y - 150, PAGE_W / 2 + 60, y - 60)
            page.insert_image(rect, filename=style.logo_path, keep_proportion=True)
        if style.title:
            page.insert_textbox(
                fitz.Rect(margin, y, PAGE_W - margin, y + 60),
                style.title, fontname=bold, fontsize=24, color=accent, align=fitz.TEXT_ALIGN_CENTER,
            )
            y += 66
        if style.client_name:
            page.insert_textbox(
                fitz.Rect(margin, y, PAGE_W - margin, y + 30),
                f"Prepared for {style.client_name}", fontname=italic, fontsize=13,
                color=grey, align=fitz.TEXT_ALIGN_CENTER,
            )
        if style.advisor_name:
            page.insert_textbox(
                fitz.Rect(margin, PAGE_H - margin - 20, PAGE_W - margin, PAGE_H - margin),
                style.advisor_name, fontname=reg, fontsize=10, color=grey,
                align=fitz.TEXT_ALIGN_CENTER,
            )

    # ---- artwork pages ----
    for art in artworks:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        text_align = fitz.TEXT_ALIGN_CENTER if centered else fitz.TEXT_ALIGN_LEFT

        header_h = 0.0
        if style.logo_path and os.path.exists(style.logo_path):
            page.insert_image(fitz.Rect(margin, 24, margin + 70, 54),
                              filename=style.logo_path, keep_proportion=True)
            header_h = 40
        elif style.title:
            page.insert_textbox(fitz.Rect(margin, 26, PAGE_W - margin, 44),
                                style.title, fontname=reg, fontsize=8.5, color=grey,
                                align=text_align)
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

        def line(txt, fname, size, color, dy=None):
            nonlocal y
            if not txt:
                return
            h = (dy or size + 6)
            # generous box height: insert_textbox silently drops text that
            # doesn't fully fit, and bold faces need extra room
            page.insert_textbox(fitz.Rect(x0, y, x1, y + h + 14), txt,
                                fontname=fname, fontsize=size, color=color, align=text_align)
            y += h

        line(art.get("artist", ""), bold, 13, accent, 19)
        title_year = art.get("title", "")
        if art.get("year"):
            title_year = f"{title_year}, {art['year']}" if title_year else art["year"]
        line(title_year, italic, 11.5, (0.15, 0.15, 0.15), 17)
        line(art.get("medium", ""), reg, 10, grey, 15)
        dims_ed = " · ".join(x for x in [art.get("dimensions", ""), art.get("edition", "")] if x)
        line(dims_ed, reg, 10, grey, 15)
        if style.show_gallery and art.get("gallery"):
            line(art["gallery"], reg, 10, grey, 15)
        if style.show_price and art.get("price"):
            y += 4
            line(art["price"], bold, 11, accent, 17)

        note = (style.notes or {}).get(str(art.get("id")))
        if note:
            y += 6
            page.insert_textbox(fitz.Rect(x0, y, x1, y + 60), note,
                                fontname=italic, fontsize=9.5, color=(0.3, 0.3, 0.3),
                                align=text_align)
            y += 50

        if style.show_description and art.get("description"):
            desc = art["description"][:1200]
            page.insert_textbox(fitz.Rect(x0, y + 8, x1, PAGE_H - margin - 20), desc,
                                fontname=reg, fontsize=9, color=(0.25, 0.25, 0.25),
                                align=fitz.TEXT_ALIGN_LEFT)

        # footer
        if style.advisor_name:
            page.insert_textbox(
                fitz.Rect(margin, PAGE_H - 40, PAGE_W - margin, PAGE_H - 22),
                style.advisor_name, fontname=reg, fontsize=8, color=grey, align=text_align)

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()
