"""
Fernet-based token encryption for Strava OAuth tokens.

If STRAVA_TOKEN_ENCRYPTION_KEY is not set, tokens are stored in plaintext
with a logged warning (dev mode only).
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_warned = False


def _get_fernet():
    global _warned
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        if not _warned:
            logger.warning('cryptography library not installed — Strava tokens stored in plaintext')
            _warned = True
        return None

    key = getattr(settings, 'STRAVA_TOKEN_ENCRYPTION_KEY', None)
    if not key:
        if not _warned:
            logger.warning('STRAVA_TOKEN_ENCRYPTION_KEY not set — Strava tokens stored in plaintext')
            _warned = True
        return None

    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token string. Returns plaintext if key not configured."""
    f = _get_fernet()
    if f is None:
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a token string. Returns ciphertext as-is if key not configured."""
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        # If decryption fails (e.g., key changed), return as-is
        logger.error('Failed to decrypt Strava token — returning raw value')
        return ciphertext
