// Multi-select pill group (sectors, expertise, ...). `options` = [{ id, label }], `value` = array of ids.
export default function MultiToggle({ options, value, onChange, label }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id)
        return (
          <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(o.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on
              ? 'border-brand bg-brand font-medium text-white'
              : 'border-line bg-white text-ink-soft hover:border-glow hover:text-ink'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
