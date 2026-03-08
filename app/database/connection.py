from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import inspect
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

    try:
        # 1. Импортируем модели в ПРАВИЛЬНОМ порядке
        from app.auth.models import User
        print("✅ Модель User импортирована")

        # 2. Сначала создаем таблицу users
        User.metadata.create_all(bind=engine)
        print("✅ Таблица users создана")

        # 3. Затем импортируем и создаем остальные таблицы
        from app.models.chat_models import ChatSession, ChatMessage  # noqa: F401
        print("✅ Модели ChatSession и ChatMessage импортированы")

        from app.models.meeting_models import AnalysisResult  # noqa: F401
        print("✅ Модель AnalysisResult импортирована")

        # 4. Создаем остальные таблицы
        Base.metadata.create_all(bind=engine)
        print("✅ Все таблицы созданы")

        # 5. Проверяем создание
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        print(f"✅ Созданы таблицы: {tables}")
        return tables

    except ImportError as e:
        print(f"❌ Ошибка импорта моделей: {e}")
        raise
    except Exception as e:
        print(f"❌ Ошибка создания таблиц: {e}")
        raise