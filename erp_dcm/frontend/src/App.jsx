// src/App.jsx
import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginPage      from './pages/LoginPage.jsx'
import ConjuntosPage  from './pages/ConjuntosPage.jsx'
import EditorPage     from './pages/EditorPage.jsx'
import UsuariosPage   from './pages/UsuariosPage.jsx'
import { ToastArea, IconLayers, IconList, Spinner } from './components/ui.jsx'

// Icono usuario
function IconUser({size=16}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function Shell() {
  const { user, loading, logout } = useAuth()
  const [page,      setPage]      = useState('conjuntos')
  const [editingId, setEditingId] = useState(null)

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Spinner />
      </div>
    )
  }

  if (!user) return <LoginPage />

  function openEditor(id = null) {
    setEditingId(id)
    setPage('editor')
  }
  function goBack() {
    setPage('conjuntos')
    setEditingId(null)
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">DCM</div>
          <div className="logo-name">ERP Ingeniería</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${page === 'conjuntos' || page === 'editor' ? 'active' : ''}`}
            onClick={goBack}
          >
            <IconLayers size={16} /> Conjuntos
          </button>
          <button
            className={`nav-item ${page === 'usuarios' ? 'active' : ''}`}
            onClick={() => setPage('usuarios')}
          >
            <IconUser size={16} /> Usuarios
          </button>
        </nav>

        {/* Footer del sidebar: usuario logueado */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30,
            background: 'var(--c-accent-bg)',
            color: 'var(--c-accent)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 500, flexShrink: 0,
          }}>
            {user.nombre?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, 
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.nombre}
            </div>
            <div className="text-muted" style={{ fontSize: 11,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.email}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={logout}
            title="Cerrar sesión"
            style={{ flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-area">
        {page === 'conjuntos' && (
          <ConjuntosPage onOpen={openEditor} onNew={() => openEditor(null)} />
        )}
        {page === 'editor' && (
          <EditorPage conjuntoId={editingId} onBack={goBack} />
        )}
        {page === 'usuarios' && <UsuariosPage />}
      </main>

      <ToastArea />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
