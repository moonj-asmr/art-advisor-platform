import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

from app.services.extraction import extract_artworks, parse_caption
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
