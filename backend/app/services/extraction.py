"""Turn a gallery PDF into structured artwork records.

Gallery PDFs are not uniform. The two dominant shapes are:

1. One artwork per page: image + caption (artist, title, year, medium,
   dimensions) + price.
2. One artwork across several pages: a lead page with image + caption,
   followed by detail shots / installation views / scale shots, sometimes
   an artist bio or a text about the work.

The grouping heuristic: a page that carries a caption-like text block
(price, or dimensions + year) STARTS a new artwork. Pages after it that
have images but no new caption ATTACH to the current artwork as detail
images; text-only pages attach as description. Cover / contact pages
(no usable image, no caption) are skipped.
"""

import os
import re
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

import fitz  # PyMuPDF

# --- caption field patterns -------------------------------------------------

PRICE_RE = re.compile(
    r"(?:(?:price|prix)\s*:?\s*)?"
    r"(?:USD|EUR|GBP|CHF|HKD|US\$|€|\$|£)\s?[\d]{1,3}(?:[,.\s]\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP|CHF|HKD)?",
    re.IGNORECASE,
)
DIMENSIONS_RE = re.compile(
    r"\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:cm|in|inches|mm)",
    re.IGNORECASE,
)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b")
EDITION_RE = re.compile(
    r"(?:edition(?:\s+of)?\s+\d+(?:\s*\+\s*\d+\s*APs?)?|ed\.\s*(?:of\s*)?\d+(?:/\d+)?|\d+\s*/\s*\d+\s*(?:\+\s*\d+\s*APs?)?)",
    re.IGNORECASE,
)
MEDIUM_WORDS = re.compile(
    r"\b(oil|acrylic|canvas|linen|panel|paper|bronze|steel|marble|wood|ceramic|glass|"
    r"watercolou?r|gouache|ink|graphite|charcoal|pastel|collage|print|lithograph|etching|"
    r"screenprint|silkscreen|c-print|photograph|gelatin|archival|pigment|mixed media|"
    r"resin|aluminium|aluminum|neon|video|installation|tapestry|textile|embroidery)\b",
    re.IGNORECASE,
)
NOISE_LINE = re.compile(
    r"^(page \d+|\d+|www\..*|.*@.*\..*|\+?[\d\s().-]{7,}|(available works|price list|"
    r"presentation|preview|booth\s+\w+|for sale|enquiries?|inquiries?|contact|"
    r"all prices|prices? (are|include|exclude|do not)|courtesy( of)?|photo(graph)?s?\s*(by|:)|"
    r"©|copyright|vat |framed dimensions|t[.:]\s|tel[.:]?\s|fax[.:]?\s).*)$",
    re.IGNORECASE,
)
CONTACT_RE = re.compile(r"(@|www\.|https?://|\btel\b|\bfax\b|\+\d[\d\s().-]{6,})", re.IGNORECASE)


@dataclass
class ParsedArtwork:
    artist: str = ""
    title: str = ""
    year: str = ""
    medium: str = ""
    dimensions: str = ""
    price: str = ""
    edition: str = ""
    description: str = ""
    image_path: str = ""
    detail_image_paths: List[str] = field(default_factory=list)
    raw_text: str = ""
    pages: List[int] = field(default_factory=list)


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip(" \t,;-")


def parse_caption(text: str) -> dict:
    """Pull structured fields out of a caption-like text block."""
    fields = {"artist": "", "title": "", "year": "", "medium": "",
              "dimensions": "", "price": "", "edition": ""}

    m = PRICE_RE.search(text)
    if m and re.search(r"[€$£]|USD|EUR|GBP|CHF|HKD", m.group(0)):
        fields["price"] = _clean(re.sub(r"^(price|prix)\s*:?\s*", "", m.group(0), flags=re.I))
    m = DIMENSIONS_RE.search(text)
    if m:
        fields["dimensions"] = _clean(m.group(0))
    m = EDITION_RE.search(text)
    if m:
        fields["edition"] = _clean(m.group(0))

    lines = [_clean(l) for l in text.split("\n")]
    lines = [l for l in lines if l and not NOISE_LINE.match(l)]

    # Artist: first short line that isn't a caption field. Galleries usually
    # lead with the artist's name, often in caps or "First Last (b. 1980)".
    body_lines = []
    for line in lines:
        if PRICE_RE.search(line) and re.search(r"[€$£]|USD|EUR|GBP", line):
            continue
        body_lines.append(line)

    def looks_like_name(l: str) -> bool:
        stripped = re.sub(r"\s*\(b\.\s*\d{4}.*?\)", "", l)
        words = stripped.split()
        if not (1 <= len(words) <= 5):
            return False
        if DIMENSIONS_RE.search(l) or MEDIUM_WORDS.search(l):
            return False
        if YEAR_RE.fullmatch(stripped):
            return False
        # names don't carry digits or contact fragments
        if re.search(r"\d", stripped) or CONTACT_RE.search(l):
            return False
        return all(w[:1].isupper() or w.isupper() or "-" in w for w in words if w.isalpha() or "-" in w)

    for line in body_lines:
        if looks_like_name(line):
            fields["artist"] = re.sub(r"\s*\(b\.\s*\d{4}.*?\)", "", line).title() \
                if line.isupper() else re.sub(r"\s*\(b\.\s*\d{4}.*?\)", "", line)
            body_lines = [l for l in body_lines if l != line]
            break

    # Title: often italic "Title, 2023" — take the line carrying a year that
    # isn't the dimensions/medium line, else first remaining line.
    for line in body_lines:
        if DIMENSIONS_RE.search(line):
            continue
        ym = YEAR_RE.search(line)
        if ym and not MEDIUM_WORDS.search(line):
            fields["year"] = _clean(ym.group(0))
            title = YEAR_RE.sub("", line)
            fields["title"] = _clean(title)
            body_lines = [l for l in body_lines if l != line]
            break
    if not fields["title"]:
        for line in body_lines:
            if DIMENSIONS_RE.search(line) or MEDIUM_WORDS.search(line):
                continue
            if CONTACT_RE.search(line) or len(line) > 120:
                continue
            fields["title"] = line
            body_lines = [l for l in body_lines if l != line]
            break
    if len(fields["title"]) > 120:
        fields["title"] = fields["title"][:117] + "…"

    # Medium: line with material words (strip dims/edition if same line).
    for line in body_lines:
        if MEDIUM_WORDS.search(line):
            medium = DIMENSIONS_RE.sub("", line)
            medium = EDITION_RE.sub("", medium)
            if not fields["year"]:
                ym = YEAR_RE.search(medium)
                if ym:
                    fields["year"] = ym.group(0)
            medium = YEAR_RE.sub("", medium)
            fields["medium"] = _clean(medium)
            break

    return fields


