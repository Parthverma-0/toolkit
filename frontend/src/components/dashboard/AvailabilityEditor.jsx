import { useState } from 'react'
import { WEEKDAYS } from '../../constants/enums.js'
import { humanize } from '../../utils/format.js'

// Weekly slots editor: [{ day: 'tue', from: '16:00', to: '18:00' }]
export default function AvailabilityEditor({ value, onChange }) {
  const [draft, setDraft] = useState({ day: 'mon', from: '10:00', to: '12:00' })
  const [error, setError] = useState('')
  const sorted = [...value].sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.from.localeCompare(b.from))

  const add = () => {
    if (draft.from >= draft.to) return setError('End time must be after start time')
    const clash = value.some((s) => s.day === draft.day && draft.from < s.to && s.from < draft.to)
    if (clash) return setError('This overlaps a slot you already added')
    setError('')
    onChange([...value, draft])
  }
  const inputCls = 'rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-ink focus:border-brand focus:outline-none'

  return (
    <div>
      {sorted.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {sorted.map((s) => (
            <li key={`${s.day}${s.from}`} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pr-1.5 pl-3 text-sm text-ink">
              {humanize(s.day)} {s.from}-{s.to}
              <button type="button" aria-label={`Remove ${s.day} ${s.from}`} onClick={() => onChange(value.filter((x) => x !== s))}
                className="rounded-full px-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Day" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} className={inputCls}>
          {WEEKDAYS.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}
        </select>
        <input aria-label="From" type="time" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputCls} />
        <span className="text-sm text-ink-soft">to</span>
        <input aria-label="To" type="time" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputCls} />
        <button type="button" onClick={add} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-glow hover:text-brand">Add slot</button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
