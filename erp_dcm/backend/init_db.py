#!/usr/bin/env python3
"""
init_db.py — Inicializa el schema en la base de datos de Render.

Uso (una sola vez, desde la consola Shell de Render):
    python init_db.py

Render provee DATABASE_URL como variable de entorno automáticamente
cuando el Web Service está vinculado a la base de datos.
"""

import asyncio
import os
from pathlib import Path

import asyncpg


async def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL no está definida. ¿Estás corriendo esto en Render?")

    # asyncpg necesita postgresql:// no postgres://
    # Render a veces entrega postgres://, lo normalizamos
    db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"Conectando a la base de datos...")
    conn = await asyncpg.connect(db_url)

    schema_path = Path(__file__).parent.parent / "database" / "001_create_schema.sql"
    if not schema_path.exists():
        # En Render el repo está en /opt/render/project/src
        schema_path = Path("/opt/render/project/src/database/001_create_schema.sql")

    print(f"Leyendo schema desde: {schema_path}")
    sql = schema_path.read_text(encoding="utf-8")

    print("Ejecutando schema...")
    await conn.execute(sql)
    await conn.close()

    print("✓ Schema aplicado correctamente.")
    print("✓ Seed de tipos_proceso y procesos_maestro insertado.")


if __name__ == "__main__":
    asyncio.run(main())
