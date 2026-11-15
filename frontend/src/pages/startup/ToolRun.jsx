import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Loader2, Upload, X } from 'lucide-react'
import Async from '../../components/dashboard/Async.jsx'
import { Empty, IconTile } from '../../components/dashboard/Card.jsx'
import { Button, PageHeader } from '../../components/dashboard/ui.jsx'
import { Field, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { useStartupProfile } from '../../components/startup/StartupProfile.jsx'
import { TOOL_ICONS } from '../../constants/tools.js'
import useApi from '../../hooks/useApi.js'
import { errorMessage, fieldErrors, get, isProfileRequired, post, toFormData } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'

const MAX_LENGTH = { text: 300, textarea: 3000 }

// One tool: the inputs it needs on the left, this startup's earlier reports on the right.
export default function ToolRun() {
  const { type } = useParams()
  const tool = useApi(() => get(`/tools/${type}`).then((r) => r.data), [type])

  return (
    <div>
      <Link to="/startup/tools" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-brand">
        <ArrowLeft size={16} aria-hidden="true" /> All tools
      </Link>
      <Async state={tool} label="Loading tool...">
        {(t) => (
          <>
            <PageHeader title={t.name} subtitle={t.description} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ToolForm tool={t} />
              <PastReports type={t.type} />
            </div>
          </>
        )}
      </Async>
    </div>
  )
}

const initialValues = (fields, prefill = {}) =>
  Object.fromEntries(fields.filter((f) => f.type !== 'file').map((f) => [f.name, prefill[f.name] ?? f.default ?? '']))

function ToolForm({ tool }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { complete, requireProfile } = useStartupProfile()
  const [values, setValues] = useState(() => initialValues(tool.fields, location.state?.input))
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (name, v) => {
    setValues((prev) => ({ ...prev, [name]: v }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const validate = () => {
    const next = {}
    tool.fields.forEach((f) => {
      if (f.type === 'file') {
        if (f.required && !file) next[f.name] = `${f.label} is required`
      } else if (f.required && !String(values[f.name] ?? '').trim()) next[f.name] = `${f.label} is required`
    })
    setErrors(next)
    return !Object.keys(next).length
  }

  const generate = async () => {
    setFormError('')
    if (!validate()) return
    setBusy(true)
    try {
      const fileField = tool.fields.find((f) => f.type === 'file')
      const body = fileField ? toFormData({ ...values, [fileField.name]: file }) : values
      const res = await post(`/tools/${tool.type}/reports`, body)
      navigate(`/startup/tools/${tool.type}/reports/${res.data._id}`)
    } catch (err) {
      setBusy(false)
      if (isProfileRequired(err)) return // the "complete your profile" popup is already open
      setErrors(fieldErrors(err))
      setFormError(errorMessage(err))
    }
  }

  const submit = (e) => {
    e.preventDefault()
    requireProfile(generate, 'tool')
  }

  if (busy) return <Generating name={tool.name} hasFile={Boolean(file)} />

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-white p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        {TOOL_ICONS[tool.type] && <IconTile icon={TOOL_ICONS[tool.type]} />}
        <div>
          <h2 className="text-lg font-bold text-ink">Tell us what this report should cover</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your startup profile, founders, metrics and achievements are included automatically, so only add what is specific to this report.
            The more detail you give, the more specific the report will be.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {tool.fields.map((f) => (
          <ToolField key={f.name} field={f} value={f.type === 'file' ? file : values[f.name]}
            error={errors[f.name]} onChange={(v) => (f.type === 'file' ? (setFile(v), setErrors((p) => ({ ...p, [f.name]: undefined }))) : set(f.name, v))} />
        ))}
      </div>

      {formError && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit">Generate report</Button>
        <p className="text-sm text-ink-soft">
          {complete ? 'Takes about a minute. The report is saved under "Your reports".' : 'You will be asked to complete your startup profile first.'}
        </p>
      </div>
    </form>
  )
}

function ToolField({ field: f, value, error, onChange }) {
  const id = `tool-${f.name}`
  let input
  if (f.type === 'textarea') {
    input = <Textarea id={id} rows={4} value={value} maxLength={MAX_LENGTH.textarea} placeholder={f.placeholder}
      error={error} onChange={(e) => onChange(e.target.value)} />
  } else if (f.type === 'select') {
    input = <Select id={id} value={value} error={error} placeholder="Select"
      options={f.options.map((o) => ({ id: o, label: o }))} onChange={(e) => onChange(e.target.value)} />
  } else if (f.type === 'file') {
    input = <FileInput id={id} field={f} file={value} error={error} onChange={onChange} />
  } else {
    input = <TextInput id={id} type={f.type === 'number' ? 'number' : 'text'} value={value} maxLength={MAX_LENGTH.text}
      placeholder={f.placeholder} error={error} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <Field label={f.label} htmlFor={id} required={f.required} optional={!f.required} hint={f.help} error={error}>
      {input}
    </Field>
  )
}

function FileInput({ id, field, file, error, onChange }) {
  const ref = useRef(null)
  const [localError, setLocalError] = useState('')
  const maxBytes = (field.maxMb ?? 4) * 1024 * 1024

  const pick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (field.accept && f.type !== field.accept) return setLocalError('Choose a PDF file.')
    if (f.size > maxBytes) return setLocalError(`The file is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${field.maxMb ?? 4} MB.`)
    setLocalError('')
    onChange(f)
  }

  return (
    <div>
      <input ref={ref} id={id} type="file" accept={field.accept} className="sr-only" onChange={pick} />
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#d5dae3] bg-white px-4 py-3">
          <FileText size={20} className="text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-base text-ink">{file.name}</span>
          <span className="text-sm text-ink-soft">{(file.size / 1048576).toFixed(1)} MB</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove file" className="rounded p-1 text-ink-soft hover:text-ink">
            <X size={18} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={`flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-center transition hover:border-brand hover:bg-brand-soft/40 ${error || localError ? 'border-red-300' : 'border-[#c4cbd8]'}`}>
          <Upload size={22} className="text-brand" aria-hidden="true" />
          <span className="text-base font-semibold text-ink">Choose a PDF</span>
          <span className="text-sm text-ink-soft">Up to {field.maxMb ?? 4} MB</span>
        </button>
      )}
      {localError && <p className="mt-1.5 text-sm text-red-600">{localError}</p>}
    </div>
  )
}

const STEPS = ['Reading your startup profile', 'Analysing your inputs', 'Writing the report', 'Checking figures and formatting']

function Generating({ name, hasFile }) {
  const [step, setStep] = useState(0)
  const steps = useMemo(() => (hasFile ? ['Reading your pitch deck', ...STEPS.slice(1)] : STEPS), [hasFile])
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 12000)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-line bg-white p-8 sm:p-10">
      <Loader2 size={30} className="animate-spin text-brand" aria-hidden="true" />
      <h2 className="mt-5 text-xl font-bold text-ink">Writing your {name}</h2>
      <p className="mt-1.5 text-base text-ink-soft">This usually takes about a minute. Please keep this page open.</p>
      <ol className="mt-6 space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-base ${i <= step ? 'text-ink' : 'text-ink-soft/60'}`}>
            <span className={`size-2.5 rounded-full ${i < step ? 'bg-brand' : i === step ? 'animate-pulse bg-brand' : 'bg-line'}`} />
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

function PastReports({ type }) {
  const { version } = useStartupProfile()
  const reports = useApi(() => get(`/tools/${type}/reports`).then((r) => r.data), [type, version])
  return (
    <aside className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-bold text-ink">Your reports</h2>
      <div className="mt-4">
        <Async state={reports} label="Loading reports...">
          {(list) => (list.length ? (
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li key={r._id}>
                  <Link to={`/startup/tools/${type}/reports/${r._id}`} className="group flex gap-3 py-3.5 first:pt-0">
                    <FileText size={18} className="mt-0.5 shrink-0 text-ink-soft group-hover:text-brand" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-ink group-hover:text-brand">{r.title}</span>
                      {r.subtitle && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{r.subtitle}</span>}
                      <span className="mt-1 block text-xs text-ink-soft">{formatDateTime(r.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No reports yet">Reports you generate with this tool are saved here, so you can open or download them later.</Empty>
          ))}
        </Async>
      </div>
    </aside>
  )
}
