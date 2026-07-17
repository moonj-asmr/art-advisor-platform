import json
import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

from app.services.llm_extraction import extract_artworks_ai
from make_sample_pdfs import make_complex


def _fake_response(payload):
    return SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="text", text=json.dumps(payload))],
    )


def test_ai_extraction_maps_pages_to_images(tmp_path):
    pdf = tmp_path / "complex.pdf"
    media = tmp_path / "media"
    media.mkdir()
    make_complex(str(pdf))  # cover + 3 artworks x (lead, detail, bio) = 10 pages

    payload = {
        "gallery": "Galerie Meridian",
        "artworks": [
            {"artist": "Claire Dubois", "title": "The Long Afternoon", "year": "2025",
             "medium": "Oil on panel", "dimensions": "120 x 90 cm", "price": "€ 48,000",
             "edition": "", "description": "Painted from memory.", "pages": [2, 3, 4]},
            {"artist": "Andres Molina", "title": "Vessel No. 7", "year": "2026",
             "medium": "Glazed ceramic", "dimensions": "58 x 40 cm", "price": "€ 65,000",
             "edition": "", "description": "", "pages": [5, 6, 7]},
        ],
    }

    with patch("app.services.llm_extraction.anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_response(payload)
        artworks, gallery = extract_artworks_ai(str(pdf), str(media), "meridian.pdf")

        # this sample is >24MB, so it must go as page-delimited text;
        # small PDFs go as a document block (covered below)
        kwargs = MockClient.return_value.messages.create.call_args.kwargs
        blocks = kwargs["messages"][0]["content"]
        assert blocks[0]["type"] == "text"
        assert "--- PAGE 1 ---" in blocks[0]["text"]
        assert kwargs["output_config"]["format"]["type"] == "json_schema"

    assert gallery == "Galerie Meridian"
    assert len(artworks) == 2
    first = artworks[0]
    assert first.artist == "Claire Dubois"
    assert first.pages == [2, 3, 4]
    # lead page image becomes the card image; detail-page images attach behind it
    assert first.image_path
    assert len(first.detail_image_paths) >= 2
    assert os.path.exists(media / first.image_path)


def test_ai_extraction_renders_page_when_no_raster_images(tmp_path):
    """Vector-only pages still get a card image via page rendering."""
    import fitz

    pdf = tmp_path / "vector.pdf"
    media = tmp_path / "media"
    media.mkdir()
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.draw_rect(fitz.Rect(80, 60, 515, 420), color=None, fill=(0.6, 0.3, 0.2))
    page.insert_textbox(fitz.Rect(80, 450, 515, 560), "A Artist\nWork, 2026\nOil\n10 x 10 cm\n$1,000",
                        fontname="helv", fontsize=11)
    doc.save(str(pdf))
    doc.close()

    payload = {"gallery": "G", "artworks": [
        {"artist": "A Artist", "title": "Work", "year": "2026", "medium": "Oil",
         "dimensions": "10 x 10 cm", "price": "$1,000", "edition": "", "description": "",
         "pages": [1]},
    ]}
    with patch("app.services.llm_extraction.anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_response(payload)
        artworks, _ = extract_artworks_ai(str(pdf), str(media))
        # a small PDF is sent whole as a document block
        blocks = MockClient.return_value.messages.create.call_args.kwargs["messages"][0]["content"]
        assert blocks[0]["type"] == "document"
    assert artworks[0].image_path.endswith(".png")
    assert os.path.exists(media / artworks[0].image_path)


def test_upload_falls_back_to_heuristics_when_ai_fails(tmp_path, monkeypatch):
    """A dead API key must not break uploads — heuristics take over."""
    import tempfile

    os.environ.setdefault("ART_ADVISOR_DATA", tempfile.mkdtemp(prefix="fallback-test-"))
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-invalid")
    with patch("app.routers.uploads.extract_artworks_ai", side_effect=RuntimeError("api down")):
        client = TestClient(app)
        pdf = tmp_path / "g.pdf"
        make_complex(str(pdf))
        with open(pdf, "rb") as f:
            r = client.post("/api/uploads", files={"file": ("g.pdf", f, "application/pdf")})
    assert r.status_code == 200, r.text
    assert r.json()["artworks_found"] == 3
    assert r.json()["engine"] == "basic"
