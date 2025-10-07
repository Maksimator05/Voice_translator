from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Создаем движок базы данных
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()


def get_db():
    """Зависимость для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Создает таблицы в БД - ГАРАНТИРОВАННО"""
    print("🔧 Создание таблиц в базе данных...")

    # Импортируем модели ЯВНО перед созданием таблиц
    from app.auth.models import User

    # Создаем таблицы
    Base.metadata.create_all(bind=engine)

    # Проверяем создание
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print(f"✅ Созданы таблицы: {tables}")
    return tables