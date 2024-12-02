from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    subscription_tier = Column(String)
    pdf_quota = Column(Integer)
    
    portfolios = relationship("Portfolio", back_populates="owner")
    uploads = relationship("PDFUpload", back_populates="owner")