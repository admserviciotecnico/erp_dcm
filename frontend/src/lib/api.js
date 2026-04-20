// src/lib/api.js
// Cliente API con soporte JWT.
// El token se guarda en localStorage y se adjunta a cada request.

const BASE = import.meta.env.VITE_API_URL ?? '/api'

function getToken() {
  return localStorage.getItem('erp_token') ?? ''
}

async function request(method, path, body, isForm = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isForm) headers['Content-Type'] = 'application/json'

  const opts = { method, headers }
  if (body !== undefined && !isForm) opts.body = JSON.stringify(body)
  if (isForm) opts.body = body

  const res = await fetch(`${BASE}${path}`, opts)

  if (res.status === 401) {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    window.dispatchEvent(new Event('auth:logout'))
    throw new Error('Sesión expirada. Iniciá sesión nuevamente.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Error desconocido')
  }
  return res.json()
}

export const api = {
  // Auth
  login: async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Credenciales incorrectas' }))
      throw new Error(err.detail ?? 'Error al iniciar sesión')
    }
    return res.json()
  },
  me: () => request('GET', '/auth/me'),

  // Admin usuarios
  listarUsuarios:    ()        => request('GET',   '/admin/usuarios'),
  crearUsuario:      (payload) => request('POST',  '/admin/usuarios', payload),
  desactivarUsuario: (id)      => request('PATCH', `/admin/usuarios/${id}/desactivar`),

  // Maestro
  getMaestro: () => request('GET', '/maestro/tipos'),

  // Conjuntos
  listarConjuntos:    (estado) => request('GET',  `/conjuntos${estado ? `?estado=${estado}` : ''}`),
  getConjunto:        (id)     => request('GET',  `/conjuntos/${id}`),
  crearConjunto:      (body)   => request('POST', '/conjuntos', body),
  actualizarConjunto: (id, b)  => request('PUT',  `/conjuntos/${id}`, b),
  aprobarConjunto:    (id, b)  => request('POST', `/conjuntos/${id}/aprobar`, b),
  exportarConjunto:   (id)     => request('GET',  `/conjuntos/${id}/exportar`),

  // Operaciones
  setOperaciones: (itemId, ops) => request('PUT', `/items/${itemId}/operaciones`, ops),

  // DWG
  listarDwg: (itemId) => request('GET', `/items/${itemId}/dwg`),
  subirDwg: async (itemId, file) => {
    const form = new FormData()
    form.append('archivo', file)
    return request('POST', `/items/${itemId}/dwg`, form, true)
  },
}
