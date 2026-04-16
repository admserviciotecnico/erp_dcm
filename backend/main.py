"""
ERP DCM — Módulo de Carga de Ingeniería
API REST con FastAPI + asyncpg

Variables de entorno requeridas:
    DATABASE_URL   -> provista automáticamente por Render al vincular la DB
    DWG_BASE_PATH  -> ruta donde se guardan los DWG (ej: /tmp/dwg_local en dev)
"""

from __future__ import annotations
import os, uuid, shutil, json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import asyncpg
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

DWG_BASE_PATH = Path(os.getenv("DWG_BASE_PATH", "/tmp/dwg_local"))
DWG_BASE_PATH.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="ERP DCM — Módulo de Carga de Ingeniería",
    version="1.0.0",
    description="API para gestión de BOMs, planos DWG y procesos de fabricación",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_pool: asyncpg.Pool | None = None

async def get_db():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    async with _pool.acquire() as conn:
        yield conn

@app.on_event("startup")
async def startup():
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

@app.on_event("shutdown")
async def shutdown():
    if _pool:
        await _pool.close()

@app.get("/health", tags=["Sistema"])
async def health():
    return {"status": "ok"}

class EstadoConjunto(str, Enum):
    EN_EDICION = "EN_EDICION"
    APROBADO   = "APROBADO"

MAX_OPERACIONES = 10

class OperacionIn(BaseModel):
    orden:        int           = Field(..., ge=1, le=10)
    proceso:      str           = Field(..., max_length=150)
    tipo_proceso: Optional[str] = Field(None, max_length=10)
    proveedor:    Optional[str] = Field(None, max_length=150)

class ItemBomIn(BaseModel):
    numero_item:    int               = Field(..., ge=1)
    codigo_pieza:   str               = Field(..., max_length=80)
    descripcion:    Optional[str]     = None
    cantidad:       float             = Field(1, gt=0)
    tipo:           Optional[str]     = Field(None, max_length=10)
    material:       Optional[str]     = None
    peso:           Optional[str]     = None
    columnas_extra: dict[str, Any]    = Field(default_factory=dict)
    operaciones:    list[OperacionIn] = Field(default_factory=list)

class ConjuntoIn(BaseModel):
    codigo:      str             = Field(..., max_length=80)
    descripcion: Optional[str]  = None
    version:     str             = Field("1", max_length=20)
    items:       list[ItemBomIn] = Field(default_factory=list)

class ConjuntoOut(BaseModel):
    id:          uuid.UUID
    codigo:      str
    descripcion: Optional[str]
    version:     str
    estado:      EstadoConjunto
    creado_en:   datetime
    aprobado_en: Optional[datetime]
    total_items: int = 0

class AprobacionIn(BaseModel):
    usuario_id:  uuid.UUID
    comentario:  Optional[str] = None

class TipoProcesoOut(BaseModel):
    codigo:   str
    nombre:   str
    procesos: list[dict]

async def _conjunto_o_404(conn, cid):
    row = await conn.fetchrow("SELECT * FROM conjuntos WHERE id = $1", cid)
    if not row:
        raise HTTPException(status_code=404, detail="Conjunto no encontrado")
    return row

async def _assert_editable(c):
    if c["estado"] == "APROBADO":
        raise HTTPException(status_code=409, detail="El conjunto está freezado y no puede modificarse")

async def _insertar_items(conn, conjunto_id, items):
    for item in items:
        iid = await conn.fetchval(
            """INSERT INTO items_bom
               (conjunto_id, numero_item, codigo_pieza, descripcion, cantidad, tipo, material, peso, columnas_extra)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id""",
            conjunto_id, item.numero_item, item.codigo_pieza, item.descripcion,
            item.cantidad, item.tipo, item.material, item.peso, json.dumps(item.columnas_extra),
        )
        for op in item.operaciones:
            await conn.execute(
                "INSERT INTO operaciones_item (item_id, orden, proceso, tipo_proceso, proveedor) VALUES ($1,$2,$3,$4,$5)",
                iid, op.orden, op.proceso, op.tipo_proceso, op.proveedor
            )

async def _fetch_out(conn, cid):
    r = await conn.fetchrow(
        "SELECT c.*, COUNT(i.id) AS total_items FROM conjuntos c LEFT JOIN items_bom i ON i.conjunto_id=c.id WHERE c.id=$1 GROUP BY c.id",
        cid
    )
    return dict(r)

