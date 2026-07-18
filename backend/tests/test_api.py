import io
import os
import sys
import tempfile

os.environ["ART_ADVISOR_DATA"] = tempfile.mkdtemp(prefix="artadvisor-test-")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

import fitz
import pytest
from fastapi.testclient import TestClient

from app.main import app
from make_sample_pdfs import make_complex, make_simple

client = TestClient(app)


@pytest.fixture(scope="module")
def uploaded():
    with tempfile.TemporaryDirectory() as d:
        simple = os.path.join(d, "halcyon.pdf")
        make_simple(simple)
        with open(simple, "rb") as f:
            r = client.post("/api/uploads", files={"file": ("halcyon-spring.pdf", f, "application/pdf")})
        assert r.status_code == 200, r.text
        return r.json()


def test_upload_extracts_artworks(uploaded):
    # the response returns immediately; TestClient runs the background task
    # before handing control back, so by now processing has finished
    assert uploaded["status"] == "processing"
    assert uploaded["page_count"] == 7
    rows = client.get("/api/uploads").json()
    mine = next(u for u in rows if u["id"] == uploaded["upload_id"])
    assert mine["status"] == "done"
    assert mine["artwork_count"] == 6


def test_deck_and_swipe_flow(uploaded):
    pending = client.get("/api/artworks", params={"status": "pending"}).json()
    assert len(pending) >= 6
    first, second = pending[0], pending[1]

    r = client.post(f"/api/artworks/{first['id']}/decision", json={"decision": "liked"})
    assert r.json()["status"] == "liked"
    r = client.post(f"/api/artworks/{second['id']}/decision", json={"decision": "passed"})
    assert r.json()["status"] == "passed"

    liked = client.get("/api/artworks", params={"status": "liked"}).json()
    assert any(a["id"] == first["id"] for a in liked)

    # undo
    r = client.post(f"/api/artworks/{second['id']}/decision", json={"decision": "pending"})
    assert r.json()["status"] == "pending"


def test_edit_extracted_fields(uploaded):
    art = client.get("/api/artworks").json()[0]
    r = client.patch(f"/api/artworks/{art['id']}", json={"price": "$ 99,000", "artist": "Edited Artist"})
    assert r.status_code == 200
    assert r.json()["price"] == "$ 99,000"
    assert r.json()["artist"] == "Edited Artist"


def test_collections():
    r = client.post("/api/collections", json={"name": "Art Basel 2026"})
    assert r.status_code == 200
    cid = r.json()["id"]
    listed = client.get("/api/collections").json()
    assert any(c["id"] == cid for c in listed)


def test_swipe_allocates_into_collections(uploaded):
    basel = client.post("/api/collections", json={"name": "Basel Paris"}).json()["id"]
    client_list = client.post("/api/collections", json={"name": "Client: Chen"}).json()["id"]
    art = client.get("/api/artworks").json()[2]

    # right-swipe with two active collections → member of both
    r = client.post(f"/api/artworks/{art['id']}/decision",
                    json={"decision": "liked", "collection_ids": [basel, client_list]})
    assert r.status_code == 200
    assert set(r.json()["collection_ids"]) >= {basel, client_list}

    # membership filter returns it
    members = client.get("/api/artworks", params={"collection_id": basel}).json()
    assert any(a["id"] == art["id"] for a in members)

    # collection counts reflect membership
    cols = {c["id"]: c for c in client.get("/api/collections").json()}
    assert cols[basel]["counts"]["liked"] >= 1


def test_bulk_collection_and_status(uploaded):
    shortlist = client.post("/api/collections", json={"name": "Refined Shortlist"}).json()["id"]
    arts = client.get("/api/artworks").json()
    ids = [a["id"] for a in arts[:3]]

    r = client.post("/api/artworks/bulk/collections",
                    json={"artwork_ids": ids, "collection_id": shortlist, "action": "add"})
    assert r.status_code == 200
    members = client.get("/api/artworks", params={"collection_id": shortlist}).json()
    assert {a["id"] for a in members} >= set(ids)

    # remove one again
    client.post("/api/artworks/bulk/collections",
                json={"artwork_ids": ids[:1], "collection_id": shortlist, "action": "remove"})
    members = client.get("/api/artworks", params={"collection_id": shortlist}).json()
    assert ids[0] not in {a["id"] for a in members}

    # bulk swap between selected and passed
    r = client.post("/api/artworks/bulk/status", json={"artwork_ids": ids, "status": "passed"})
    assert r.status_code == 200
    r = client.post("/api/artworks/bulk/status", json={"artwork_ids": ids, "status": "liked"})
    assert all(a["status"] == "liked" for a in client.get("/api/artworks").json() if a["id"] in ids)


