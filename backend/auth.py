# backend/auth.py
# Lógica de autenticación: hashing de contraseñas, generación
# y verificación de JWT, dependencia get_current_user para FastAPI.

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── Configuración ─────────────────────────────────────────────────────────────
# JWT_SECRET debe ser una cadena larga y aleatoria.
# En Render: agregar como variable de entorno en el servicio erp-dcm-api.
# Generar con: python -c "import secrets; print(secrets.token_hex(32))"

JWT_SECRET    = os.getenv("JWT_SECRET", "CAMBIAR_ESTO_EN_PRODUCCION_secreto_largo_aleatorio")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))  # 8 horas por defecto

pwd_context  = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Contraseñas ───────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str, nombre: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub":    user_id,
        "email":  email,
        "nombre": nombre,
        "exp":    expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ── Dependencia FastAPI ───────────────────────────────────────────────────────

class CurrentUser:
    def __init__(self, id: str, email: str, nombre: str):
        self.id     = id
        self.email  = email
        self.nombre = nombre

async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sin subject")
    return CurrentUser(
        id     = user_id,
        email  = payload.get("email", ""),
        nombre = payload.get("nombre", ""),
    )