# Maestro
@app.get("/maestro/tipos", response_model=list[TipoProcesoOut], tags=["Maestro"])
async def get_maestro(conn=Depends(get_db)):
    tipos = await conn.fetch("SELECT codigo, nombre FROM tipos_proceso WHERE activo=TRUE ORDER BY orden_ui")
    result = []
    for t in tipos:
        procs = await conn.fetch(
            "SELECT nombre_proceso AS nombre, proveedor_default, orden_sugerido FROM procesos_maestro WHERE tipo_proceso=$1 AND activo=TRUE ORDER BY orden_sugerido",
            t["codigo"]
        )
        result.append({"codigo": t["codigo"], "nombre": t["nombre"], "procesos": [dict(p) for p in procs]})
    return result

# Conjuntos
@app.get("/conjuntos", response_model=list[ConjuntoOut], tags=["Conjuntos"])
async def listar(estado: Optional[EstadoConjunto] = None, conn=Depends(get_db)):
    q = "SELECT c.*, COUNT(i.id) AS total_items FROM conjuntos c LEFT JOIN items_bom i ON i.conjunto_id=c.id {w} GROUP BY c.id ORDER BY c.actualizado_en DESC"
    rows = await conn.fetch(q.format(w="WHERE c.estado=$1"), estado.value) if estado else await conn.fetch(q.format(w=""))
    return [dict(r) for r in rows]

@app.post("/conjuntos", response_model=ConjuntoOut, status_code=201, tags=["Conjuntos"])
async def crear(payload: ConjuntoIn, conn=Depends(get_db)):
    async with conn.transaction():
        cid = await conn.fetchval("INSERT INTO conjuntos (codigo, descripcion, version) VALUES ($1,$2,$3) RETURNING id",
                                  payload.codigo, payload.descripcion, payload.version)
        await _insertar_items(conn, cid, payload.items)
        await conn.execute("INSERT INTO historial_estados (conjunto_id, estado_anterior, estado_nuevo, comentario) VALUES ($1,NULL,'EN_EDICION','Conjunto creado')", cid)
    return await _fetch_out(conn, cid)

@app.get("/conjuntos/{cid}", tags=["Conjuntos"])
async def get_uno(cid: uuid.UUID, conn=Depends(get_db)):
    c = await _conjunto_o_404(conn, cid)
    items = await conn.fetch("SELECT * FROM items_bom WHERE conjunto_id=$1 ORDER BY numero_item", cid)
    out = []
    for item in items:
        ops = await conn.fetch("SELECT * FROM operaciones_item WHERE item_id=$1 ORDER BY orden", item["id"])
        dwg = await conn.fetchrow("SELECT nombre_archivo, ruta_servidor FROM archivos_dwg WHERE item_id=$1 AND vigente=TRUE", item["id"])
        out.append({**dict(item), "operaciones": [dict(o) for o in ops],
                    "dwg_vigente": dwg["nombre_archivo"] if dwg else None,
                    "dwg_ruta": dwg["ruta_servidor"] if dwg else None})
    return {**dict(c), "items": out}

@app.put("/conjuntos/{cid}", tags=["Conjuntos"])
async def actualizar(cid: uuid.UUID, payload: ConjuntoIn, conn=Depends(get_db)):
    c = await _conjunto_o_404(conn, cid)
    await _assert_editable(c)
    async with conn.transaction():
        await conn.execute("UPDATE conjuntos SET codigo=$1, descripcion=$2, version=$3 WHERE id=$4",
                           payload.codigo, payload.descripcion, payload.version, cid)
        await conn.execute("DELETE FROM items_bom WHERE conjunto_id=$1", cid)
        await _insertar_items(conn, cid, payload.items)
    return await _fetch_out(conn, cid)

@app.post("/conjuntos/{cid}/aprobar", tags=["Conjuntos"])
async def aprobar(cid: uuid.UUID, payload: AprobacionIn, conn=Depends(get_db)):
    c = await _conjunto_o_404(conn, cid)
    await _assert_editable(c)
    sin_ops = await conn.fetchval(
        "SELECT COUNT(*) FROM items_bom i WHERE i.conjunto_id=$1 AND NOT EXISTS (SELECT 1 FROM operaciones_item o WHERE o.item_id=i.id)", cid)
    if sin_ops > 0:
        raise HTTPException(status_code=422, detail=f"{sin_ops} ítem(s) sin operaciones asignadas")
    async with conn.transaction():
        await conn.execute("UPDATE conjuntos SET estado='APROBADO', aprobado_por=$1, aprobado_en=NOW() WHERE id=$2", payload.usuario_id, cid)
        await conn.execute("INSERT INTO historial_estados (conjunto_id, estado_anterior, estado_nuevo, usuario_id, comentario) VALUES ($1,'EN_EDICION','APROBADO',$2,$3)",
                           cid, payload.usuario_id, payload.comentario)
    return {"ok": True, "mensaje": "Conjunto aprobado y freezado"}

