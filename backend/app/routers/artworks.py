from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import Artwork

router = APIRouter(prefix="/artworks", tags=["artworks"])

EDITABLE_FIELDS = {"artist", "title", "year", "medium", "dimensions",
                   "price", "edition", "gallery", "description"}


class Decision(BaseModel):
    decision: str  # "liked" | "passed" | "pending" (pending = undo)


class ArtworkPatch(BaseModel):
    artist: str | None = None
    title: str | None = None
    year: str | None = None
    medium: str | None = None
    dimensions: str | None = None
    price: str | None = None
    edition: str | None = None
    gallery: str | None = None
    description: str | None = None
    position: int | None = None


@router.get("")
def list_artworks(
    status: str | None = None,
    collection_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Artwork)
    if status:
        q = q.filter(Artwork.status == status)
    if collection_id is not None:
        q = q.filter(Artwork.collection_id == collection_id)
    return [a.to_dict() for a in q.order_by(Artwork.position, Artwork.id).all()]


@router.post("/{artwork_id}/decision")
def decide(artwork_id: int, body: Decision, db: Session = Depends(get_db)):
    """Record a swipe: right = liked, left = passed. 'pending' undoes."""
    if body.decision not in ("liked", "passed", "pending"):
        raise HTTPException(400, "decision must be liked, passed, or pending")
    art = db.get(Artwork, artwork_id)
    if not art:
        raise HTTPException(404, "Artwork not found")
    art.status = body.decision
    art.decided_at = datetime.utcnow() if body.decision != "pending" else None
    db.commit()
    return art.to_dict()


@router.patch("/{artwork_id}")
def update_artwork(artwork_id: int, body: ArtworkPatch, db: Session = Depends(get_db)):
    art = db.get(Artwork, artwork_id)
    if not art:
        raise HTTPException(404, "Artwork not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(art, key, value)
    db.commit()
    return art.to_dict()


@router.delete("/{artwork_id}")
def delete_artwork(artwork_id: int, db: Session = Depends(get_db)):
    art = db.get(Artwork, artwork_id)
    if not art:
        raise HTTPException(404, "Artwork not found")
    db.delete(art)
    db.commit()
    return {"deleted": artwork_id}
