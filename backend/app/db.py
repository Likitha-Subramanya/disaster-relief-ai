from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from geoalchemy2 import Geography

from .config import get_settings


settings = get_settings()

engine = create_engine(settings.sqlalchemy_database_uri, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    pass


# Export Geography for models
GeographyType = Geography


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
