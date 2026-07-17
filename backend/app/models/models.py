from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from .database import Base

# An artwork can live in many collections at once — the Basel pool, plus a
# refined shortlist for one client. Membership is the allocation.
artwork_collection = Table(
    "artwork_collections",
    Base.metadata,
    Column("artwork_id", Integer, ForeignKey("artworks.id", ondelete="CASCADE"), primary_key=True),
    Column("collection_id", Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
)


class Collection(Base):
    """A grouping the advisor allocates into: an art fair, a season, a client shortlist."""

    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploads = relationship("Upload", back_populates="collection")
    artworks = relationship("Artwork", back_populates="collection")
    members = relationship("Artwork", secondary=artwork_collection, back_populates="collections")


class Upload(Base):
    """A gallery PDF that was sent in and processed."""

    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    gallery = Column(String, default="")
    page_count = Column(Integer, default=0)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collection = relationship("Collection", back_populates="uploads")
    artworks = relationship("Artwork", back_populates="upload", cascade="all, delete-orphan")


class Artwork(Base):
    """One extracted artwork: the 'face card' plus everything found about it."""

    __tablename__ = "artworks"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=True)

    artist = Column(String, default="")
    title = Column(String, default="")
    year = Column(String, default="")
    medium = Column(String, default="")
    dimensions = Column(String, default="")
    price = Column(String, default="")
    edition = Column(String, default="")
    gallery = Column(String, default="")
    description = Column(Text, default="")  # artist bio / work text when the PDF has one

    image_path = Column(String, default="")  # primary image, relative to media dir
    detail_image_paths = Column(JSON, default=list)  # install shots, details, scale shots
    raw_text = Column(Text, default="")  # everything we read, so nothing is lost
    pages = Column(JSON, default=list)  # source page numbers in the gallery PDF

    status = Column(String, default="pending", index=True)  # pending | liked | passed
    decided_at = Column(DateTime, nullable=True)
    position = Column(Integer, default=0)  # order within the deck / selection

    upload = relationship("Upload", back_populates="artworks")
    collection = relationship("Collection", back_populates="artworks")
    collections = relationship("Collection", secondary=artwork_collection, back_populates="members")

    def to_dict(self):
        return {
            "id": self.id,
            "upload_id": self.upload_id,
            "collection_id": self.collection_id,
            "artist": self.artist,
            "title": self.title,
            "year": self.year,
            "medium": self.medium,
            "dimensions": self.dimensions,
            "price": self.price,
            "edition": self.edition,
            "gallery": self.gallery,
            "description": self.description,
            "image_url": f"/media/{self.image_path}" if self.image_path else None,
            "detail_image_urls": [f"/media/{p}" for p in (self.detail_image_paths or [])],
            "pages": self.pages or [],
            "status": self.status,
            "position": self.position,
            "collection_ids": [c.id for c in self.collections],
        }
