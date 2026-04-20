# ERP DCM — Módulo de Carga de Ingeniería

API REST para gestión de BOMs desde SolidWorks, planos DWG y procesos de fabricación.

## Estructura del repositorio

```
erp_dcm/
├── backend/
│   ├── main.py              ← API FastAPI (punto de entrada)
│   ├── init_db.py           ← Script para inicializar el schema en la DB
│   └── requirements.txt
├── database/
│   └── 001_create_schema.sql  ← Schema PostgreSQL completo
├── frontend/                  ← (próximo paso)
├── render.yaml              ← Configuración de servicios en Render
└── .gitignore
```

---

## Deploy en Render — paso a paso

### 1. Subir el repositorio a GitHub

En tu máquina local, dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "feat: estructura inicial ERP DCM"
```

Creá un repositorio nuevo en github.com (sin README, sin .gitignore — ya los tenemos).
Luego conectalo:

```bash
git remote add origin https://github.com/TU_USUARIO/erp_dcm.git
git branch -M main
git push -u origin main
```

---

### 2. Crear los servicios en Render

1. Ingresá a **render.com** y hacé click en **New → Blueprint**
2. Conectá tu cuenta de GitHub si no lo hiciste
3. Seleccioná el repositorio `erp_dcm`
4. Render va a detectar el archivo `render.yaml` automáticamente
5. Click en **Apply** — esto crea dos servicios en un solo paso:
   - `erp-dcm-db` → base de datos PostgreSQL
   - `erp-dcm-api` → web service con la API

Esperá a que el primer deploy termine (2-3 minutos).

---

### 3. Inicializar el schema de la base de datos

Esta es la única acción manual que vas a hacer una sola vez.

1. En Render, entrá al servicio **erp-dcm-api**
2. Hacé click en la pestaña **Shell**
3. Ejecutá:

```bash
python init_db.py
```

Deberías ver:
```
Conectando a la base de datos...
Leyendo schema desde: /opt/render/project/src/database/001_create_schema.sql
Ejecutando schema...
✓ Schema aplicado correctamente.
✓ Seed de tipos_proceso y procesos_maestro insertado.
```

---

### 4. Verificar que todo funciona

La URL de tu API va a ser algo como:
`https://erp-dcm-api.onrender.com`

Verificá el health check:
```
https://erp-dcm-api.onrender.com/health
```
Debería devolver: `{"status": "ok"}`

Abrí la documentación interactiva (Swagger):
```
https://erp-dcm-api.onrender.com/docs
```

Desde ahí podés probar todos los endpoints sin escribir código.

---

### 5. Probar el maestro de procesos

En Swagger, ejecutá:
```
GET /maestro/tipos
```

Debería devolver los 8 tipos (COM, CHA, MEC, INY, TER, PLA, SOL, ARM) con todos sus procesos.

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/maestro/tipos` | Maestro de procesos por tipo |
| GET | `/conjuntos` | Lista todos los conjuntos |
| POST | `/conjuntos` | Crea conjunto nuevo (borrador) |
| GET | `/conjuntos/{id}` | Detalle completo con ítems |
| PUT | `/conjuntos/{id}` | Guarda cambios (sin aprobar) |
| POST | `/conjuntos/{id}/aprobar` | Aprueba y freezea |
| GET | `/conjuntos/{id}/exportar` | Exporta JSON para producción |
| POST | `/items/{id}/dwg` | Sube archivo DWG |
| GET | `/items/{id}/dwg` | Historial de planos del ítem |
| PUT | `/items/{id}/operaciones` | Reemplaza operaciones del ítem |

---

## Nota sobre archivos DWG en producción

En el plan gratuito de Render, el filesystem es **efímero** — los archivos subidos
se pierden entre deploys. Para producción real, hay dos opciones:

- **Opción A (recomendada):** Montar un volumen persistente en Render
  (Render Disks, disponible en plan Starter)
- **Opción B:** Configurar `DWG_BASE_PATH` como una carpeta de red interna
  accesible desde el servidor de Render (requiere VPN o tunnel)

Para desarrollo y pruebas, el filesystem efímero no es un problema.

---

## Próximos pasos

1. Migrar el frontend (demo v5) a React consumiendo esta API
2. Agregar autenticación JWT
3. CRUD para administrar el maestro de procesos desde la UI
4. Módulo de producción: consume `GET /conjuntos?estado=APROBADO` y `/exportar`
