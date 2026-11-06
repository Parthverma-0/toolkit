import { Building2, Check, GraduationCap, Rocket } from 'lucide-react'
import { ROLES } from '../../constants/roles.js'

const ICONS = { startup: Rocket, incubator: Building2, mentor: GraduationCap }

export default function RoleSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Choose your role" className="grid gap-2.5">
      {ROLES.map(({ id, label, description }) => {
        const selected = value === id
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
              ${selected ? 'border-brand bg-brand-soft/60' : 'border-line bg-white hover:border-glow'}`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition
              ${selected ? 'bg-brand text-white' : 'bg-brand-soft text-brand'}`}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block text-xs leading-snug text-ink-soft">{description}</span>
            </span>
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition
                ${selected ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}
            >
              {selected && <Check size={12} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
