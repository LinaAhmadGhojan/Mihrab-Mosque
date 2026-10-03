import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me-please-32bytes+")
ALGO = "HS256"
TOKEN_HOURS = 24 * 7


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET, ALGO)


def read_token(token: str) -> int | None:
    try:
        return int(jwt.decode(token, SECRET, [ALGO])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
