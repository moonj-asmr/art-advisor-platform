from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import Artwork, Collection

router = APIRouter(prefix="/artworks", tags=["artworks"])


class Decision(BaseModel):
    decision: str  # "liked" | "passed" | "pending" (pending = undo)
    collection_ids: list[int] = []  # allocate into these on a right-swipe


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


class BulkCollections(BaseModel):
    artwork_ids: list[int]
    collection_id: int
    action: str  # "add" | "remove"


class BulkStatus(BaseModel):
    artwork_ids: list[int]
    status: str  # "liked" | "passed" | "pending"


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
        q = q.join(Artwork.collections).filter(Collection.id == collection_id)
    return [a.to_dict() for a in q.order_by(Artwork.position, Artwork.id).all()]


@router.post("/{artwork_id}/decision")
def decide(artwork_id: int, body: Decision, db: Session = Depends(get_db)):
    """Record a swipe. A right-swipe also allocates into the active collections."""
    if body.decision not in ("liked", "passed", "pending"):
        raise HTTPException(400, "decision must be liked, passed, or pending")
    art = db.get(Artwork, artwork_id)
    if not art:
        raise HTTPException(404, "Artwork not found")
    art.status = body.decision
    art.decided_at = datetime.utcnow() if body.decision != "pending" else None
    if body.decision == "liked" and body.collection_ids:
        wanted = db.query(Collection).filter(Collection.id.in_(body.collection_ids)).all()
        have = {c.id for c in art.collections}
        for c in wanted:
            if c.id not in have:
                art.collections.append(c)
            c.last_added_at = datetime.utcnow()
    db.commit()
    return art.to_dict()


@router.post("/bulk/collections")
def bulk_collections(body: BulkCollections, db: Session = Depends(get_db)):
    """iOS-Photos-style multi-select: add/remove a batch of works to a collection."""
    if body.action not in ("add", "remove"):
        raise HTTPException(400, "action must be add or remove")
    collection = db.get(Collection, body.collection_id)
    if not collection:
        raise HTTPException(404, "Collection not found")
    arts = db.query(Artwork).filter(Artwork.id.in_(body.artwork_ids)).all()
    for art in arts:
        member = collection in art.collections
        if body.action == "add" and not member:
            art.collections.append(collection)
        elif body.action == "remove" and member:
            art.collections.remove(collection)
    if body.action == "add" and arts:
        collection.last_added_at = datetime.utcnow()
    db.commit()
    return {"updated": [a.id for a in arts], "collection_id": collection.id, "action": body.action}


@router.post("/bulk/status")
def bulk_status(body: BulkStatus, db: Session = Depends(get_db)):
    """Move a batch of works between Selected / Passed / back to the deck."""
    if body.status not in ("liked", "passed", "pending"):
        raise HTTPException(400, "status must be liked, passed, or pending")
    arts = db.query(Artwork).filter(Artwork.id.in_(body.artwork_ids)).all()
    now = datetime.utcnow()
    for art in arts:
        art.status = body.status
        art.decided_at = now if body.status != "pending" else None
    db.commit()
    return {"updated": [a.id for a in arts], "status": body.status}


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
