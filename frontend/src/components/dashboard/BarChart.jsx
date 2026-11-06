import { useState } from 'react'

// Single-series vertical bar chart. Brand blue marks, 4px rounded tops anchored to
// the baseline, a 2px gap between bars, recessive gridlines and a hover tooltip.
// `data` = [{ label, value }]. Always pair it with a table view of the same numbers.
export default function BarChart({ data, format = (v) => v, height = 180, ariaLabel }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  const ticks = [0, 0.5, 1].map((t) => t * max)

  return (
    <figure aria-label={ariaLabel} className="relative">
      <div className="flex gap-3">
        <div className="flex flex-col justify-between text-right text-[11px] text-ink-soft" style={{ height }}>
          {[...ticks].reverse().map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{format(t)}</span>)}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" style={{ height }}>
            {ticks.map((t) => <div key={t} className="border-t border-line/70" />)}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height }}>
            {data.map((d, i) => (
              <div
                key={d.label}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full max-w-10 rounded-t-[4px] transition-colors ${hover === i ? 'bg-brand-dark' : 'bg-brand'}`}
                  style={{ height: `${(d.value / max) * 100}%` }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
                    style={{ bottom: `calc(${(d.value / max) * 100}% + 6px)` }}>
                    <span className="text-white/70">{d.label}</span> <span className="font-semibold">{format(d.value)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-[2px]">
            {data.map((d) => <span key={d.label} className="flex-1 text-center text-[11px] text-ink-soft">{d.label}</span>)}
          </div>
        </div>
      </div>
    </figure>
  )
}
