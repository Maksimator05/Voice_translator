import pytest

from app.services.storage_service import MAX_FILE_SIZE, StorageService

pytestmark = pytest.mark.unit


def test_validate_file_accepts_supported_type_and_size():
    service = StorageService()

    error = service.validate_file(1024, "application/pdf")

    assert error is None


def test_validate_file_rejects_large_files():
    service = StorageService()

    error = service.validate_file(MAX_FILE_SIZE + 1, "application/pdf")

    assert error is not None
    assert "Maximum allowed size" in error


def test_validate_file_rejects_unsupported_content_type():
    service = StorageService()

    error = service.validate_file(1024, "application/x-msdownload")

    assert error is not None
    assert "not allowed" in error
