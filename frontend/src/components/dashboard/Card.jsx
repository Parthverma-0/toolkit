import { Link } from 'react-router-dom'

// Icon in a soft-blue rounded tile (the dashboard's icon style)
export function IconTile({ icon: Icon, size = 'md' }) {
  const box = size === 'sm' ? 'size-11' : 'size-[58px]'
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand shadow-[0_2px_6px_-2px_rgba(37,99,235,0.18)]`}>
      <Icon size={size === 'sm' ? 22 : 32} strokeWidth={1.5} aria-hidden="true" />
    </span>
  )
}

// Section card used on dashboard pages. `to` adds a "View all" link in the header,
// `icon` puts an icon tile before the title.
export function Card({ title, icon, to, linkLabel = 'View all', action, className = '', children }) {
  return (
    <section className={`rounded-xl border border-line bg-white p-5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.08)] sm:p-[26px] ${className}`}>
      {(title || to || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && (
            <div className="flex items-center gap-3">
              {icon && <IconTile icon={icon} size="sm" />}
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
            </div>
          )}
          {to && <Link to={to} className="text-sm font-semibold whitespace-nowrap text-brand hover:text-brand-dark">{linkLabel}</Link>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ value, label, icon }) {
  return (
    <div>
      {icon && <div className="mb-4"><IconTile icon={icon} size="sm" /></div>}
      <p className="font-display text-[36px] leading-tight font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{label}</p>
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="py-6 text-center">
      {title && <p className="font-semibold text-ink">{title}</p>}
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const TONES = {
  neutral: 'bg-[#e9eef8] text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>
}

export function Progress({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  )
}
