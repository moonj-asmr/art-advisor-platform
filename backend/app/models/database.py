import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# SQLite by default so the app runs with zero setup; set DATABASE_URL for Postgres.
DATA_DIR = os.environ.get(
    "ART_ADVISOR_DATA",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data")),
)
os.makedirs(DATA_DIR, exist_ok=True)

SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'artadvisor.db')}"
)

connect_args = (
    {"check_same_thread": False, "timeout": 30}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

MEDIA_DIR = os.path.join(DATA_DIR, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
