# Art Advisor Platform — "AdvisoryDeck"

Tinder for art advisors. Gallery PDFs go in, artwork cards come out; the advisor
swipes through them in their downtime, and the works they select export into a
clean, consistently formatted client PDF in *their* style — not a cobbled-together
compilation of gallery layouts.

## The workflow

1. **Inbox** — drop in gallery PDFs (forwarded from email / WhatsApp). The
   extractor pattern-recognizes the format: one-artwork-per-page caption sheets,
   or multi-page presentations where a lead image is followed by detail shots,
   scale views, and artist texts. Every artwork becomes a card: image, artist,
   title, year, medium, dimensions, price, gallery.
2. **Deck** — swipe right to select, left to pass. Tap a card to flip it over
   for details (detail images, edition, artist text, source pages). Undo any
   swipe. Group uploads into **collections** ("Art Basel 2026", "Spring shows")
   and review each deck separately.
3. **Selects** — the liked works. Fix anything the extraction got wrong (the
   caption is editable), drop works, or send them back to the deck.
4. **Export** — one artwork per page in the advisor's formatting: title +
   client name on the cover, logo, serif or sans, left or centered, image size,
   prices on/off, per-work notes. Different versions for different clients are
   just repeated exports of refined selections.

## Running it

Backend (FastAPI + PyMuPDF, SQLite by default — zero setup):

```bash
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app.main:app --reload          # http://localhost:8000
```

Frontend (React + Vite + Tailwind, mobile-first):

```bash
cd frontend
npm install
npm run dev                                        # http://localhost:5173 (proxies /api to :8000)
```

Try it with generated sample gallery PDFs (both real-world formats):

```bash
backend/venv/bin/python scripts/make_sample_pdfs.py /tmp/samples
# then drop /tmp/samples/*.pdf into the Inbox tab
```

Tests:

```bash
cd backend && ./venv/bin/python -m pytest tests/
cd frontend && npx tsc --noEmit && npm run build
```

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind. A single mobile-width column —
  it is designed to be used on a phone (add to home screen; it runs full-screen).
- **Backend**: FastAPI. `app/services/extraction.py` holds the PDF pattern
  recognition; `app/services/pdf_builder.py` renders the client PDF.
- **Database**: SQLite out of the box; set `DATABASE_URL` for Postgres.
- **Media**: extracted artwork images stored on disk under `backend/data/media`
  (override with `ART_ADVISOR_DATA`), served at `/media/*`.

See `docs/API.md` for endpoints and `docs/PDF-Format-Guide.md` for what the
extractor handles best.

## Roadmap

- Email-in / WhatsApp-in ingestion (forward a PDF to an address, it lands in the Inbox)
- Native iOS wrapper (the API is already shaped for it; the swipe UI maps 1:1 to SwiftUI)
- LLM-assisted extraction fallback for unusual PDF layouts
- Multi-user accounts, client CRM, and per-client sent-PDF history
