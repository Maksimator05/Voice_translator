from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User, UserRole
from app.auth.service import (
    _hash_token,
    authenticate_user,
    create_refresh_token,
    get_password_hash,
    revoke_all_user_refresh_tokens,
    revoke_refresh_token,
    verify_refresh_token,
)

pytestmark = pytest.mark.unit


def create_db_user(db_session: Session, *, email: str = "service@example.com", username: str = "service-user") -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash("ServicePass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_create_refresh_token_persists_hashed_value(db_session: Session):
    user = create_db_user(db_session)

    raw_token = create_refresh_token(db_session, user.id)
    stored_token = db_session.query(RefreshToken).filter(RefreshToken.user_id == user.id).one()

    assert stored_token.token_hash == _hash_token(raw_token)
    assert stored_token.token_hash != raw_token
    assert verify_refresh_token(db_session, raw_token) is not None


def test_verify_refresh_token_rejects_revoked_and_expired_tokens(db_session: Session):
    user = create_db_user(db_session)

    raw_token = create_refresh_token(db_session, user.id)
    assert revoke_refresh_token(db_session, raw_token) is True
    assert verify_refresh_token(db_session, raw_token) is None

    expired = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token("expired-token"),
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        is_revoked=False,
    )
    db_session.add(expired)
    db_session.commit()

    assert verify_refresh_token(db_session, "expired-token") is None


def test_revoke_all_user_refresh_tokens_revokes_every_active_token(db_session: Session):
    user = create_db_user(db_session)
    first_token = create_refresh_token(db_session, user.id)
    second_token = create_refresh_token(db_session, user.id)

    revoked_count = revoke_all_user_refresh_tokens(db_session, user.id)

    assert revoked_count == 2
    assert verify_refresh_token(db_session, first_token) is None
    assert verify_refresh_token(db_session, second_token) is None


def test_authenticate_user_returns_none_for_invalid_credentials(db_session: Session):
    create_db_user(db_session, email="auth@example.com", username="auth-user")

    assert authenticate_user(db_session, "auth@example.com", "ServicePass123!") is not None
    assert authenticate_user(db_session, "auth@example.com", "wrong") is None
    assert authenticate_user(db_session, "missing@example.com", "ServicePass123!") is None
