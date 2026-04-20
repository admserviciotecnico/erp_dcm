#!/usr/bin/env python3
"""
crear_admin.py — Crea el primer usuario administrador del ERP.

Ejecutar UNA SOLA VEZ desde la Shell de Render (pestaña Shell del servicio):
    python crear_admin.py

Luego, desde la pantalla de login del frontend, usá ese email y contraseña.
Para crear más usuarios, usá el endpoint POST /admin/usuarios desde Swagger
(/docs) autenticado como admin.
"""

import asyncio
import os
import getpass

import asyncpg
from auth import hash_password

async def main():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL no está definida.")
    db_url = db_url.replace("postgres://", "postgresql://", 1)

    print("=== Crear usuario administrador ===\n")
    nombre = input("Nombre completo: ").strip()
    email  = input("Email: ").strip().lower()
    pwd    = getpass.getpass("Contraseña: ")
    pwd2   = getpass.getpass("Confirmar contraseña: ")

    if pwd != pwd2:
        print("ERROR: Las contraseñas no coinciden.")
        return
    if len(pwd) < 8:
        print("ERROR: La contraseña debe tener al menos 8 caracteres.")
        return

    conn = await asyncpg.connect(db_url)

    exists = await conn.fetchval(
        "SELECT COUNT(*) FROM usuarios WHERE email = $1", email
    )
    if exists:
        print(f"ERROR: Ya existe un usuario con el email {email}")
        await conn.close()
        return

    uid = await conn.fetchval(
        """INSERT INTO usuarios (nombre, email, rol, password_hash)
           VALUES ($1, $2, 'ADMIN', $3) RETURNING id""",
        nombre, email, hash_password(pwd)
    )
    await conn.close()

    print(f"\nUsuario administrador creado correctamente.")
    print(f"  ID:    {uid}")
    print(f"  Email: {email}")
    print(f"\nPodés iniciar sesión en el frontend con esas credenciales.")

if __name__ == "__main__":
    asyncio.run(main())
