import asyncio
from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.auth.models import User, UserRole
from app.auth.service import get_password_hash
from app.models.chat_models import ChatMessage, ChatSession
from app.models.chat_schemas import ChatMessageCreate, ChatSessionCreate, SessionType
from app.services.chat_service import ChatService

pytestmark = pytest.mark.unit


def create_user(db_session: Session, *, email: str, username: str) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash("ChatPass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def create_chat(
    db_session: Session,
    *,
    user_id: int,
    title: str,
    session_type: str,
    created_at: datetime,
) -> ChatSession:
    chat = ChatSession(
        user_id=user_id,
        title=title,
        session_type=session_type,
        created_at=created_at,
        updated_at=created_at,
        is_active=True,
    )
    db_session.add(chat)
    db_session.commit()
    db_session.refresh(chat)
    return chat


def create_message(db_session: Session, *, chat_id: int, content: str, created_at: datetime) -> ChatMessage:
    message = ChatMessage(
        chat_session_id=chat_id,
        role="user",
        content=content,
        message_type="text",
        created_at=created_at,
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)
    return message


def test_get_user_chat_sessions_applies_filters_sort_and_pagination(db_session: Session):
    user = create_user(db_session, email="chat@example.com", username="chat-user")
    other_user = create_user(db_session, email="other@example.com", username="other-user")
    base_time = datetime.utcnow() - timedelta(days=2)

    sprint_planning = create_chat(
        db_session,
        user_id=user.id,
        title="Sprint Planning",
        session_type="meeting",
        created_at=base_time,
    )
    sprint_review = create_chat(
        db_session,
        user_id=user.id,
        title="Sprint Review",
        session_type="meeting",
        created_at=base_time + timedelta(hours=1),
    )
    create_chat(
        db_session,
        user_id=user.id,
        title="Random Notes",
        session_type="text",
        created_at=base_time + timedelta(hours=2),
    )
    create_chat(
        db_session,
        user_id=other_user.id,
        title="Sprint Retro",
        session_type="meeting",
        created_at=base_time + timedelta(hours=3),
    )

    create_message(
        db_session,
        chat_id=sprint_planning.id,
        content="Planning details",
        created_at=base_time + timedelta(minutes=10),
    )
    create_message(
        db_session,
        chat_id=sprint_review.id,
        content="Review decisions",
        created_at=base_time + timedelta(hours=1, minutes=5),
    )

    service = ChatService(db_session)
    result = service.get_user_chat_sessions(
        user.id,
        search="Sprint",
        session_type="meeting",
        date_from=base_time - timedelta(minutes=1),
        date_to=base_time + timedelta(hours=1, minutes=30),
        sort_by="title",
        sort_order="asc",
        page=1,
        page_size=1,
        paginate=True,
    )

    assert result.total == 2
    assert result.page == 1
    assert result.page_size == 1
    assert result.pages == 2
    assert len(result.items) == 1
    assert result.items[0].title == "Sprint Planning"
    assert result.items[0].last_message == "Planning details"
    assert result.items[0].message_count == 1


def test_create_chat_and_add_message_returns_complete_session(db_session: Session):
    user = create_user(db_session, email="owner@example.com", username="owner")
    service = ChatService(db_session)

    chat = service.create_chat_session(
        user.id,
        ChatSessionCreate(title="Project sync", session_type=SessionType.TEXT),
    )
    message = asyncio.run(
        service.add_message_to_chat(
            chat.id,
            user.id,
            ChatMessageCreate(content="Hello team", role="user", message_type="text"),
        )
    )
    reloaded = service.get_chat_session(chat.id, user.id)

    assert message.content == "Hello team"
    assert reloaded is not None
    assert reloaded.title == "Project sync"
    assert len(reloaded.messages) == 1
    assert reloaded.messages[0].content == "Hello team"


def test_delete_chat_session_removes_messages(db_session: Session):
    user = create_user(db_session, email="delete@example.com", username="delete-user")
    chat = create_chat(
        db_session,
        user_id=user.id,
        title="Delete me",
        session_type="text",
        created_at=datetime.utcnow(),
    )
    create_message(db_session, chat_id=chat.id, content="One", created_at=datetime.utcnow())
    create_message(db_session, chat_id=chat.id, content="Two", created_at=datetime.utcnow())

    service = ChatService(db_session)
    result = asyncio.run(service.delete_chat_session(chat.id, user.id))

    assert result is True
    assert db_session.query(ChatSession).filter(ChatSession.id == chat.id).first() is None
    assert (
        db_session.query(ChatMessage).filter(ChatMessage.chat_session_id == chat.id).count() == 0
    )


def test_add_message_to_missing_chat_raises_value_error(db_session: Session):
    user = create_user(db_session, email="missing@example.com", username="missing-user")
    service = ChatService(db_session)

    with pytest.raises(ValueError):
        asyncio.run(
            service.add_message_to_chat(
                999,
                user.id,
                ChatMessageCreate(content="No chat", role="user", message_type="text"),
            )
        )
