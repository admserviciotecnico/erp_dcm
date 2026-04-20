// src/pages/UsuariosPage.jsx
// Panel para que el admin cree y gestione usuarios.

import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { Spinner, IconPlus, useToast } from '../components/ui.jsx'

export default function UsuariosPage() {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ nombre: '', email: '', password: '' })
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    api.listarUsuarios()
      .then(setUsuarios)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const nuevo = await api.crearUsuario(form)
      setUsuarios(prev => [...prev, nuevo])
      setForm({ nombre: '', email: '', password: '' })
      setShowForm(false)
      toast(`Usuario ${nuevo.nombre} creado`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDesactivar(id, nombre) {
    if (!confirm(`¿Desactivar al usuario ${nombre}?`)) return
    try {
      await api.desactivarUsuario(id)
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: false } : u))
      toast(`${nombre} desactivado`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Usuarios</h1>
          <p className="text-muted" style={{ marginTop: 3 }}>Gestión de acceso al sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <IconPlus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Crear usuario</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="input" required placeholder="Juan García"
                       value={form.nombre}
                       onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" required placeholder="juan@empresa.com"
                       value={form.email}
                       onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña inicial</label>
                <input className="input" type="password" required minLength={8}
                       placeholder="mín. 8 caracteres"
                       value={form.password}
                       onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner /> : 'Crear'}
                </button>
                <button type="button" className="btn btn-ghost"
                        onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.nombre}</td>
                    <td className="mono text-muted">{u.email}</td>
                    <td>
                      <span className="badge badge-neutral">{u.rol}</span>
                    </td>
                    <td>
                      {u.activo
                        ? <span className="badge badge-success">Activo</span>
                        : <span className="badge badge-neutral" style={{ opacity: .6 }}>Inactivo</span>}
                    </td>
                    <td>
                      {u.activo && (
                        <button className="btn btn-ghost btn-sm"
                                onClick={() => handleDesactivar(u.id, u.nombre)}>
                          Desactivar
                        </button>
                      )}
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
