// src/components/ItemDetailPanel.jsx
// Panel derecho: muestra DWG y operaciones del ítem seleccionado.
// Llamado desde la página principal con el ítem activo.

import { useState } from 'react'
import {
  IconUpload, IconPlus, IconTrash, IconFile,
  Spinner, useToast,
} from './ui.jsx'

export default function ItemDetailPanel({ item, maestro, frozen, onChange }) {
  const toast = useToast()
  const [uploading, setUploading] = useState(false)

  if (!item) {
    return (
      <div className="card" style={{ minHeight: 300 }}>
        <div className="empty-state">
          <IconFile size={28} />
          <p>Seleccioná un ítem para editar su plano y procesos</p>
        </div>
      </div>
    )
  }

  const tipo = item.tipo?.toUpperCase() ?? ''
  const maestroTipo = maestro.find(t => t.codigo === tipo)
  const procesosDisponibles = maestroTipo?.procesos ?? []

  // ── DWG ──────────────────────────────────────────────
  function handleDwgChange(e) {
    const file = e.target.files[0]
    if (!file) return
    onChange({ ...item, dwg_file: file, dwg_vigente: file.name })
  }

  // ── Operaciones ───────────────────────────────────────
  function addOp() {
    if ((item.operaciones?.length ?? 0) >= 10) {
      toast('Máximo 10 operaciones por ítem', 'error'); return
    }
    const ops = [...(item.operaciones ?? [])]
    ops.push({ orden: ops.length + 1, proceso: '', tipo_proceso: tipo, proveedor: '' })
    onChange({ ...item, operaciones: ops })
  }

  function removeOp(idx) {
    const ops = item.operaciones.filter((_, i) => i !== idx)
      .map((o, i) => ({ ...o, orden: i + 1 }))
    onChange({ ...item, operaciones: ops })
  }

  function updateOp(idx, field, value) {
    const ops = item.operaciones.map((o, i) => {
      if (i !== idx) return o
      const updated = { ...o, [field]: value }
      if (field === 'proceso') {
        const found = procesosDisponibles.find(p => p.nombre === value)
        if (found) updated.proveedor = found.proveedor_default ?? ''
      }
      return updated
    })
    onChange({ ...item, operaciones: ops })
  }

  return (
    <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 20px)' }}>
      <div className="card-header">
        <div>
          <div className="card-title">{item.codigo_pieza}</div>
          <div className="text-muted" style={{ marginTop: 2 }}>{item.descripcion}</div>
        </div>
        {tipo && (
          <span className="badge badge-neutral mono">{tipo}</span>
        )}
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Info básica ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Cantidad</label>
            <input className="input" value={item.cantidad} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Material</label>
            <input className="input" value={item.material ?? ''} disabled />
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* ── Plano DWG ── */}
        <div>
          <div className="form-label" style={{ marginBottom: 8 }}>Plano DWG</div>
          {item.dwg_vigente ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'var(--c-success-bg)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
            }}>
              <IconFile size={14} />
              <span className="mono" style={{ flex: 1, color: 'var(--c-success)' }}>
                {item.dwg_vigente}
              </span>
              {!frozen && (
                <label style={{ cursor: 'pointer', color: 'var(--c-text-2)', fontSize: 12 }}>
                  Cambiar
                  <input type="file" accept=".dwg" onChange={handleDwgChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          ) : (
            <label className={`upload-zone ${frozen ? '' : ''}`}
                   style={{ padding: '16px', cursor: frozen ? 'not-allowed' : 'pointer' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <IconUpload size={20} style={{ color: 'var(--c-text-3)' }} />
                <span className="text-sm text-muted">
                  {frozen ? 'Conjunto aprobado' : 'Seleccionar archivo .dwg'}
                </span>
              </div>
              <input type="file" accept=".dwg" onChange={handleDwgChange} disabled={frozen} />
            </label>
          )}
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* ── Operaciones ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="form-label">
              Operaciones
              <span className="text-muted" style={{ marginLeft: 6 }}>
                ({item.operaciones?.length ?? 0}/10)
              </span>
            </div>
            {!frozen && (
              <button className="btn btn-ghost btn-sm" onClick={addOp}>
                <IconPlus size={13} /> Agregar
              </button>
            )}
          </div>

          {(!item.operaciones || item.operaciones.length === 0) ? (
            <div className="text-muted text-sm" style={{ padding: '8px 0' }}>
              {procesosDisponibles.length === 0
                ? 'Tipo no reconocido — ingresá las operaciones manualmente'
                : 'Sin operaciones — hacé click en Agregar'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {item.operaciones.map((op, idx) => (
                <div key={idx} className="ops-row">
                  <span className="order-num">{op.orden}</span>
                  <select
                    className="select"
                    value={op.proceso}
                    disabled={frozen}
                    onChange={e => updateOp(idx, 'proceso', e.target.value)}
                  >
                    <option value="">Proceso...</option>
                    {procesosDisponibles.map(p => (
                      <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                    ))}
                    {/* Si el proceso guardado no está en la lista, igual lo mostramos */}
                    {op.proceso && !procesosDisponibles.find(p => p.nombre === op.proceso) && (
                      <option value={op.proceso}>{op.proceso}</option>
                    )}
                  </select>
                  <input
                    className="input"
                    placeholder="Proveedor"
                    value={op.proveedor ?? ''}
                    disabled={frozen}
                    onChange={e => updateOp(idx, 'proveedor', e.target.value)}
                  />
                  {!frozen && (
                    <button className="btn btn-icon btn-danger" onClick={() => removeOp(idx)}>
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
