"""Password hashing and token signing, written twice.

The first half is the mechanism: bcrypt for the password, HMAC-SHA256 for the
token. The second half is the library: PyJWT. The two produce the same bytes,
and `python security.py` proves it.

Nothing here touches the database. Nothing here reads a request. That keeps
the rules testable on their own.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

import bcrypt

from config import settings

# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------

# bcrypt reads at most 72 bytes of the password and ignores the rest.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Return a bcrypt hash. The salt is inside the returned string."""
    raw = password.encode("utf-8")[:MAX_PASSWORD_BYTES]
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    return bcrypt.hashpw(raw, salt).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    """Compare a candidate against a stored hash. Never raises on a bad hash."""
    raw = password.encode("utf-8")[:MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(raw, password_hash.encode("ascii"))
    except ValueError:
        return False


# An unknown email must cost the same as a known one. Without this hash, the
# login route answers a missing account in about 0.1 ms and a wrong password
# in about 250 ms, and the difference lists your users for an attacker.
DUMMY_HASH = hash_password("this password belongs to nobody")


def waste_time_like_a_real_login() -> None:
    """Spend one bcrypt verification on an account that does not exist."""
    verify_password("wrong", DUMMY_HASH)


# --------------------------------------------------------------------------
# Sessions
# --------------------------------------------------------------------------

def new_session_id() -> str:
    """32 bytes from the operating system CSPRNG, hex encoded.

    Do not use `random`. That module is a predictable generator, and a
    predictable session id is a login for a stranger.
    """
    return secrets.token_hex(32)


# --------------------------------------------------------------------------
# Tokens, by hand
# --------------------------------------------------------------------------

class TokenError(Exception):
    """The token is absent, malformed, unsigned, expired, or forged."""


def b64url_encode(raw: bytes) -> str:
    """Base64url with the padding removed, as RFC 7515 requires."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def b64url_decode(text: str) -> bytes:
    """Put the padding back, then decode."""
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def _sign(message: str) -> str:
    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        message.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return b64url_encode(signature)


def issue_token(user_id: int, email: str, ttl_seconds: int | None = None) -> str:
    """Build a JWT with three parts: header, payload, signature."""
    ttl = ttl_seconds if ttl_seconds is not None else settings.token_ttl_minutes * 60
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": str(user_id), "email": email, "iat": now, "exp": now + ttl}

    part1 = b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    part2 = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    message = f"{part1}.{part2}"
    return f"{message}.{_sign(message)}"


def verify_token(token: str) -> dict:
    """Return the payload, or raise TokenError. Check the signature first."""
    try:
        part1, part2, part3 = token.split(".")
    except ValueError as exc:
        raise TokenError("a token has three parts") from exc

    # compare_digest, not ==. A plain comparison stops at the first wrong
    # byte, and the time it takes leaks the correct prefix.
    if not hmac.compare_digest(_sign(f"{part1}.{part2}"), part3):
        raise TokenError("bad signature")

    try:
        header = json.loads(b64url_decode(part1))
        payload = json.loads(b64url_decode(part2))
    except (ValueError, json.JSONDecodeError) as exc:
        raise TokenError("bad encoding") from exc

    # Read the algorithm from your own list, never from the token. A server
    # that trusts this field accepts alg "none" and every token becomes valid.
    if header.get("alg") != "HS256":
        raise TokenError("unexpected algorithm")

    if payload.get("exp", 0) < time.time():
        raise TokenError("expired")

    return payload


# --------------------------------------------------------------------------
# The same thing, with the library
# --------------------------------------------------------------------------

def issue_token_pyjwt(user_id: int, email: str) -> str:
    import jwt

    now = int(time.time())
    return jwt.encode(
        {
            "sub": str(user_id),
            "email": email,
            "iat": now,
            "exp": now + settings.token_ttl_minutes * 60,
        },
        settings.secret_key,
        algorithm="HS256",
    )


def verify_token_pyjwt(token: str) -> dict:
    import jwt

    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


if __name__ == "__main__":
    mine = issue_token(7, "ada@example.com")
    theirs = issue_token_pyjwt(7, "ada@example.com")
    print("hand written:", mine)
    print("PyJWT       :", theirs)
    print("same bytes  :", mine == theirs)
    print("my verifier reads PyJWT's token :", verify_token(theirs)["email"])
    print("PyJWT reads my token            :", verify_token_pyjwt(mine)["email"])
