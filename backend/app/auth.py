from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd.verify(password, hashed)


def issue_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes)
    return jwt.encode(
        {"sub": str(user.id), "tenant_id": user.tenant_id, "exp": exp},
        settings.jwt_secret,
        algorithm="HS256",
    )


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in to continue")
    try:
        claims = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=["HS256"]
        )
        user = db.get(User, int(claims["sub"]))
        if not user or user.tenant_id != int(claims["tenant_id"]):
            raise ValueError("invalid user")
        return user
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Session is invalid or expired")
