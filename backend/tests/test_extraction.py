import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

import fitz

from app.services.extraction import extract_artworks, guess_gallery_name, parse_caption
from make_sample_pdfs import make_complex, make_simple


def test_parse_caption_simple():
    text = "MARIA KOVACS\nNight Garden II, 2024\nOil on canvas\n120 x 90 cm\n$ 45,000\n"
    fields = parse_caption(text)
    assert fields["artist"] == "Maria Kovacs"
    assert fields["title"] == "Night Garden II"
    assert fields["year"] == "2024"
    assert fields["medium"] == "Oil on canvas"
    assert fields["dimensions"] == "120 x 90 cm"
    assert "45,000" in fields["price"]


def test_parse_caption_with_edition_and_euro():
    text = "Yuki Tanaka\nSignal Fade, 2025\nArchival pigment print\n100 x 80 cm\nEdition of 3 + 2 APs\n€ 35,000\n"
    fields = parse_caption(text)
    assert fields["artist"] == "Yuki Tanaka"
    assert "Edition of 3" in fields["edition"]
    assert "35,000" in fields["price"]


def test_parse_caption_ignores_contact_noise():
    text = ("MARIA KOVACS\nNight Garden II, 2024\nOil on canvas\n120 x 90 cm\n$ 45,000\n"
            "For enquiries: sales@gallery.com\nT. +44 20 7946 0000\nwww.gallery.com\n"
            "© 2026 The Gallery. Courtesy of the artist\n")
    fields = parse_caption(text)
    assert fields["artist"] == "Maria Kovacs"
    assert fields["title"] == "Night Garden II"
    assert "@" not in fields["title"] and "©" not in fields["title"]
    assert "www" not in fields["medium"]


def test_gallery_name_from_repeated_footer(tmp_path):
    """The gallery's name repeated in a page footer beats the filename guess."""
    pdf = tmp_path / "availability_list_final_v2.pdf"
    doc = fitz.open()
    for i in range(5):
        page = doc.new_page(width=595, height=842)
        page.insert_textbox(fitz.Rect(60, 100, 535, 400),
                            f"Artist Name\nWork {i}, 2025\nOil on canvas\n100 x 80 cm\n$ 10,000",
                            fontname="helv", fontsize=11)
        page.insert_textbox(fitz.Rect(60, 800, 535, 830), "Galerie Lindenstrasse",
                            fontname="helv", fontsize=8)
    doc.save(str(pdf))
    doc.close()
    assert guess_gallery_name(str(pdf)) == "Galerie Lindenstrasse"


def test_extract_simple_pdf(tmp_path):
    pdf = tmp_path / "simple.pdf"
    media = tmp_path / "media"
    media.mkdir()
    make_simple(str(pdf))
    artworks = extract_artworks(str(pdf), str(media))
    # 6 artwork pages; the cover page must not become an artwork
    assert len(artworks) == 6
    for art in artworks:
        assert art.image_path, "every artwork should have a primary image"
        assert art.price
        assert art.artist
        assert os.path.exists(media / art.image_path)


def test_extract_complex_pdf_groups_pages(tmp_path):
    pdf = tmp_path / "complex.pdf"
    media = tmp_path / "media"
    media.mkdir()
    make_complex(str(pdf))
    artworks = extract_artworks(str(pdf), str(media))
    # 3 artworks, each spanning lead + detail + bio pages
    assert len(artworks) == 3
    for art in artworks:
        assert art.image_path
        assert len(art.detail_image_paths) >= 2, "detail shots should attach to the lead artwork"
        assert art.description, "bio page text should attach as description"
        assert len(art.pages) >= 2
