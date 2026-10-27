import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# La imagen Docker activa REQUIRE_SECRETS: sin los cuatro secretos, el backend no arranca
# (así un olvido en el formulario de Unraid no deja el panel con admin/admin).
_REQUIRED_SECRETS = ("SECRET_KEY", "ADMIN_USERNAME", "ADMIN_PASSWORD", "PROVISIONING_SECRET")
if os.environ.get("REQUIRE_SECRETS"):
    _missing = [name for name in _REQUIRED_SECRETS if not os.environ.get(name)]
    if _missing:
        raise RuntimeError("Faltan variables de entorno obligatorias: " + ", ".join(_missing))

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 semana, uso personal

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
PROVISIONING_SECRET = os.environ.get("PROVISIONING_SECRET", "dev-provisioning-secret-change-me")


def verify_provisioning_secret(secret: str) -> bool:
    return hmac.compare_digest(secret, PROVISIONING_SECRET)

_bearer = HTTPBearer(auto_error=False)


def verify_credentials(username: str, password: str) -> bool:
    user_ok = hmac.compare_digest(username, ADMIN_USERNAME)
    pass_ok = hmac.compare_digest(
        hashlib.sha256(password.encode()).digest(),
        hashlib.sha256(ADMIN_PASSWORD.encode()).digest(),
    )
    return user_ok and pass_ok


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return payload["sub"]
