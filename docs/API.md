# Art Advisor Platform API

Base URL: `http://localhost:8000`. All endpoints are under `/api`; extracted
images are served from `/media/<file>`. No authentication yet (single-advisor
prototype).

## Uploads

### POST /api/uploads
Ingest a gallery PDF. Multipart form: `file` (PDF, ≤50MB), optional
`collection_id`, optional `gallery` (name override; otherwise guessed from the
PDF's first page or filename).

Response: `{ upload_id, filename, gallery, page_count, artworks_found }`

### GET /api/uploads
List processed PDFs with artwork counts.

### DELETE /api/uploads/{id}
Remove an upload and its extracted artworks.

## Artworks

### GET /api/artworks?status=&collection_id=
List artwork cards. `status` filters by `pending` | `liked` | `passed`.

Artwork shape:
```json
{
  "id": 1, "artist": "Maria Kovacs", "title": "Night Garden II",
  "year": "2024", "medium": "Oil on canvas", "dimensions": "120 x 90 cm",
  "price": "$ 45,000", "edition": "", "gallery": "Halcyon Gallery Projects",
  "description": "…artist text if the PDF had one…",
  "image_url": "/media/abc.png", "detail_image_urls": ["/media/def.png"],
  "pages": [2], "status": "pending", "collection_id": null
}
```

### POST /api/artworks/{id}/decision
Record a swipe. Body: `{ "decision": "liked" | "passed" | "pending" }`
(`pending` = undo).

### PATCH /api/artworks/{id}
Edit extracted caption fields (`artist`, `title`, `year`, `medium`,
`dimensions`, `price`, `edition`, `gallery`, `description`, `position`).

### DELETE /api/artworks/{id}

## Collections

### GET /api/collections
List collections with per-status counts.

### POST /api/collections
Body: `{ "name": "Art Basel 2026" }`

### DELETE /api/collections/{id}
Deletes the grouping only; artworks and uploads are kept.

## Export

### POST /api/export/logo
Multipart form `file` (PNG/JPEG). Response: `{ "logo_media": "logo_x.png" }` —
pass this in export requests.

### POST /api/export
Render the curated selection into the advisor-styled client PDF (returned as
`application/pdf`). Body:

```json
{
  "artwork_ids": [3, 1, 7],
  "title": "Art Basel — Selections",
  "client_name": "Alice Chen",
  "advisor_name": "Britt Art Advisory",
  "align": "left",
  "image_scale": 1.0,
  "show_price": true,
  "show_gallery": true,
  "show_description": false,
  "font": "serif",
  "accent_hex": "#1a1a1a",
  "logo_media": "",
  "notes": { "3": "Strong early work — museum interest in this series." }
}
```

`artwork_ids` order = page order. A cover page is added when `title` or
`client_name` is set.
