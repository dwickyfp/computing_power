"""
Redis client for worker service.

Provides connection to Redis for caching preview results.
"""

import redis as redis_lib

from app.config.settings import get_settings

import structlog

logger = structlog.get_logger(__name__)


class RedisClient:
    """Singleton Redis client."""

    _instance: redis_lib.Redis | None = None

    @classmethod
    def get_instance(cls) -> redis_lib.Redis | None:
        """Get or create Redis connection."""
        if cls._instance is None:
            try:
                settings = get_settings()
                cls._instance = redis_lib.from_url(
                    settings.redis_url,
                    decode_responses=True,
                )
                cls._instance.ping()
                logger.info("Redis connected", url=settings.redis_url)
            except Exception as e:
                logger.warning("Redis connection failed", error=str(e))
                cls._instance = None
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset the Redis connection."""
        if cls._instance:
            try:
                cls._instance.close()
            except Exception:
                pass
            cls._instance = None


def get_redis() -> redis_lib.Redis | None:
    """Get Redis client instance."""
    return RedisClient.get_instance()
