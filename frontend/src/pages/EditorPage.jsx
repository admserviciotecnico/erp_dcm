// src/pages/EditorPage.jsx
// Página principal del módulo de carga:
//   1. Importar BOM desde Excel de SolidWorks
//   2. Ver tabla de ítems, seleccionar ítem
//   3. Asignar plano DWG y operaciones en el panel lateral
//   4. Guardar borrador o Aprobar (freeze)

import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import { parseBomExcel } from '../hooks/useBomParser.js'
import ItemDetailPanel from '../components/ItemDetailPanel.jsx'
import {
  StateBadge, Spinner, useToast,
  IconUpload, IconCheck, IconDownload, IconFile, IconChevron,
} from '../components/ui.jsx'

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'

export default function EditorPage({ conjuntoId, onBack }) {
  const toast   = useToast()
  const fileRef = useRef()

  // ── State ─────────────────────────────────────────────
  const [maestro,       setMaestro]       = useState([])
  const [conjunto,      setConjunto]      = useState(null)   // metadatos cabecera
  const [items,         setItems]         = useState([])     // array de ítems local
  const [selectedIdx,   setSelectedIdx]   = useState(null)
  const [frozen,        setFrozen]        = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [approving,     setApproving]     = useState(false)
  const [extraHeaders,  setExtraHeaders]  = useState([])

  // Metadatos del nuevo conjunto (si no hay conjuntoId)
  const [meta, setMeta] = useState({ codigo: '', descripcion: '', version: '1' })

  // ── Cargar maestro y conjunto existente ───────────────
  useEffect(() => {
    api.getMaestro().then(setMaestro).catch(() => {})

    if (conjuntoId) {
      setLoading(true)
      api.getConjunto(conjuntoId)
        .then(data => {
          setConjunto(data)
          setFrozen(data.estado === 'APROBADO')
          setMeta({ codigo: data.codigo, descripcion: data.descripcion ?? '', version: data.version })
          setItems(data.items.map(it => ({
            ...it,
            _tempId: it.id,
            dwg_file: null,
          })))
        })
        .catch(e => toast(e.message, 'error'))
        .finally(() => setLoading(false))
    }
  }, [conjuntoId])

  // ── Importar Excel ────────────────────────────────────
  async function handleExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const { items: parsed, extraHeaders: eh } = await parseBomExcel(file)
      setItems(parsed)
      setExtraHeaders(eh)
      setSelectedIdx(null)
      toast(`${parsed.length} ítems importados`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    e.target.value = ''
  }

  // ── Actualizar ítem desde el panel ────────────────────
  function handleItemChange(updatedItem) {
    setItems(prev => prev.map(it =>
      it._tempId === updatedItem._tempId ? updatedItem : it
    ))
  }

  // ── Guardar borrador ──────────────────────────────────
  async function handleSave() {
    if (!meta.codigo.trim()) { toast('El código del conjunto es obligatorio', 'error'); return }
    setSaving(true)
    try {
      const payload = buildPayload()

      let saved
      if (conjunto?.id) {
        saved = await api.actualizarConjunto(conjunto.id, payload)
        // Subir DWGs nuevos
        await uploadPendingDwgs(conjunto.id)
      } else {
        saved = await api.crearConjunto(payload)
        await uploadPendingDwgs(saved.id)
      }

      setConjunto(saved)
      // Limpiar dwg_file ya subidos
      setItems(prev => prev.map(it => ({ ...it, dwg_file: null })))
      toast('Borrador guardado', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Aprobar ───────────────────────────────────────────
  async function handleApprove() {
    if (!conjunto?.id) {
      toast('Guardá primero antes de aprobar', 'error'); return
    }
    if (!confirm('¿Aprobar y freezar este conjunto? Esta acción no se puede deshacer.')) return
    setApproving(true)
    try {
      await api.aprobarConjunto(conjunto.id, {
        usuario_id: MOCK_USER_ID,
        comentario: 'Aprobado desde el módulo de carga',
      })
      setFrozen(true)
      setConjunto(prev => ({ ...prev, estado: 'APROBADO' }))
      toast('Conjunto aprobado y freezado', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setApproving(false)
    }
  }

  // ── Exportar JSON ─────────────────────────────────────
  async function handleExport() {
    try {
      const data = await api.exportarConjunto(conjunto.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${meta.codigo}_v${meta.version}_bom.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // ── Helpers ───────────────────────────────────────────
  function buildPayload() {
    return {
      ...meta,
      items: items.map(it => ({
        numero_item:    it.numero_item,
        codigo_pieza:   it.codigo_pieza,
        descripcion:    it.descripcion ?? '',
        cantidad:       it.cantidad,
        tipo:           it.tipo ?? '',
        material:       it.material ?? '',
        peso:           it.peso ?? '',
        columnas_extra: it.columnas_extra ?? {},
        operaciones:    (it.operaciones ?? []).map((op, i) => ({
          orden:        i + 1,
          proceso:      op.proceso,
          tipo_proceso: op.tipo_proceso ?? it.tipo ?? '',
          proveedor:    op.proveedor ?? '',
        })).filter(op => op.proceso),
      })),
    }
  }

  async function uploadPendingDwgs(cid) {
    // Necesitamos los IDs de ítems — volvemos a cargar el conjunto para obtenerlos
    const fresh = await api.getConjunto(cid)
    for (const localItem of items) {
      if (!localItem.dwg_file) continue
      const serverItem = fresh.items.find(
        si => si.numero_item === localItem.numero_item &&
              si.codigo_pieza === localItem.codigo_pieza
      )
      if (!serverItem) continue
      await api.subirDwg(serverItem.id, localItem.dwg_file)
    }
  }

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <Spinner />
      </div>
    )
  }

  const selectedItem = selectedIdx !== null ? items[selectedIdx] : null
  const opsCount     = items.reduce((acc, it) => acc + (it.operaciones?.length ?? 0), 0)
  const dwgCount     = items.filter(it => it.dwg_vigente || it.dwg_file).length

  return (
    <>
      {/* ── Topbar contextual ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <IconChevron size={14} dir="left" /> Conjuntos
          </button>
          <span style={{ color: 'var(--c-border-2)' }}>|</span>
          <span className="topbar-title mono">
            {meta.codigo || 'Nuevo conjunto'}
          </span>
          {conjunto && <StateBadge estado={conjunto.estado} />}
        </div>
        <div className="topbar-actions">
          {conjunto?.estado === 'APROBADO' && (
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              <IconDownload size={14} /> Exportar JSON
            </button>
          )}
        </div>
      </div>

      <div className="page-content">

        {/* ── Metadatos del conjunto ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: 14, alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Código del conjunto *</label>
              <input className="input" placeholder="ej: AB200"
                     value={meta.codigo} disabled={frozen}
                     onChange={e => setMeta(m => ({ ...m, codigo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <input className="input" placeholder="Descripción del producto"
                     value={meta.descripcion} disabled={frozen}
                     onChange={e => setMeta(m => ({ ...m, descripcion: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Versión</label>
              <input className="input" value={meta.version} disabled={frozen}
                     onChange={e => setMeta(m => ({ ...m, version: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ── Importar BOM ── */}
        {!frozen && items.length === 0 && (
          <label className="upload-zone" style={{ marginBottom: 20, display: 'block' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <IconUpload size={24} style={{ color: 'var(--c-accent)' }} />
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                Importar BOM desde SolidWorks
              </div>
              <div className="text-muted text-sm">
                Arrastrá o hacé click para seleccionar un archivo .xls / .xlsx
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleExcel} />
          </label>
        )}

        {/* ── Tabla de ítems + panel derecho ── */}
        {items.length > 0 && (
          <div className="split-layout">

            {/* Tabla */}
            <div>
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">BOM — {items.length} ítems</span>
                    <span className="text-muted" style={{ marginLeft: 12, fontSize: 12 }}>
                      {dwgCount} con plano · {opsCount} operaciones totales
                    </span>
                  </div>
                  {!frozen && (
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                      <IconUpload size={13} /> Reimportar BOM
                      <input type="file" accept=".xls,.xlsx" onChange={handleExcel}
                             style={{ display: 'none' }} />
                    </label>
                  )}
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th style={{ width: 60 }}>Cant.</th>
                        <th style={{ width: 60 }}>Tipo</th>
                        <th style={{ width: 80 }}>Plano</th>
                        <th style={{ width: 70 }}>Ops</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const hasDwg = it.dwg_vigente || it.dwg_file
                        const opsN   = it.operaciones?.length ?? 0
                        return (
                          <tr key={it._tempId}
                              className={selectedIdx === idx ? 'selected' : ''}
                              onClick={() => setSelectedIdx(idx)}
                              style={{ cursor: 'pointer' }}>
                            <td className="mono text-muted">{it.numero_item}</td>
                            <td className="mono" style={{ fontWeight: 500 }}>{it.codigo_pieza}</td>
                            <td style={{ color: 'var(--c-text-2)', maxWidth: 200,
                                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.descripcion}
                            </td>
                            <td className="text-muted">{it.cantidad}</td>
                            <td>
                              {it.tipo
                                ? <span className="badge badge-neutral mono" style={{ fontSize: 11 }}>{it.tipo}</span>
                                : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              {hasDwg
                                ? <span style={{ color: 'var(--c-success)', fontSize: 12, display:'flex', alignItems:'center', gap:3 }}>
                                    <IconFile size={12} /> {it.dwg_file ? 'Pendiente' : 'OK'}
                                  </span>
                                : <span className="text-muted text-sm">—</span>}
                            </td>
                            <td>
                              {opsN > 0
                                ? <span className="badge badge-success" style={{ fontSize: 11 }}>{opsN}</span>
                                : <span className="text-muted text-sm">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Panel derecho */}
            <ItemDetailPanel
              item={selectedItem}
              maestro={maestro}
              frozen={frozen}
              onChange={handleItemChange}
            />
          </div>
        )}
      </div>

      {/* ── Sticky bar ── */}
      {!frozen && items.length > 0 && (
        <div className="sticky-bar">
          <button className="btn btn-ghost" onClick={onBack}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-success" onClick={handleApprove} disabled={approving || !conjunto?.id}>
            {approving ? <Spinner /> : <IconCheck size={14} />}
            {approving ? 'Aprobando…' : 'Aprobar y freezar'}
          </button>
        </div>
      )}
    </>
  )
}
