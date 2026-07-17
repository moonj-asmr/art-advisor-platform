from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import Artwork, Collection

router = APIRouter(prefix="/collections", tags=["collections"])


class CollectionCreate(BaseModel):
    name: str


@router.get("")
def list_collections(db: Session = Depends(get_db)):
    out = []
    for c in db.query(Collection).order_by(Collection.created_at.desc()).all():
        counts = {"pending": 0, "liked": 0, "passed": 0}
        for a in c.artworks:
            counts[a.status] = counts.get(a.status, 0) + 1
        out.append({
            "id": c.id, "name": c.name,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "counts": counts, "total": len(c.artworks),
        })
    return out


@router.post("")
def create_collection(body: CollectionCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    c = Collection(name=name)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name}


@router.delete("/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    c = db.get(Collection, collection_id)
    if not c:
        raise HTTPException(404, "Collection not found")
    db.query(Artwork).filter(Artwork.collection_id == collection_id) \
        .update({Artwork.collection_id: None})
    for u in c.uploads:
        u.collection_id = None
    db.delete(c)
    db.commit()
    return {"deleted": collection_id}
