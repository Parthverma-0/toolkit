import { ChevronDown } from 'lucide-react'

const inputClass = (error) =>
  `w-full rounded-lg border bg-white px-4 py-[11px] text-base text-ink placeholder:text-ink-soft/50 transition
  focus:outline-none focus:ring-4 ${error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
    : 'border-[#d5dae3] focus:border-brand focus:ring-brand/15'}`

export const ErrorText = ({ children }) => (children ? <p className="mt-1.5 text-sm text-red-600">{children}</p> : null)

export function Field({ label, htmlFor, required, optional, hint, error, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[15px] font-semibold text-ink">
          {label}
          {required && <span className="text-brand"> *</span>}
        </label>
        {optional && <span className="text-sm text-ink-soft">Optional</span>}
      </div>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : hint && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

export function TextInput({ error, className = '', ...props }) {
  return <input aria-invalid={Boolean(error)} className={`${inputClass(error)} ${className}`} {...props} />
}

export function Textarea({ error, className = '', ...props }) {
  return <textarea aria-invalid={Boolean(error)} className={`${inputClass(error)} resize-y ${className}`} {...props} />
}

export function Select({ error, options, placeholder, className = '', ...props }) {
  return (
    <div className="relative">
      <select aria-invalid={Boolean(error)} className={`${inputClass(error)} appearance-none pr-10 ${className}`} {...props}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-soft" />
    </div>
  )
}

export function Pills({ options, value, onChange, error, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`rounded-lg border px-4 py-2 text-[15px] transition
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
              ${selected
                ? 'border-brand bg-brand font-medium text-white'
                : `${error ? 'border-red-300' : 'border-[#d5dae3]'} bg-white text-ink hover:border-glow`}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
