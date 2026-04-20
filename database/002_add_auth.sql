-- ============================================================
--  ERP DCM — Migración 002: Auth de usuarios
--  Script: 002_add_auth.sql
--  Ejecutar UNA SOLA VEZ desde la Shell de Render:
--    python init_db.py --migration 002_add_auth.sql
--  O directamente con psql.
-- ============================================================

-- Agregar columna de hash de contraseña a usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);

-- El primer usuario admin se crea via script (ver crear_admin.py).
-- password_hash es nullable temporalmente para no romper registros
-- existentes; en producción todos los usuarios deben tener contraseña.

-- Índice para búsqueda por email en login
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
