import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '../dashboard/ui.jsx'
import LogoUpload from '../onboarding/LogoUpload.jsx'
import OtpField from '../onboarding/OtpField.jsx'
import { ErrorText, Field, Pills, Select, Textarea, TextInput } from '../ui/Field.jsx'
import {
  EMAIL_REGEX, SECTORS, STAGES, cinError, cleanCin, cleanDipp, dippError, normalizePhone, startupNameError,
} from '../../constants/startup.js'
import { useAuth } from '../../context/AuthContext.jsx'
import useApi from '../../hooks/useApi.js'
import {
  errorMessage, fieldErrors, fileUrl, get, onProfileRequired, patch, post, put, toFormData,
} from '../../api/client.js'

// Startups land on the dashboard right after signing up, with no profile. This provider:
// - loads the startup (GET /startups/me, null until the profile is created) for the whole startup area
// - opens the "complete your profile" popup when the user tries a tool or any other action
//   (requireProfile() on click, or automatically when the API answers 403 PROFILE_INCOMPLETE)
const StartupProfileContext = createContext(null)

// null outside the startup area (incubator / mentor dashboards)
// eslint-disable-next-line react-refresh/only-export-components
export const useStartupProfile = () => useContext(StartupProfileContext)

export function StartupProfileProvider({ children }) {
  const api = useApi(() => get('/startups/me').then((r) => r.data))
  const [prompt, setPrompt] = useState(null) // null = closed, otherwise { reason, then }
  const [version, setVersion] = useState(0) // bumps after the profile is saved so pages reload

  const startup = api.data ?? null
  const complete = Boolean(startup?.isProfileComplete)

  const openProfileForm = useCallback((reason, then) => setPrompt({ reason, then }), [])

  // Run `action` if the profile is complete, otherwise ask for it first (and run it afterwards)
  const requireProfile = useCallback((action, reason) => {
    if (complete) return action?.()
    setPrompt({ reason, then: action })
    return undefined
  }, [complete])

  useEffect(() => onProfileRequired(() => setPrompt((p) => p ?? { reason: 'action' })), [])

  const handleSaved = async () => {
    const then = prompt?.then
    setPrompt(null)
    await api.reload()
    setVersion((v) => v + 1)
    then?.()
  }

  const value = useMemo(() => ({
    startup, complete, loading: api.data === undefined, error: api.error,
    reload: api.reload, version, requireProfile, openProfileForm,
  }), [startup, complete, api.data, api.error, api.reload, version, requireProfile, openProfileForm])

  return (
    <StartupProfileContext.Provider value={value}>
      {children}
      {prompt && (
        <CompleteProfileModal reason={prompt.reason} existing={startup} onClose={() => setPrompt(null)} onDone={handleSaved} />
      )}
    </StartupProfileContext.Provider>
  )
}

const REASONS = {
  tool: 'Tools use your startup details to tailor their output. Add them once to start using every tool.',
  action: 'Add your startup details to continue. Only the fields marked * are required.',
}

const STEPS = [
  { title: 'Startup details', description: 'What you do' },
  { title: 'Founder & contact', description: 'Who runs it' },
  { title: 'Review', description: 'Check and save' },
]

const TEXT_MAX = 3000
const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? '-'

// Startup document (+ the user's founder profile) -> form values
const initialForm = (existing, user) => {
  const me = existing?.founders?.find((f) => f.isPrimary)
  return {
    name: existing?.name?.includes('@') ? '' : existing?.name ?? '',
    startupEmail: existing?.startupEmail ?? user?.email ?? '',
    sector: existing?.sector ?? '',
    stage: existing?.stage ?? '',
    cin: existing?.cin ?? '',
    dippNumber: existing?.dippNumber ?? '',
    problemStatement: existing?.problemStatement ?? '',
    solution: existing?.solution ?? '',
    logo: null,
    fullName: me?.fullName ?? user?.name ?? '',
    designation: me?.designation ?? '',
    phone: (me?.phone ?? user?.phone ?? '').replace(/^\+91/, ''),
    linkedin: me?.linkedin ?? '',
  }
}

