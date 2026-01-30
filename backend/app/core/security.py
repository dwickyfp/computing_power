"""
Security utilities for credential encryption.

Implements AES-256-GCM encryption for securing sensitive data at rest.
"""

import base64
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def get_cipher() -> AESGCM:
    """
    Get AESGCM cipher instance using the configured encryption key.
    
    The key must be 32 bytes (256 bits) for AES-256.
    We assume the key provided in settings is a base64 encoded string or a raw string.
    If it's a raw string, we might need to hash it or ensure it's 32 bytes.
    For simplicity and security, we expect a 32-byte key (or base64 equivalent).
    """
    key = settings.credential_encryption_key
    
    # Try decoding if it looks like base64, otherwise use bytes
    try:
        # Check if it's base64 encoded 32 bytes
        decoded = base64.b64decode(key)
        if len(decoded) == 32:
            return AESGCM(decoded)
    except Exception:
        pass
        
    # If not base64 or length mismatch, check if the string itself is 32 bytes
    if len(key.encode()) == 32:
        return AESGCM(key.encode())
        
    # If key length is invalid, this will likely raise an error when using AESGCM
    # Ideally we should derive a key if it's a passphrase, but for now we expect a valid key.
    # Fallback to simple bytes conversion (might error if length != 16/24/32)
    return AESGCM(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    """
    Encrypt a string value using AES-256-GCM.
    
    Format: base64(nonce + ciphertext + tag)
    """
    if not value:
        return value
        
    aesgcm = get_cipher()
    nonce = os.urandom(12) # 96-bit nonce
    
    # Encrypt
    ciphertext = aesgcm.encrypt(nonce, value.encode(), None)
    
    # Combine nonce + ciphertext (tag is included in ciphertext by cryptography lib logic usually? 
    # Wait, AESGCM.encrypt returns ciphertext + tag appended)
    # So we just need Prepended Nonce + (Ciphertext + Tag)
    
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt a base64 encoded string using AES-256-GCM.
    """
    if not encrypted_value:
        return encrypted_value
        
    try:
        combined = base64.b64decode(encrypted_value)
        
        # Extract nonce (first 12 bytes)
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        aesgcm = get_cipher()
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')
    except Exception as e:
        # Log error? Return original if failed? 
        # For security, failing explicitly is better than returning garbage.
        # But if it wasn't encrypted (legacy), maybe return as is?
        # For this implementation, we assume all values passed here ARE encrypted.
        raise ValueError(f"Decryption failed: {str(e)}")
