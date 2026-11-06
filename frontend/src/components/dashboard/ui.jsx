import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Badge } from './Card.jsx'
import { humanize } from '../../utils/format.js'

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="mb-11 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span aria-hidden="true" className="mb-4 block h-1 w-[47px] rounded-full bg-brand" />
        <h1 className="font-display text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-2.5 max-w-3xl text-base text-ink-soft sm:text-lg">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/* ---------- Buttons ---------- */
export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-brand text-white shadow-[0_10px_25px_-12px_rgba(37,99,235,0.8)] hover:bg-brand-dark',
    secondary: 'border border-line bg-white text-ink hover:border-glow hover:text-brand',
    ghost: 'text-ink-soft hover:bg-brand-soft/60 hover:text-ink',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
  }
  const sizes = { sm: 'px-3.5 py-2 text-sm', md: 'px-5 py-2.5 text-base' }
  return (
    <button
      type="button"
      className={`rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-5 py-2.5 text-base whitespace-nowrap transition ${value === t.id
            ? 'bg-brand-soft font-semibold text-brand'
            : 'font-medium text-ink-soft hover:text-ink'}`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-sm text-ink-soft">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Filter chips ---------- */
export function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${value === o.id
            ? 'border-brand bg-brand font-medium text-white'
            : 'border-line bg-white text-ink-soft hover:border-glow hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search' }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-base text-ink placeholder:text-ink-soft/60
        focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none sm:max-w-sm"
    />
  )
}

/* ---------- Side drawer (forms and details) ---------- */
export function Drawer({ open, title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/25" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-ink-soft hover:bg-canvas">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  )
}

/* ---------- Status pill: one colour map for every status in the app ---------- */
const STATUS_TONE = {
  // positive
  confirmed: 'success', completed: 'success', approved: 'success', disbursed: 'success', invested: 'success',
  accepted: 'success', registered: 'success', attended: 'success', verified: 'success', open: 'success', active: 'success',
  // in progress
  requested: 'brand', submitted: 'brand', in_review: 'brand', under_review: 'brand', meeting_scheduled: 'brand',
  in_discussion: 'brand', shortlisted: 'brand', in_progress: 'brand', registration_open: 'brand', ongoing: 'brand',
  // waiting
  draft: 'neutral', pending: 'warning', upcoming: 'warning', waitlisted: 'warning',
  // negative
  rejected: 'danger', declined: 'danger', cancelled: 'danger', withdrawn: 'neutral', closed: 'neutral', missed: 'danger',
}

export function StatusPill({ status, label }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{label || humanize(status)}</Badge>
}

/* ---------- Key / value list ---------- */
export function Detail({ label, children }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-base text-ink-soft">{label}</dt>
      <dd className="text-base break-words text-ink">{children || <span className="text-ink-soft/60">Not added</span>}</dd>
    </div>
  )
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // toast(message, 'error') shows a red toast and stays a little longer
  const push = useCallback((message, tone) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5000 : 3200)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : undefined}
            className={`max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${t.tone === 'error' ? 'bg-red-600' : 'bg-ink'}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