def test_media_served(uploaded):
    art = client.get("/api/artworks").json()[0]
    assert art["image_url"]
    r = client.get(art["image_url"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")


def test_export_pdf(uploaded):
    liked = client.get("/api/artworks").json()[:3]
    ids = [a["id"] for a in liked]
    # the advisory identity comes from Settings, not from the export request
    r = client.put("/api/settings", json={"advisory_name": "Britt Art Advisory",
                                          "advisory_address": "12 Rue de Seine, Paris"})
    assert r.status_code == 200
    r = client.post("/api/export", json={
        "artwork_ids": ids,
        "title": "Spring Selections",
        "client_name": "Alice Chen",
        "show_price": True,
        "notes": {str(ids[0]): "Strong early work — museum interest in this series."},
    })
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    doc = fitz.open(stream=r.content, filetype="pdf")
    # cover + one page per artwork
    assert doc.page_count == 1 + len(ids)
    cover_text = doc[0].get_text()
    assert "Spring Selections" in cover_text
    assert "Alice Chen" in cover_text
    page1 = doc[1].get_text()
    assert "museum interest" in page1
    assert liked[0]["artist"] in page1, "caption lines must not be silently dropped"
    assert liked[0]["price"] in page1
    doc.close()


def test_rename_and_delete_collection_keeps_artworks(uploaded):
    cid = client.post("/api/collections", json={"name": "Temp Fair"}).json()["id"]
    art = client.get("/api/artworks").json()[0]
    client.post("/api/artworks/bulk/collections",
                json={"artwork_ids": [art["id"]], "collection_id": cid, "action": "add"})

    r = client.patch(f"/api/collections/{cid}", json={"name": "Renamed Fair"})
    assert r.status_code == 200 and r.json()["name"] == "Renamed Fair"
    assert any(c["name"] == "Renamed Fair" for c in client.get("/api/collections").json())

    r = client.delete(f"/api/collections/{cid}")
    assert r.status_code == 200
    assert all(c["id"] != cid for c in client.get("/api/collections").json())
    # the artwork survives, just without that membership
    still = client.get("/api/artworks").json()
    mine = next(a for a in still if a["id"] == art["id"])
    assert cid not in mine["collection_ids"]


def test_export_description_only_when_asked(uploaded):
    art = client.get("/api/artworks").json()[0]
    client.patch(f"/api/artworks/{art['id']}",
                 json={"description": "Born 1980, the artist explores memory and light."})

    def export(show_description):
        r = client.post("/api/export", json={"artwork_ids": [art["id"]],
                                             "show_description": show_description})
        assert r.status_code == 200
        doc = fitz.open(stream=r.content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text

    assert "memory and light" not in export(False), "descriptions are off by default"
    assert "memory and light" in export(True)


def test_export_requires_ids():
    r = client.post("/api/export", json={"artwork_ids": []})
    assert r.status_code == 400


def test_upload_gallery_rename_and_delete_cascade():
    with tempfile.TemporaryDirectory() as d:
        pdf = os.path.join(d, "second.pdf")
        make_complex(pdf)
        with open(pdf, "rb") as f:
            up = client.post("/api/uploads", files={"file": ("second.pdf", f, "application/pdf")}).json()

    # rename the gallery → artworks follow
    r = client.patch(f"/api/uploads/{up['upload_id']}", json={"gallery": "Corrected Gallery"})
    assert r.status_code == 200
    arts = [a for a in client.get("/api/artworks").json() if a["upload_id"] == up["upload_id"]]
    assert arts and all(a["gallery"] == "Corrected Gallery" for a in arts)

    # delete the upload → its artworks and images disappear
    image_urls = [a["image_url"] for a in arts if a["image_url"]]
    r = client.delete(f"/api/uploads/{up['upload_id']}")
    assert r.status_code == 200
    remaining = [a for a in client.get("/api/artworks").json() if a["upload_id"] == up["upload_id"]]
    assert remaining == []
    for url in image_urls:
        assert client.get(url).status_code == 404, "extracted images should be removed from disk"
