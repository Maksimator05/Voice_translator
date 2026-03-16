import logging
from typing import Optional

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "text/plain",
    "audio/mpeg",
    "audio/wav",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class StorageService:
    """S3-compatible storage service using MinIO via boto3."""

    def __init__(self):
        self._client = None
        self._bucket: Optional[str] = None

    def _get_client(self):
        """Lazily initialise the boto3 S3 client."""
        if self._client is not None:
            return self._client

        try:
            import boto3
            from botocore.config import Config
            from app.config import settings

            self._bucket = settings.S3_BUCKET_NAME

            self._client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                config=Config(signature_version="s3v4"),
                region_name="us-east-1",
            )

            # Ensure bucket exists
            try:
                self._client.head_bucket(Bucket=self._bucket)
            except Exception:
                try:
                    self._client.create_bucket(Bucket=self._bucket)
                    logger.info(f"Created S3 bucket: {self._bucket}")
                except Exception as e:
                    logger.warning(f"Could not create bucket '{self._bucket}': {e}")

            return self._client
        except ImportError:
            raise RuntimeError("boto3 is not installed. Add boto3 to requirements.txt.")
        except Exception as e:
            raise RuntimeError(f"Failed to initialise S3 client: {e}")

    def validate_file(self, file_size: int, content_type: str) -> Optional[str]:
        """Return an error message string if validation fails, else None."""
        if file_size > MAX_FILE_SIZE:
            return f"File is too large. Maximum allowed size is {MAX_FILE_SIZE // (1024 * 1024)} MB."
        if content_type not in ALLOWED_CONTENT_TYPES:
            allowed = ", ".join(sorted(ALLOWED_CONTENT_TYPES))
            return f"File type '{content_type}' is not allowed. Allowed types: {allowed}."
        return None

    def upload_file(self, file_bytes: bytes, s3_key: str, content_type: str) -> bool:
        """Upload bytes to S3/MinIO. Returns True on success, raises on failure."""
        try:
            client = self._get_client()
            client.put_object(
                Bucket=self._bucket,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
            )
            logger.info(f"Uploaded file to S3: {s3_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to upload file to S3 '{s3_key}': {e}")
            raise RuntimeError(f"File upload failed: {e}")

    def get_presigned_url(self, s3_key: str, expires: int = 3600) -> str:
        """Generate a pre-signed download URL. Raises on failure."""
        try:
            client = self._get_client()
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": s3_key},
                ExpiresIn=expires,
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate pre-signed URL for '{s3_key}': {e}")
            raise RuntimeError(f"Could not generate download URL: {e}")

    def delete_file(self, s3_key: str) -> bool:
        """Delete a file from S3/MinIO. Returns True on success, raises on failure."""
        try:
            client = self._get_client()
            client.delete_object(Bucket=self._bucket, Key=s3_key)
            logger.info(f"Deleted file from S3: {s3_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3 '{s3_key}': {e}")
            raise RuntimeError(f"File deletion failed: {e}")


# Singleton instance
storage_service = StorageService()