const validateStep = (step, f, emailVerified) => {
  const e = {}
  if (step === 0) {
    if (startupNameError(f.name)) e.name = startupNameError(f.name)
    if (!EMAIL_REGEX.test(f.startupEmail.trim())) e.startupEmail = 'Enter a valid email address'
    else if (!emailVerified) e.startupEmail = 'Verify this email with the code we send you'
    if (!f.sector) e.sector = 'Choose a sector'
    if (!f.stage) e.stage = 'Choose your current stage'
    if (cinError(f.cin)) e.cin = cinError(f.cin)
    if (dippError(f.dippNumber)) e.dippNumber = dippError(f.dippNumber)
  }
  if (step === 1) {
    // All optional, but a founder entry needs a name once anything else is filled in
    const anyFounder = [f.designation, f.phone, f.linkedin].some((v) => v.trim())
    if (anyFounder && !f.fullName.trim()) e.fullName = 'Enter your full name'
    if (f.phone.trim() && !normalizePhone(f.phone)) e.phone = 'Enter a valid 10-digit mobile number'
    if (f.linkedin.trim() && !/^https?:\/\/\S+\.\S+/.test(f.linkedin.trim())) e.linkedin = 'Enter a full URL, e.g. https://linkedin.com/in/...'
  }
  return e
}

const STEP_OF_FIELD = { fullName: 1, designation: 1, phone: 1, linkedin: 1 }

