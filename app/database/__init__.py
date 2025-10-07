# app/database/__init__.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Это общий Base
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Создает таблицы в БД"""
    # 👇 импортируем модели только тут
    from app.auth import models

    Base.metadata.create_all(bind=engine)

    from sqlalchemy import inspect
    inspector = inspect(engine)
    print(f"✅ Созданы таблицы: {inspector.get_table_names()}")
