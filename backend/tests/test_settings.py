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


def test_login_first_use_creates_account_then_verifies():
    # first login registers the credentials
    r = client.post("/api/settings/login", json={"email": "Advisor@Example.com", "password": "hunter2"})
    assert r.status_code == 200 and r.json()["created"] is True
    assert client.get("/api/settings").json()["has_password"] is True

    # correct password logs in, wrong one is rejected
    ok = client.post("/api/settings/login", json={"email": "advisor@example.com", "password": "hunter2"})
    assert ok.status_code == 200 and ok.json()["created"] is False
    bad = client.post("/api/settings/login", json={"email": "advisor@example.com", "password": "nope"})
    assert bad.status_code == 401
    wrong_email = client.post("/api/settings/login", json={"email": "other@example.com", "password": "hunter2"})
    assert wrong_email.status_code == 401


def test_style_dials_apply_to_preview():
    r = client.put("/api/settings", json={
        "background_hex": "#e8f2e8",  # light green
        "text_hex": "#333333",
        "base_font_pt": 12.0,
        "heading_font_pt": 16.0,
        "font": "garamond",
    })
    assert r.status_code == 200
    got = client.get("/api/settings").json()
    assert got["background_hex"] == "#e8f2e8" and got["base_font_pt"] == 12.0
    assert {"key": "garamond", "label": "EB Garamond"} in got["font_options"]

    r = client.get("/api/settings/preview")
    assert r.status_code == 200
    doc = fitz.open(stream=r.content, filetype="pdf")
    pix = doc[0].get_pixmap()
    # top-left corner carries the light-green page background
    r_, g_, b_ = pix.pixel(2, 2)
    assert g_ > r_ and g_ > b_ and g_ > 220, (r_, g_, b_)
    assert doc[1].get_text().strip(), "artwork page must still render text with the TTF family"
    doc.close()
    # reset so later tests keep a white background
    client.put("/api/settings", json={"background_hex": "#ffffff", "font": "serif",
                                      "base_font_pt": 10.0, "heading_font_pt": 13.0})


def test_settings_preview_images_for_in_app_viewer():
    r = client.get("/api/settings/preview/images")
    assert r.status_code == 200
    pages = r.json()["pages"]
    assert len(pages) >= 2  # cover + at least one artwork page
    assert all(p.startswith("data:image/png;base64,") for p in pages)


def test_align_slider_and_price_color_round_trip():
    r = client.put("/api/settings", json={"align_x": 1.0, "price_hex": "#aa0000"})
    assert r.status_code == 200
    got = client.get("/api/settings").json()
    assert got["align_x"] == 1.0 and got["price_hex"] == "#aa0000"

    # sliding right must actually move the caption block right
    def max_word_x(ax: float) -> float:
        client.put("/api/settings", json={"align_x": ax})
        resp = client.get("/api/settings/preview")
        doc = fitz.open(stream=resp.content, filetype="pdf")
        x = max(w[2] for w in doc[1].get_text("words"))
        doc.close()
        return x

    assert max_word_x(1.0) - max_word_x(0.0) > 60
    client.put("/api/settings", json={"align_x": 0.0, "price_hex": ""})


def test_preview_uses_unsaved_dials():
    import base64

    # saved background stays white; the preview body carries a blue one
    client.put("/api/settings", json={"background_hex": "#ffffff"})
    r = client.post("/api/settings/preview/images", json={"background_hex": "#dde7f5"})
    assert r.status_code == 200
    png = base64.b64decode(r.json()["pages"][0].split(",", 1)[1])
    doc = fitz.open(stream=png, filetype="png")
    pix = doc[0].get_pixmap()
    r_, g_, b_ = pix.pixel(2, 2)
    assert b_ > r_ and b_ > 200, (r_, g_, b_)
    doc.close()
    assert client.get("/api/settings").json()["background_hex"] == "#ffffff", "nothing was saved"


def test_style_request_needs_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = client.post("/api/settings/style-request", json={"style_request": "green background"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]
