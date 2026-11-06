// Single-series horizontal bars with direct labels: label left, value right,
// brand-blue bar underneath. Used for rankings and funnels. Hovering a row shows `note`.
// `rows` = [{ label, value, note? }]
export default function HBarList({ rows, format = (v) => v, ariaLabel }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul aria-label={ariaLabel} className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label} title={r.note} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{r.label}</span>
            <span className="shrink-0 font-medium text-ink tabular-nums">
              {format(r.value)}
              {r.note && <span className="ml-2 text-xs font-normal text-ink-soft">{r.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/70">
            <div className="h-full rounded-full bg-brand transition-colors group-hover:bg-brand-dark" style={{ width: `${Math.max((r.value / max) * 100, 1)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
