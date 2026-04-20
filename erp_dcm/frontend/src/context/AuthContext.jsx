// src/context/AuthContext.jsx
// Provee el estado de autenticación a toda la app.
// Persiste el token y los datos del usuario en localStorage.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // { id, nombre, email, rol }
  const [loading, setLoading] = useState(true)   // verificando token al arrancar

  // Al montar: si hay token guardado, verificarlo
  useEffect(() => {
    const token    = localStorage.getItem('erp_token')
    const userData = localStorage.getItem('erp_user')
    if (token && userData) {
      try {
        setUser(JSON.parse(userData))
      } catch {
        localStorage.removeItem('erp_token')
        localStorage.removeItem('erp_user')
      }
    }
    setLoading(false)
  }, [])

  // Escuchar evento de logout por 401
  useEffect(() => {
    const handler = () => {
      setUser(null)
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_user')
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password)
    localStorage.setItem('erp_token', data.access_token)
    const userData = {
      id:     data.user_id,
      nombre: data.nombre,
      email:  data.email,
    }
    localStorage.setItem('erp_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