// Three-step popup: startup details -> founder & contact -> review.
// Required: startup name, email, sector, stage. Everything else is optional.
function CompleteProfileModal({ reason, existing, onClose, onDone }) {
  const { user } = useAuth()
  const [form, setForm] = useState(() => initialForm(existing, user))
  const [step, setStep] = useState(0)
  const [emailVerified, setEmailVerified] = useState(true) // prefilled with the account email (or the saved one)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const [startupSaved, setStartupSaved] = useState(Boolean(existing))
  const bodyRef = useRef(null)

  const logoPreview = useMemo(() => (form.logo ? URL.createObjectURL(form.logo) : fileUrl(existing?.logo) || ''), [form.logo, existing?.logo])
  useEffect(() => () => { if (form.logo) URL.revokeObjectURL(logoPreview) }, [form.logo, logoPreview])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (values) => {
    setForm((f) => ({ ...f, ...values }))
    setErrors((e) => {
      const next = { ...e }
      Object.keys(values).forEach((k) => delete next[k])
      return next
    })
  }

  const goTo = (i) => {
    setStep(i)
    setErrors({})
    setSubmitError('')
    bodyRef.current?.scrollTo({ top: 0 })
  }

  const next = () => {
    const errs = validateStep(step, form, emailVerified)
    setErrors(errs)
    if (!Object.keys(errs).length) goTo(step + 1)
  }

  // 1) create (or update) the startup  2) save the founder profile if a name was given
  const submit = async () => {
    setSaving(true)
    setSubmitError('')
    try {
      const startupBody = toFormData({
        name: form.name.trim(), startupEmail: form.startupEmail.trim().toLowerCase(), sector: form.sector, stage: form.stage,
        cin: form.cin, dippNumber: form.dippNumber, logo: form.logo,
        problemStatement: form.problemStatement.trim(), solution: form.solution.trim(),
      })
      if (startupSaved) await patch('/startups/me', startupBody)
      else {
        await post('/startups/me', startupBody)
        setStartupSaved(true) // a retry after a founder error must not create it twice
      }
      if (form.fullName.trim()) {
        await put('/startups/me/founders/primary', toFormData({
          fullName: form.fullName.trim(), designation: form.designation.trim(),
          phone: form.phone.trim() ? normalizePhone(form.phone) : undefined, linkedin: form.linkedin.trim(),
        }))
      }
      await onDone()
    } catch (err) {
      const fe = fieldErrors(err)
      setSubmitError(errorMessage(err))
      if (Object.keys(fe).length) {
        const target = Object.keys(fe).some((k) => STEP_OF_FIELD[k]) ? 1 : 0
        setStep(target)
        setErrors(fe)
      }
    } finally {
      setSaving(false)
    }
  }

  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cp-title">
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 bg-ink/35" />
      <div className="relative my-8 flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header + steps */}
        <div className="border-b border-line px-6 pt-6 pb-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="cp-title" className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">Complete your startup profile</h2>
              <p className="mt-1.5 text-base text-ink-soft">{REASONS[reason] ?? REASONS.action}</p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-ink-soft hover:bg-canvas">
              <X size={20} />
            </button>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const done = i < step
              const active = i === step
              return (
                <li key={s.title}>
                  <button type="button" disabled={!done} onClick={() => goTo(i)} className="group w-full text-left disabled:cursor-default">
                    <span className={`block h-1.5 rounded-full transition ${done || active ? 'bg-brand' : 'bg-line'}`} />
                    <span className="mt-2.5 flex items-center gap-2">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                        ${active ? 'bg-brand text-white' : done ? 'bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white' : 'bg-canvas text-ink-soft'}`}>
                        {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`truncate text-sm font-semibold ${active || done ? 'text-ink' : 'text-ink-soft'}`}>{s.title}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Step body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {step === 0 && (
            <div className="grid gap-5">
              <Field label="Logo" optional>
                <LogoUpload file={form.logo} onChange={(logo) => set({ logo })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Startup name" htmlFor="cp-name" required error={errors.name}>
                  <TextInput id="cp-name" name="organization" autoComplete="organization" value={form.name} maxLength={150}
                    placeholder="Acme Labs Pvt. Ltd." error={errors.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
                </Field>
                <Field label="Sector" htmlFor="cp-sector" required error={errors.sector}>
                  <Select id="cp-sector" value={form.sector} options={SECTORS} placeholder="Select a sector" error={errors.sector}
                    onChange={(e) => set({ sector: e.target.value })} />
                </Field>
              </div>
              <Field label="Startup email" htmlFor="cp-email" required
                hint={form.startupEmail.trim().toLowerCase() === user?.email ? 'Your sign-in email. Change it to use a company inbox.' : 'We will send a code to verify this inbox'}>
                <OtpField id="cp-email" channel="email" type="email" autoComplete="email" value={form.startupEmail} placeholder="hello@acmelabs.in"
                  toTarget={(v) => v.trim().toLowerCase()}
                  onChange={(startupEmail) => {
                    set({ startupEmail })
                    const v = startupEmail.trim().toLowerCase()
                    setEmailVerified(v === user?.email || Boolean(existing && v === existing.startupEmail))
                  }}
                  verified={emailVerified} onVerified={() => { setEmailVerified(true); setErrors((x) => ({ ...x, startupEmail: undefined })) }}
                  validate={(v) => (EMAIL_REGEX.test(v.trim()) ? '' : 'Enter a valid email address')} error={errors.startupEmail} />
              </Field>
              <Field label="Current stage" required error={errors.stage}>
                <Pills label="Current stage" options={STAGES} value={form.stage} onChange={(stage) => set({ stage })} error={errors.stage} />
              </Field>
              <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                <Field label="CIN" htmlFor="cp-cin" optional error={errors.cin} hint="21-character Corporate Identification Number">
                  <TextInput id="cp-cin" value={form.cin} maxLength={21} className="font-mono uppercase" placeholder="U72900KA2021PTC123456"
                    error={errors.cin} onChange={(e) => set({ cin: cleanCin(e.target.value) })}
                    onBlur={() => setErrors((x) => ({ ...x, cin: cinError(form.cin) || undefined }))} />
                </Field>
                <Field label="DIPP number" htmlFor="cp-dipp" optional error={errors.dippNumber} hint="6-digit Startup India recognition number">
                  <TextInput id="cp-dipp" value={form.dippNumber} inputMode="numeric" maxLength={6} className="font-mono" placeholder="123456"
                    error={errors.dippNumber} onChange={(e) => set({ dippNumber: cleanDipp(e.target.value) })}
                    onBlur={() => setErrors((x) => ({ ...x, dippNumber: dippError(form.dippNumber) || undefined }))} />
                </Field>
              </div>
              <Field label="Problem statement" htmlFor="cp-problem" optional hint={`${form.problemStatement.length} / ${TEXT_MAX}`}>
                <Textarea id="cp-problem" rows={3} maxLength={TEXT_MAX} value={form.problemStatement}
                  placeholder="What problem are you solving, and for whom?" onChange={(e) => set({ problemStatement: e.target.value })} />
              </Field>
              <Field label="Solution" htmlFor="cp-solution" optional hint={`${form.solution.length} / ${TEXT_MAX}`}>
                <Textarea id="cp-solution" rows={3} maxLength={TEXT_MAX} value={form.solution}
                  placeholder="How does your product solve it?" onChange={(e) => set({ solution: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <p className="text-base text-ink-soft">You are the primary founder. Co-founders can be added later from your profile. Everything here is optional.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="cp-fullname" optional error={errors.fullName}>
                  <TextInput id="cp-fullname" autoComplete="name" value={form.fullName} maxLength={100} placeholder="Priya Sharma"
                    error={errors.fullName} onChange={(e) => set({ fullName: e.target.value })} />
                </Field>
                <Field label="Designation" htmlFor="cp-designation" optional error={errors.designation}>
                  <TextInput id="cp-designation" autoComplete="organization-title" value={form.designation} maxLength={60} placeholder="Founder & CEO"
                    error={errors.designation} onChange={(e) => set({ designation: e.target.value })} />
                </Field>
              </div>
              <Field label="Email" htmlFor="cp-founder-email" hint="Your Google sign-in email">
                <div className="flex gap-2">
                  <TextInput id="cp-founder-email" type="email" value={user?.email ?? ''} readOnly className="flex-1 bg-sidebar" />
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-emerald-50 px-4 text-base font-semibold text-emerald-700">Verified</span>
                </div>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Mobile number" htmlFor="cp-phone" optional error={errors.phone}>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-ink-soft">+91</span>
                    <TextInput id="cp-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} placeholder="98765 43210"
                      error={errors.phone} className="pl-12!" onChange={(e) => set({ phone: e.target.value })} />
                  </div>
                </Field>
                <Field label="LinkedIn" htmlFor="cp-linkedin" optional error={errors.linkedin}>
                  <TextInput id="cp-linkedin" type="url" value={form.linkedin} placeholder="https://linkedin.com/in/..."
                    error={errors.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <ReviewSection title="Startup details" onEdit={() => goTo(0)}>
                <div className="mb-1 flex items-center gap-4">
                  {logoPreview && <img src={logoPreview} alt="" className="size-14 rounded-xl border border-line object-cover" />}
                  <div>
                    <p className="text-lg font-semibold text-ink">{form.name}</p>
                    <p className="text-sm text-ink-soft">{labelOf(SECTORS, form.sector)} · {labelOf(STAGES, form.stage)}</p>
                  </div>
                </div>
                <ReviewRow label="Startup email" value={form.startupEmail.trim().toLowerCase()} />
                <ReviewRow label="CIN" value={form.cin} mono />
                <ReviewRow label="DIPP number" value={form.dippNumber} mono />
                <ReviewRow label="Problem statement" value={form.problemStatement.trim()} />
                <ReviewRow label="Solution" value={form.solution.trim()} />
              </ReviewSection>
              <ReviewSection title="Founder & contact" onEdit={() => goTo(1)}>
                <ReviewRow label="Name" value={[form.fullName.trim(), form.designation.trim()].filter(Boolean).join(', ')} />
                <ReviewRow label="Email" value={user?.email} />
                <ReviewRow label="Mobile" value={form.phone.trim() && normalizePhone(form.phone)} />
                <ReviewRow label="LinkedIn" value={form.linkedin.trim()} />
              </ReviewSection>
              <p className="text-sm text-ink-soft">You can change any of this later from your profile.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-4 sm:px-8">
          {(submitError || Object.values(errors).some(Boolean)) && (
            <div className="mb-2 text-right">
              <ErrorText>{submitError || 'Fix the highlighted fields to continue.'}</ErrorText>
            </div>
          )}
          <div className="flex items-center gap-2">
            {step > 0
              ? <Button variant="secondary" onClick={() => goTo(step - 1)}>Back</Button>
              : <Button variant="ghost" onClick={onClose}>Not now</Button>}
            <span className="flex-1 text-center text-sm text-ink-soft">Step {step + 1} of {STEPS.length}</span>
            <Button onClick={last ? submit : next} disabled={saving}>
              {last ? (saving ? 'Saving...' : 'Save profile') : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="text-base font-semibold text-brand hover:text-brand-dark">Edit</button>
      </div>
      <dl className="grid gap-3">{children}</dl>
    </section>
  )
}

function ReviewRow({ label, value, mono }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`text-base break-words text-ink ${mono ? 'font-mono' : ''}`}>{value || <span className="text-ink-soft/60">Not added</span>}</dd>
    </div>
  )
}
