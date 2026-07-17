"""Generate sample gallery PDFs that mimic the two real-world formats:

1. simple: one artwork per page (image + caption + price)
2. complex: lead page per artwork, then detail/scale pages and an artist bio

Usage: python scripts/make_sample_pdfs.py [output_dir]
"""

import random
import sys

import fitz

W, H = fitz.paper_size("a4")

ARTISTS = [
    ("MARIA KOVACS", "b. 1985, Budapest"),
    ("James Okafor", "b. 1978, Lagos"),
    ("Yuki Tanaka", "b. 1990, Osaka"),
    ("CLAIRE DUBOIS", "b. 1982, Lyon"),
    ("Andres Molina", "b. 1975, Bogota"),
    ("Sofia Lindqvist", "b. 1988, Malmo"),
]
TITLES = ["Untitled (Field Study)", "Night Garden II", "Chromatic Drift",
          "The Long Afternoon", "Vessel No. 7", "Interior with Two Figures",
          "Signal Fade", "Low Tide", "Meridian", "Second Nature"]
MEDIUMS = ["Oil on canvas", "Acrylic and collage on linen", "Bronze with patina",
           "Archival pigment print", "Watercolor on paper", "Glazed ceramic"]
BIO = ("The artist's practice examines the porous boundary between landscape and memory. "
       "Recent solo exhibitions include institutional presentations in Vienna and Mexico City. "
       "Work is held in several notable private and public collections. This new body of work "
       "continues the artist's investigation of surface, repetition, and afterimage, developed "
       "during a year-long residency. Each composition begins from direct observation before "
       "being reworked from memory in the studio over many months.")


def draw_fake_artwork(page, rect, seed):
    random.seed(seed)
    base = [random.random() * 0.6 + 0.2 for _ in range(3)]
    page.draw_rect(rect, color=None, fill=base)
    for _ in range(14):
        x0 = rect.x0 + random.random() * rect.width * 0.8
        y0 = rect.y0 + random.random() * rect.height * 0.8
        w = random.random() * rect.width * 0.35
        h = random.random() * rect.height * 0.35
        col = [min(1, max(0, c + random.uniform(-0.35, 0.35))) for c in base]
        if random.random() < 0.5:
            page.draw_rect(fitz.Rect(x0, y0, x0 + w, y0 + h), color=None, fill=col)
        else:
            page.draw_oval(fitz.Rect(x0, y0, x0 + w, y0 + h), color=None, fill=col)


def image_from_drawing(seed, w=900, h=1100):
    """Rasterize a fake painting into PNG bytes so pages contain real images."""
    tmp = fitz.open()
    p = tmp.new_page(width=w * 0.75, height=h * 0.75)
    draw_fake_artwork(p, fitz.Rect(0, 0, w * 0.75, h * 0.75), seed)
    pix = p.get_pixmap(dpi=96)
    data = pix.tobytes("png")
    tmp.close()
    return data


def caption_lines(artist, title, year, medium, dims, price, edition=None):
    lines = [artist[0], f"{title}, {year}", medium, dims]
    if edition:
        lines.append(edition)
    lines.append(price)
    return lines


def make_simple(path, gallery="Halcyon Gallery Projects"):
    doc = fitz.open()
    # cover
    page = doc.new_page(width=W, height=H)
    page.insert_textbox(fitz.Rect(60, 300, W - 60, 340), gallery,
                        fontname="tibo", fontsize=22, align=1)
    page.insert_textbox(fitz.Rect(60, 345, W - 60, 380), "Available Works — Spring 2026",
                        fontname="tiit", fontsize=13, align=1, color=(0.4, 0.4, 0.4))
    for i in range(6):
        artist = ARTISTS[i % len(ARTISTS)]
        title = TITLES[i % len(TITLES)]
        year = str(random.choice([2023, 2024, 2025, 2026]))
        medium = MEDIUMS[i % len(MEDIUMS)]
        dims = f"{random.randint(40, 200)} x {random.randint(40, 160)} cm"
        price = f"$ {random.choice([18, 24, 32, 45, 60, 85])},000"
        page = doc.new_page(width=W, height=H)
        img = image_from_drawing(i * 7 + 1)
        page.insert_image(fitz.Rect(70, 60, W - 70, 500), stream=img, keep_proportion=True)
        y = 540
        for j, line in enumerate(caption_lines(artist, title, year, medium, dims, price)):
            font = "hebo" if j == 0 else ("heit" if j == 1 else "helv")
            size = 12 if j < 2 else 10
            page.insert_textbox(fitz.Rect(70, y, W - 70, y + 30), line,
                                fontname=font, fontsize=size)
            y += 18
    doc.save(path)
    doc.close()


def make_complex(path, gallery="Galerie Meridian"):
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_textbox(fitz.Rect(60, 280, W - 60, 330), gallery,
                        fontname="tibo", fontsize=24, align=1)
    page.insert_textbox(fitz.Rect(60, 335, W - 60, 390),
                        "Art Basel — Booth C12\nPreview Selection",
                        fontname="tiit", fontsize=12, align=1, color=(0.4, 0.4, 0.4))
    for i in range(3):
        artist = ARTISTS[(i + 3) % len(ARTISTS)]
        title = TITLES[(i + 4) % len(TITLES)]
        year = str(random.choice([2024, 2025, 2026]))
        medium = MEDIUMS[(i + 2) % len(MEDIUMS)]
        dims = f"{random.randint(100, 260)} x {random.randint(80, 200)} cm"
        price = f"€ {random.choice([35, 48, 65, 120])},000"
        edition = "Edition of 3 + 2 APs" if i == 2 else None

        # lead page: image + caption
        page = doc.new_page(width=W, height=H)
        img = image_from_drawing(100 + i * 13)
        page.insert_image(fitz.Rect(80, 70, W - 80, 470), stream=img, keep_proportion=True)
        y = 510
        for j, line in enumerate(caption_lines(artist, title, year, medium, dims, price, edition)):
            font = "tibo" if j == 0 else ("tiit" if j == 1 else "tiro")
            page.insert_textbox(fitz.Rect(80, y, W - 80, y + 28), line,
                                fontname=font, fontsize=11 if j < 2 else 9.5)
            y += 16

        # detail page: two close-ups, minimal text
        page = doc.new_page(width=W, height=H)
        page.insert_image(fitz.Rect(60, 60, W / 2 - 10, 420),
                          stream=image_from_drawing(200 + i * 17), keep_proportion=True)
        page.insert_image(fitz.Rect(W / 2 + 10, 60, W - 60, 420),
                          stream=image_from_drawing(300 + i * 19), keep_proportion=True)
        page.insert_textbox(fitz.Rect(60, 440, W - 60, 460), "Detail views",
                            fontname="tiit", fontsize=9, color=(0.5, 0.5, 0.5))

        # bio page: text only
        page = doc.new_page(width=W, height=H)
        page.insert_textbox(fitz.Rect(70, 80, W - 70, 120), artist[0].title(),
                            fontname="tibo", fontsize=14)
        page.insert_textbox(fitz.Rect(70, 120, W - 70, 600), BIO,
                            fontname="tiro", fontsize=10.5)
    doc.save(path)
    doc.close()


if __name__ == "__main__":
    import os
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    make_simple(os.path.join(out, "sample-gallery-simple.pdf"))
    make_complex(os.path.join(out, "sample-gallery-complex.pdf"))
    print(f"Wrote sample PDFs to {out}")
