import logging
import math
from datetime import datetime
from typing import List, Optional

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.models.chat_models import ChatSession, ChatMessage
from app.models.chat_schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionListResponse,
    PaginatedResponse,
    SessionType,
    MessageType,
)

logger = logging.getLogger(__name__)


class ChatService:
    """Сервис для работы с чатами и сообщениями"""

    def __init__(self, db: Session):
        self.db = db

    def create_chat_session(self, user_id: int, chat_data: ChatSessionCreate) -> ChatSessionResponse:
        """Создание новой сессии чата"""
        try:
            db_chat = ChatSession(
                user_id=user_id,
                title=chat_data.title,
                session_type=chat_data.session_type.value,
            )
            self.db.add(db_chat)
            self.db.commit()
            self.db.refresh(db_chat)

            logger.info(f"✅ Создана сессия чата: {db_chat.title} для пользователя {user_id}")
            return ChatSessionResponse(
                id=db_chat.id,
                user_id=db_chat.user_id,
                title=db_chat.title,
                session_type=chat_data.session_type,
                created_at=db_chat.created_at,
                updated_at=db_chat.updated_at,
                is_active=db_chat.is_active,
                messages=[],
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка создания сессии чата: {e}")
            raise

    def get_user_chat_sessions(
        self,
        user_id: int,
        search: Optional[str] = None,
        session_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 10,
        paginate: bool = False,
    ):
        """Получение списка чатов пользователя с поддержкой фильтрации и пагинации."""
        try:
            query = self.db.query(ChatSession).filter(
                ChatSession.user_id == user_id,
                ChatSession.is_active.is_(True),
            )
            query = self._apply_filters(query, search, session_type, date_from, date_to)

            if not paginate:
                # Backward-compatible: return all as list
                query = self._apply_sort(query, sort_by, sort_order)
                return [self._build_list_response(chat) for chat in query.all()]

            total = query.count()
            query = self._apply_sort(query, sort_by, sort_order)
            offset = (page - 1) * page_size
            items = [self._build_list_response(c) for c in query.offset(offset).limit(page_size).all()]
            return PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                pages=max(1, math.ceil(total / page_size)),
            )
        except Exception as e:
            logger.error(f"❌ Ошибка получения списка чатов: {e}")
            raise

    def get_all_chat_sessions(
        self,
        search: Optional[str] = None,
        session_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 10,
        paginate: bool = False,
    ):
        """Получение всех чатов (для moderator/admin) с поддержкой фильтрации и пагинации."""
        try:
            query = self.db.query(ChatSession).filter(ChatSession.is_active.is_(True))
            query = self._apply_filters(query, search, session_type, date_from, date_to)

            if not paginate:
                query = self._apply_sort(query, sort_by, sort_order)
                return [self._build_list_response(chat) for chat in query.all()]

            total = query.count()
            query = self._apply_sort(query, sort_by, sort_order)
            offset = (page - 1) * page_size
            items = [self._build_list_response(c) for c in query.offset(offset).limit(page_size).all()]
            return PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                pages=max(1, math.ceil(total / page_size)),
            )
        except Exception as e:
            logger.error(f"❌ Ошибка получения всех чатов: {e}")
            raise

    def _apply_filters(self, query, search, session_type, date_from, date_to):
        if search:
            query = query.filter(ChatSession.title.ilike(f"%{search}%"))
        if session_type:
            query = query.filter(ChatSession.session_type == session_type)
        if date_from:
            query = query.filter(ChatSession.created_at >= date_from)
        if date_to:
            query = query.filter(ChatSession.created_at <= date_to)
        return query

    def _apply_sort(self, query, sort_by: str, sort_order: str):
        sort_column_map = {
            "created_at": ChatSession.created_at,
            "updated_at": ChatSession.updated_at,
            "title": ChatSession.title,
        }
        column = sort_column_map.get(sort_by, ChatSession.created_at)
        if sort_order == "asc":
            return query.order_by(asc(column))
        return query.order_by(desc(column))

    def _build_list_response(self, chat: ChatSession) -> ChatSessionListResponse:
        """Вспомогательный метод: строит ChatSessionListResponse для одного чата"""
        last_message = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == chat.id)
            .order_by(desc(ChatMessage.created_at))
            .first()
        )
        message_count = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == chat.id)
            .count()
        )
        return ChatSessionListResponse(
            id=chat.id,
            title=chat.title,
            session_type=SessionType(chat.session_type),
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            last_message=last_message.content if last_message else None,
            message_count=message_count,
        )

    def get_chat_session(self, chat_id: int, user_id: int) -> Optional[ChatSessionResponse]:
        """Получение чата пользователя по ID с сообщениями"""
        try:
            chat_session = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id)
                .first()
            )
            if not chat_session:
                return None
            return self._build_session_response(chat_session)
        except Exception as e:
            logger.error(f"❌ Ошибка получения чата {chat_id}: {e}")
            raise

    def get_chat_session_by_id(self, chat_id: int) -> Optional[ChatSessionResponse]:
        """Получение любого чата по ID (для moderator/admin)"""
        try:
            chat_session = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == chat_id)
                .first()
            )
            if not chat_session:
                return None
            return self._build_session_response(chat_session)
        except Exception as e:
            logger.error(f"❌ Ошибка получения чата {chat_id}: {e}")
            raise

    def _build_session_response(self, chat_session: ChatSession) -> ChatSessionResponse:
        """Вспомогательный метод: строит ChatSessionResponse с сообщениями"""
        messages = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == chat_session.id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        message_responses = [
            ChatMessageResponse(
                id=msg.id,
                chat_session_id=msg.chat_session_id,
                role=msg.role,
                content=msg.content,
                message_type=MessageType(msg.message_type),
                tokens_used=msg.tokens_used,
                created_at=msg.created_at,
                audio_filename=msg.audio_filename,
                audio_transcription=msg.audio_transcription,
            )
            for msg in messages
        ]
        return ChatSessionResponse(
            id=chat_session.id,
            user_id=chat_session.user_id,
            title=chat_session.title,
            session_type=SessionType(chat_session.session_type),
            created_at=chat_session.created_at,
            updated_at=chat_session.updated_at,
            is_active=chat_session.is_active,
            messages=message_responses,
        )

    async def add_message_to_chat(
        self,
        chat_id: int,
        user_id: int,
        message_data: ChatMessageCreate,
        audio_file_path: Optional[str] = None,
    ) -> ChatMessageResponse:
        """Добавление сообщения в чат"""
        try:
            chat_session = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id)
                .first()
            )
            if not chat_session:
                raise ValueError("Чат не найден или нет доступа")

            db_message = ChatMessage(
                chat_session_id=chat_id,
                role=message_data.role,
                content=message_data.content,
                message_type=message_data.message_type,
                audio_filename=message_data.audio_filename,
                audio_transcription=message_data.audio_transcription,
            )
            self.db.add(db_message)

            chat_session.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(db_message)

            logger.info(f"✅ Добавлено сообщение в чат {chat_id}, роль: {message_data.role}")
            return ChatMessageResponse(
                id=db_message.id,
                chat_session_id=db_message.chat_session_id,
                role=db_message.role,
                content=db_message.content,
                message_type=message_data.message_type,
                tokens_used=db_message.tokens_used,
                created_at=db_message.created_at,
                audio_filename=db_message.audio_filename,
                audio_transcription=db_message.audio_transcription,
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка добавления сообщения: {e}")
            raise

    def get_chat_messages(self, chat_id: int, user_id: int, limit: int = 50) -> List[ChatMessageResponse]:
        """Получение сообщений чата"""
        try:
            chat_session = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id)
                .first()
            )
            if not chat_session:
                raise ValueError("Чат не найден или нет доступа")

            messages = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == chat_id)
                .order_by(ChatMessage.created_at)
                .limit(limit)
                .all()
            )
            return [
                ChatMessageResponse(
                    id=msg.id,
                    chat_session_id=msg.chat_session_id,
                    role=msg.role,
                    content=msg.content,
                    message_type=MessageType(msg.message_type),
                    tokens_used=msg.tokens_used,
                    created_at=msg.created_at,
                    audio_filename=msg.audio_filename,
                    audio_transcription=msg.audio_transcription,
                )
                for msg in messages
            ]
        except Exception as e:
            logger.error(f"❌ Ошибка получения сообщений чата {chat_id}: {e}")
            raise

    async def delete_chat_session(self, chat_id: int, user_id: int) -> bool:
        """Удаление чата и всех его сообщений (жёсткое удаление)"""
        try:
            chat = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id)
                .first()
            )
            if not chat:
                raise ValueError("Чат не найден или нет доступа")

            message_count = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == chat_id)
                .delete()
            )
            self.db.delete(chat)
            self.db.commit()

            logger.info(f"🗑️ Удалён чат {chat_id}, сообщений: {message_count}")
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка удаления чата {chat_id}: {e}")
            raise
