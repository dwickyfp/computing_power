"""
Security utilities for worker service.

Provides credential decryption compatible with backend's encryption.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config.settings import get_settings

import structlog

logger = structlog.get_logger(__name__)

_cipher: AESGCM | None = None


def get_cipher() -> AESGCM:
    """
    Get AES-256-GCM cipher instance.

    Uses the same key format as backend for compatibility.
    """
    global _cipher
    if _cipher is not None:
        return _cipher

    settings = get_settings()
    key_str = settings.credential_encryption_key

    # Try base64 decode first, then raw bytes
    try:
        key_bytes = base64.b64decode(key_str)
        if len(key_bytes) != 32:
            raise ValueError("Decoded key is not 32 bytes")
    except Exception:
        key_bytes = key_str.encode("utf-8")[:32].ljust(32, b"\0")

    _cipher = AESGCM(key_bytes)
    return _cipher


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt a base64-encoded AES-256-GCM encrypted string.

    Compatible with backend's encrypt_value() output.
    """
    if not encrypted_value:
        return encrypted_value

    try:
        combined = base64.b64decode(encrypted_value)
        nonce = combined[:12]
        ciphertext = combined[12:]
        aesgcm = get_cipher()
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")
