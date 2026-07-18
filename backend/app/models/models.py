from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
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
    last_added_at = Column(DateTime, nullable=True)  # when works last went in — drives "recently used" sorting

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
    status = Column(String, default="done")  # processing | done | failed
    created_at = Column(DateTime, default=datetime.utcnow)

    collection = relationship("Collection", back_populates="uploads")
    artworks = relationship("Artwork", back_populates="upload", cascade="all, delete-orphan")


class Settings(Base):
    """The advisor's account and house style — single row, feeds every export."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    email = Column(String, default="")
    password_hash = Column(String, default="")  # empty until the advisor creates a login
    advisory_name = Column(String, default="")
    advisory_address = Column(Text, default="")
    logo_media = Column(String, default="")
    align = Column(String, default="left")  # legacy left|center — align_x supersedes it
    align_x = Column(Float, default=0.0)  # caption position 0 (left) .. 0.5 (center) .. 1 (right)
    font = Column(String, default="serif")  # a pdf_builder.FONT_FAMILIES key
    accent_hex = Column(String, default="#1a1a1a")
    background_hex = Column(String, default="#ffffff")
    text_hex = Column(String, default="#262626")
    price_hex = Column(String, default="")  # empty = follow the caption color (quiet by default)
    base_font_pt = Column(Float, default=10.0)
    heading_font_pt = Column(Float, default=13.0)
    image_scale = Column(Float, default=1.0)
    style_request = Column(Text, default="")  # the advisor's own words, kept for reference

    def to_dict(self):
        return {
            "email": self.email,
            "has_password": bool(self.password_hash),
            "advisory_name": self.advisory_name,
            "advisory_address": self.advisory_address,
            "logo_media": self.logo_media,
            "logo_url": f"/media/{self.logo_media}" if self.logo_media else None,
            "align": self.align,
            "align_x": self.align_x,
            "font": self.font,
            "accent_hex": self.accent_hex,
            "background_hex": self.background_hex,
            "text_hex": self.text_hex,
            "price_hex": self.price_hex,
            "base_font_pt": self.base_font_pt,
            "heading_font_pt": self.heading_font_pt,
            "image_scale": self.image_scale,
            "style_request": self.style_request,
        }


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