# DWG
@app.post("/items/{iid}/dwg", status_code=201, tags=["Planos DWG"])
async def subir_dwg(iid: uuid.UUID, archivo: UploadFile = File(...), subido_por: str = "sistema", conn=Depends(get_db)):
    item = await conn.fetchrow("SELECT * FROM items_bom WHERE id=$1", iid)
    if not item: raise HTTPException(status_code=404, detail="Ítem no encontrado")
    c = await conn.fetchrow("SELECT * FROM conjuntos WHERE id=$1", item["conjunto_id"])
    await _assert_editable(c)
    if not archivo.filename.lower().endswith(".dwg"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos .dwg")
    dest = DWG_BASE_PATH / archivo.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(archivo.file, f)
    async with conn.transaction():
        await conn.execute("UPDATE archivos_dwg SET vigente=FALSE WHERE item_id=$1", iid)
        did = await conn.fetchval(
            "INSERT INTO archivos_dwg (item_id, nombre_archivo, ruta_servidor, subido_por) VALUES ($1,$2,$3,$4) RETURNING id",
            iid, archivo.filename, str(dest.resolve()), subido_por)
    return {"id": did, "nombre_archivo": archivo.filename, "ruta_servidor": str(dest.resolve())}

@app.get("/items/{iid}/dwg", tags=["Planos DWG"])
async def listar_dwg(iid: uuid.UUID, conn=Depends(get_db)):
    rows = await conn.fetch("SELECT id, nombre_archivo, ruta_servidor, subido_por, subido_en, vigente FROM archivos_dwg WHERE item_id=$1 ORDER BY subido_en DESC", iid)
    return [dict(r) for r in rows]

# Operaciones
@app.put("/items/{iid}/operaciones", tags=["Operaciones"])
async def set_ops(iid: uuid.UUID, operaciones: list[OperacionIn], conn=Depends(get_db)):
    if len(operaciones) > MAX_OPERACIONES:
        raise HTTPException(status_code=422, detail=f"Máximo {MAX_OPERACIONES} operaciones")
    item = await conn.fetchrow("SELECT * FROM items_bom WHERE id=$1", iid)
    if not item: raise HTTPException(status_code=404, detail="Ítem no encontrado")
    c = await conn.fetchrow("SELECT * FROM conjuntos WHERE id=$1", item["conjunto_id"])
    await _assert_editable(c)
    async with conn.transaction():
        await conn.execute("DELETE FROM operaciones_item WHERE item_id=$1", iid)
        for op in operaciones:
            await conn.execute("INSERT INTO operaciones_item (item_id, orden, proceso, tipo_proceso, proveedor) VALUES ($1,$2,$3,$4,$5)",
                               iid, op.orden, op.proceso, op.tipo_proceso, op.proveedor)
    return {"ok": True, "operaciones_guardadas": len(operaciones)}

# Exportar
@app.get("/conjuntos/{cid}/exportar", tags=["Integracion"])
async def exportar(cid: uuid.UUID, conn=Depends(get_db)):
    c = await _conjunto_o_404(conn, cid)
    if c["estado"] != "APROBADO":
        raise HTTPException(status_code=409, detail="Solo conjuntos aprobados pueden exportarse")
    rows = await conn.fetch("SELECT * FROM v_bom_completa WHERE conjunto_id=$1", cid)
    items_out = []
    for row in rows:
        ops = await conn.fetch("SELECT orden, proceso, tipo_proceso, proveedor FROM operaciones_item WHERE item_id=$1 ORDER BY orden", row["item_id"])
        items_out.append({**{k: v for k, v in dict(row).items() if k != "columnas_extra"},
                          "columnas_extra": dict(row["columnas_extra"]) if row["columnas_extra"] else {},
                          "operaciones": [dict(o) for o in ops]})
    return {"conjunto_id": str(cid), "codigo": c["codigo"], "version": c["version"],
            "aprobado_en": c["aprobado_en"].isoformat() if c["aprobado_en"] else None,
            "exportado_en": datetime.utcnow().isoformat(), "items": items_out}