def _caption_score(text: str) -> int:
    """How strongly a page's text looks like an artwork caption."""
    score = 0
    if PRICE_RE.search(text) and re.search(r"[€$£]|USD|EUR|GBP|CHF|HKD", text):
        score += 3
    if DIMENSIONS_RE.search(text):
        score += 2
    if MEDIUM_WORDS.search(text):
        score += 1
    if YEAR_RE.search(text):
        score += 1
    return score


def _extract_page_images(doc: fitz.Document, page: fitz.Page, media_dir: str, min_side: int = 120):
    """Save meaningful raster images from a page; return relative paths, largest first."""
    out = []
    seen = set()
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.width < min_side or pix.height < min_side:
                continue
            if pix.colorspace and pix.colorspace.n > 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            name = f"{uuid.uuid4().hex}.png"
            pix.save(os.path.join(media_dir, name))
            out.append((pix.width * pix.height, name))
            pix = None
        except Exception:
            continue
    out.sort(reverse=True)
    return [name for _, name in out]


def extract_artworks(pdf_path: str, media_dir: str) -> List[ParsedArtwork]:
    doc = fitz.open(pdf_path)
    artworks: List[ParsedArtwork] = []
    current: Optional[ParsedArtwork] = None

    for page_index, page in enumerate(doc):
        text = page.get_text("text")
        images = _extract_page_images(doc, page, media_dir)
        score = _caption_score(text)
        word_count = len(text.split())

        starts_new = score >= 3 or (score >= 2 and images)

        if starts_new:
            if current:
                artworks.append(current)
            fields = parse_caption(text)
            current = ParsedArtwork(**fields)
            current.raw_text = text.strip()
            current.pages = [page_index + 1]
            if images:
                current.image_path = images[0]
                current.detail_image_paths = images[1:]
        elif current is not None:
            # Continuation page: details, installation views, or artist text.
            if images:
                current.detail_image_paths.extend(images)
                if not current.image_path:
                    current.image_path = current.detail_image_paths.pop(0)
                current.pages.append(page_index + 1)
            if word_count > 40 and score <= 1 and not _is_contact_page(text):
                para = text.strip()
                current.description = (current.description + "\n\n" + para).strip()
                if page_index + 1 not in current.pages:
                    current.pages.append(page_index + 1)
            elif word_count:
                current.raw_text += "\n" + text.strip()
        # else: cover/contact page before any artwork — skip.

    if current:
        artworks.append(current)
    doc.close()

    # Keep only entries that have at least an image or a caption worth showing.
    return [a for a in artworks if a.image_path or a.title or a.artist]


def _is_contact_page(text: str) -> bool:
    """Contact/imprint pages are dense with emails, urls, phone numbers."""
    lines = [l for l in (s.strip() for s in text.split("\n")) if l]
    if not lines:
        return False
    contact = sum(1 for l in lines if CONTACT_RE.search(l))
    return contact >= 2 and contact >= len(lines) * 0.3


GALLERY_WORD = re.compile(r"\b(gallery|galerie|galleria|galería|fine art|projects?|kunsthalle)\b", re.I)


def guess_gallery_name(pdf_path: str) -> str:
    """Best-effort gallery name.

    Galleries brand their PDFs by repeating their name in a header or footer
    on every page — that repetition is the strongest signal. Fall back to a
    gallery-ish line on the cover, then to the filename.
    """
    doc = fitz.open(pdf_path)
    try:
        pages = [doc[i].get_text("text") for i in range(doc.page_count)]
    finally:
        doc.close()

    from collections import Counter

    counter: Counter = Counter()
    for text in pages:
        seen = set()
        for line in text.split("\n"):
            line = _clean(line)
            if not line or len(line) > 60 or line.lower() in seen:
                continue
            if PRICE_RE.search(line) or DIMENSIONS_RE.search(line) or CONTACT_RE.search(line):
                continue
            if re.fullmatch(r"[\d\s/|.–-]+", line):
                continue
            seen.add(line.lower())
            counter[line] += 1

    if len(pages) >= 3:
        # a repeated line that names a gallery wins outright
        for line, count in counter.most_common(12):
            if count >= max(2, len(pages) // 2) and GALLERY_WORD.search(line):
                return line

    for line in (pages[0].split("\n") if pages else []):
        line = _clean(line)
        if GALLERY_WORD.search(line) and len(line) < 60:
            return line

    if len(pages) >= 4:
        # branding repeated on nearly every page, even without a gallery word
        for line, count in counter.most_common(5):
            if count >= len(pages) * 0.8:
                return line

    base = os.path.splitext(os.path.basename(pdf_path))[0]
    return _clean(re.sub(r"[_-]+", " ", base))[:60]
