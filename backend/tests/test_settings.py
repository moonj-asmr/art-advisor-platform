import os
import sys
import tempfile

os.environ.setdefault("ART_ADVISOR_DATA", tempfile.mkdtemp(prefix="settings-test-"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

import fitz
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_settings_round_trip():
    r = client.put("/api/settings", json={
        "email": "advisor@example.com",
        "advisory_name": "Britt Art Advisory",
        "advisory_address": "12 Rue de Seine, 75006 Paris",
        "align": "center",
        "font": "sans",
    })
    assert r.status_code == 200
    got = client.get("/api/settings").json()
    assert got["email"] == "advisor@example.com"
    assert got["advisory_name"] == "Britt Art Advisory"
    assert got["align"] == "center"
    assert got["font"] == "sans"


def test_settings_logo_upload(tmp_path):
    logo_doc = fitz.open()
    p = logo_doc.new_page(width=200, height=80)
    p.insert_textbox(fitz.Rect(10, 20, 190, 70), "LOGO", fontsize=30, fontname="hebo")
    logo = tmp_path / "logo.png"
    p.get_pixmap().save(str(logo))

    with open(logo, "rb") as f:
        r = client.post("/api/settings/logo", files={"file": ("logo.png", f, "image/png")})
    assert r.status_code == 200
    assert client.get("/api/settings").json()["logo_media"] == r.json()["logo_media"]
    assert client.get(r.json()["logo_url"]).status_code == 200


def test_settings_preview_renders_pdf_with_house_style():
    client.put("/api/settings", json={"advisory_name": "Britt Art Advisory", "align": "left", "font": "serif"})
    r = client.get("/api/settings/preview")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    doc = fitz.open(stream=r.content, filetype="pdf")
    assert doc.page_count >= 2  # cover + at least one artwork page
    cover = doc[0].get_text()
    assert "Style Preview" in cover
    assert "Britt Art Advisory" in cover
    doc.close()


def test_settings_preview_images_for_in_app_viewer():
    r = client.get("/api/settings/preview/images")
    assert r.status_code == 200
    pages = r.json()["pages"]
    assert len(pages) >= 2  # cover + at least one artwork page
    assert all(p.startswith("data:image/png;base64,") for p in pages)
