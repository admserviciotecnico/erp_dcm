// src/pages/ConjuntosPage.jsx
// Lista todos los conjuntos guardados. Permite crear uno nuevo
// o abrir uno existente para seguir editándolo.

import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { StateBadge, Spinner, IconPlus, IconLayers, useToast } from '../components/ui.jsx'

export default function ConjuntosPage({ onOpen, onNew }) {
  const [conjuntos, setConjuntos] = useState([])
  const [loading, setLoading]     = useState(true)
  const toast = useToast()

  useEffect(() => {
    api.listarConjuntos()
      .then(setConjuntos)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Conjuntos</h1>
          <p className="text-muted" style={{ marginTop: 3 }}>
            BOMs importadas desde SolidWorks
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          <IconPlus size={15} /> Nuevo conjunto
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : conjuntos.length === 0 ? (
          <div className="empty-state">
            <IconLayers size={28} />
            <p>No hay conjuntos cargados todavía</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNew}>
              <IconPlus size={14} /> Crear el primero
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Versión</th>
                  <th>Ítems</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conjuntos.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c.id)}>
                    <td className="mono">{c.codigo}</td>
                    <td style={{ color: 'var(--c-text-2)', maxWidth: 260,
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.descripcion ?? '—'}
                    </td>
                    <td className="mono">{c.version}</td>
                    <td style={{ color: 'var(--c-text-2)' }}>{c.total_items}</td>
                    <td><StateBadge estado={c.estado} /></td>
                    <td className="text-muted">
                      {new Date(c.actualizado_en ?? c.creado_en).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm"
                              onClick={e => { e.stopPropagation(); onOpen(c.id) }}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
