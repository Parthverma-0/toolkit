import MultiToggle from './MultiToggle.jsx'
import { Field, Select, Textarea, TextInput } from '../ui/Field.jsx'

const INPUT_TYPE = { number: 'number', email: 'email', phone: 'tel', date: 'date', url: 'url' }

// Renders a cohort registration form (Cohort.registrationForm.fields) as inputs.
// value = { [field.key]: answer }, errors = { [field.key]: message }
export default function FormFields({ fields = [], value, onChange, errors = {} }) {
  const set = (key, v) => onChange({ ...value, [key]: v })
  return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
    const id = `ff-${f.key}`
    const v = value[f.key]
    let input
    if (f.type === 'textarea') {
      input = <Textarea id={id} rows={4} value={v ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
    } else if (f.type === 'select') {
      input = <Select id={id} value={v ?? ''} placeholder="Select" error={errors[f.key]}
        options={f.options.map((o) => ({ id: o, label: o }))} onChange={(e) => set(f.key, e.target.value)} />
    } else if (f.type === 'multiselect') {
      input = <MultiToggle label={f.label} options={f.options.map((o) => ({ id: o, label: o }))} value={v ?? []} onChange={(next) => set(f.key, next)} />
    } else if (f.type === 'checkbox') {
      input = (
        <label className="flex cursor-pointer items-center gap-3 text-base text-ink">
          <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} className="size-4 accent-brand" />
          {f.placeholder || 'Yes'}
        </label>
      )
    } else {
      // text, number, email, phone, date, url, file (file answers are links to a shared document)
      input = <TextInput id={id} type={INPUT_TYPE[f.type] ?? 'text'} value={v ?? ''} error={errors[f.key]}
        placeholder={f.type === 'file' ? 'Link to the document (Drive, Dropbox...)' : f.placeholder}
        onChange={(e) => set(f.key, e.target.value)} />
    }
    return (
      <Field key={f.key} label={f.label} htmlFor={id} required={f.required} optional={!f.required} error={errors[f.key]}>
        {input}
      </Field>
    )
  })
}
