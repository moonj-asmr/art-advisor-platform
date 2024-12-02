from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship
from .database import Base

portfolio_artwork = Table(
    'portfolio_artwork',
    Base.metadata,
    Column('portfolio_id', Integer, ForeignKey('portfolios.id')),
    Column('artwork_id', Integer, ForeignKey('artworks.id'))
)

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    client_name = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="portfolios")
    artworks = relationship("Artwork", secondary=portfolio_artwork)