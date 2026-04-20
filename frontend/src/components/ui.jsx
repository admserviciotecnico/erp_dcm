// src/components/ui.jsx
// Componentes compartidos: Toast, Badge, iconos, LoadingSpinner

import { useState, useEffect, useCallback } from 'react'

// ── Toast system ─────────────────────────────────────────
let _addToast = null
export function useToast() {
  const show = useCallback((msg, type = 'default') => {
    _addToast?.({ msg, type, id: Date.now() })
  }, [])
  return show
}

export function ToastArea() {
  const [toasts, setToasts] = useState([])
  _addToast = (t) => {
    setToasts(p => [...p, t])
    setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3500)
  }
  return (
    <div className="toast-area">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <IconCheck size={15} />}
          {t.type === 'error'   && <IconX size={15} />}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────
export function StateBadge({ estado }) {
  if (estado === 'APROBADO')  return <span className="badge badge-frozen"><IconLock size={11} /> Aprobado</span>
  return <span className="badge badge-edit"><IconPencil size={11} /> En edición</span>
}

// ── Spinner ──────────────────────────────────────────────
export function Spinner() { return <span className="spinner" /> }

// ── Icons (SVG inline, sin dependencias) ─────────────────
const icon = (d, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export const IconUpload   = ({size=16}) => icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, size)
export const IconPlus     = ({size=16}) => icon(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, size)
export const IconTrash    = ({size=16}) => icon(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>, size)
export const IconCheck    = ({size=16}) => icon(<polyline points="20 6 9 17 4 12"/>, size)
export const IconX        = ({size=16}) => icon(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, size)
export const IconLock     = ({size=16}) => icon(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, size)
export const IconPencil   = ({size=16}) => icon(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>, size)
export const IconFile     = ({size=16}) => icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>, size)
export const IconDownload = ({size=16}) => icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, size)
export const IconList     = ({size=16}) => icon(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>, size)
export const IconLayers   = ({size=16}) => icon(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>, size)
export const IconChevron  = ({size=16, dir='down'}) => {
  const pts = { down:'m6 9 6 6 6-6', right:'m9 18 6-6-6-6', left:'m15 18-6-6 6-6' }
  return icon(<polyline points={pts[dir]}/>, size)
}
