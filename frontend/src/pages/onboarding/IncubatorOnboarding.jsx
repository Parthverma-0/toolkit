import { useRef, useState } from 'react'
import OnboardingFrame, { ReviewBlock, StepHeading, StepNav, SuccessPanel } from '../../components/onboarding/OnboardingFrame.jsx'
import { Detail } from '../../components/dashboard/ui.jsx'
import MultiToggle from '../../components/dashboard/MultiToggle.jsx'
import { ErrorText, Field, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { EMAIL_REGEX, SECTORS, normalizePhone } from '../../constants/startup.js'
import { INCUBATOR_TYPES } from '../../constants/enums.js'
import { errorMessage, fieldErrors, post } from '../../api/client.js'
import { humanize } from '../../utils/format.js'

const STEPS = [
  { title: 'Incubator details', description: 'Who you are and what you focus on' },
  { title: 'Contact & address', description: 'How startups reach you' },
  { title: 'Review', description: 'Check everything and submit' },
]
const TYPES = INCUBATOR_TYPES.map((t) => ({ id: t, label: humanize(t) }))
const EMPTY = { name: '', type: '', hostInstitution: '', establishedYear: '', sectorsFocused: [], about: '', email: '', phone: '', website: '', line1: '', city: '', state: '', pincode: '' }

function validate(step, f) {
  const e = {}
  if (step === 0) {
    if (!f.name.trim()) e.name = 'Enter the incubator name'
    if (!f.type) e.type = 'Choose a type'
    if (f.establishedYear && !/^(19|20)\d{2}$/.test(f.establishedYear)) e.establishedYear = 'Enter a 4-digit year'
    if (!f.sectorsFocused.length) e.sectorsFocused = 'Pick at least one sector'
  }
  if (step === 1) {
    if (!EMAIL_REGEX.test(f.email)) e.email = 'Enter a valid email'
    if (!normalizePhone(f.phone)) e.phone = 'Enter a valid phone number'
    if (!f.city.trim()) e.city = 'Enter the city'
    if (!f.state.trim()) e.state = 'Enter the state'
    if (f.pincode && !/^\d{6}$/.test(f.pincode)) e.pincode = 'PIN code is 6 digits'
  }
  return e
}

export default function IncubatorOnboarding() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [done, setDone] = useState(false)
  const topRef = useRef(null)

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n })
  }
  const goTo = (i) => { setStep(i); setErrors({}); topRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  // POST /api/incubators/me
  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await post('/incubators/me', {
        name: form.name.trim(),
        type: form.type,
        hostInstitution: form.hostInstitution.trim() || undefined,
        establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
        sectorsFocused: form.sectorsFocused,
        about: form.about.trim() || undefined,
        email: form.email.trim().toLowerCase(),
        phone: normalizePhone(form.phone),
        website: form.website.trim() || undefined,
        address: {
          line1: form.line1.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode || undefined,
          country: 'India',
        },
      })
      setDone(true)
    } catch (err) {
      setSubmitError(errorMessage(err))
      const fe = fieldErrors(err)
      if (Object.keys(fe).length) setErrors(fe)
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (step === STEPS.length - 1) return submit()
    const e = validate(step, form)
    setErrors(e)
    if (!Object.keys(e).length) goTo(step + 1)
  }

  return (
    <div ref={topRef}>
      <OnboardingFrame role="incubator"
        title="Register your incubator" roleLabel="Incubator head"
        intro="Startups see this when they browse programs. Our team verifies new incubators within 2 working days."
        steps={STEPS} current={done ? STEPS.length : step} onSelect={goTo}
      >
        {done ? (
          <SuccessPanel title={`${form.name} is registered`} to="/incubator" cta="Go to dashboard">
            You can create cohorts and invite up to 4 team members now. Public listing starts once verification is complete.
          </SuccessPanel>
        ) : (
          <>
            <StepHeading title={STEPS[step].title}>
                {step === 0 && 'You are registering as the incubator head.'}
                {step === 1 && 'Shown on your public incubator page.'}
                {step === 2 && 'Make sure everything is correct before submitting.'}
            </StepHeading>

            {step === 0 && (
              <div className="grid gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Incubator name" htmlFor="iname" required error={errors.name}>
                    <TextInput id="iname" value={form.name} error={errors.name} placeholder="NorthStar Incubation Centre" onChange={(e) => set({ name: e.target.value })} />
                  </Field>
                  <Field label="Type" htmlFor="itype" required error={errors.type}>
                    <Select id="itype" value={form.type} options={TYPES} placeholder="Select a type" error={errors.type} onChange={(e) => set({ type: e.target.value })} />
                  </Field>
                  <Field label="Host institution" htmlFor="ihost" optional>
                    <TextInput id="ihost" value={form.hostInstitution} onChange={(e) => set({ hostInstitution: e.target.value })} />
                  </Field>
                  <Field label="Established in" htmlFor="iyear" optional error={errors.establishedYear}>
                    <TextInput id="iyear" inputMode="numeric" maxLength={4} value={form.establishedYear} error={errors.establishedYear} placeholder="2016" onChange={(e) => set({ establishedYear: e.target.value })} />
                  </Field>
                </div>
                <Field label="Sectors you focus on" required error={errors.sectorsFocused}>
                  <MultiToggle label="Sectors" options={SECTORS} value={form.sectorsFocused} onChange={(sectorsFocused) => set({ sectorsFocused })} />
                </Field>
                <Field label="About" htmlFor="iabout" optional hint={`${form.about.length} / 5000`}>
                  <Textarea id="iabout" rows={4} maxLength={5000} value={form.about} onChange={(e) => set({ about: e.target.value })} placeholder="What kind of founders do you back, and what do you offer them?" />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Official email" htmlFor="iemail" required error={errors.email}>
                  <TextInput id="iemail" type="email" value={form.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
                </Field>
                <Field label="Phone" htmlFor="iphone" required error={errors.phone}>
                  <TextInput id="iphone" type="tel" value={form.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Website" htmlFor="iweb" optional>
                    <TextInput id="iweb" value={form.website} placeholder="https://" onChange={(e) => set({ website: e.target.value })} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address" htmlFor="iline" optional>
                    <TextInput id="iline" value={form.line1} onChange={(e) => set({ line1: e.target.value })} />
                  </Field>
                </div>
                <Field label="City" htmlFor="icity" required error={errors.city}>
                  <TextInput id="icity" value={form.city} error={errors.city} onChange={(e) => set({ city: e.target.value })} />
                </Field>
                <Field label="State" htmlFor="istate" required error={errors.state}>
                  <TextInput id="istate" value={form.state} error={errors.state} onChange={(e) => set({ state: e.target.value })} />
                </Field>
                <Field label="PIN code" htmlFor="ipin" optional error={errors.pincode}>
                  <TextInput id="ipin" inputMode="numeric" maxLength={6} value={form.pincode} error={errors.pincode} onChange={(e) => set({ pincode: e.target.value })} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5">
                <ReviewBlock title="Incubator details" onEdit={() => goTo(0)}>
                  <Detail label="Name">{form.name}</Detail>
                  <Detail label="Type">{humanize(form.type)}</Detail>
                  <Detail label="Host institution">{form.hostInstitution}</Detail>
                  <Detail label="Established">{form.establishedYear}</Detail>
                  <Detail label="Sectors">{form.sectorsFocused.map((s) => SECTORS.find((x) => x.id === s)?.label).join(', ')}</Detail>
                  <Detail label="About">{form.about}</Detail>
                </ReviewBlock>
                <ReviewBlock title="Contact & address" onEdit={() => goTo(1)}>
                  <Detail label="Email">{form.email}</Detail>
                  <Detail label="Phone">{normalizePhone(form.phone)}</Detail>
                  <Detail label="Website">{form.website}</Detail>
                  <Detail label="Address">{[form.line1, form.city, form.state, form.pincode].filter(Boolean).join(', ')}</Detail>
                </ReviewBlock>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm text-ink-soft">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                  I am authorised to register this incubator and the details above are accurate.
                </label>
              </div>
            )}

            <StepNav step={step} total={STEPS.length} onBack={() => goTo(step - 1)} onNext={next}
              nextLabel={step === STEPS.length - 1 ? (submitting ? 'Submitting...' : 'Submit for verification') : undefined}
              disabled={step === STEPS.length - 1 && (!confirmed || submitting)} />
            {submitError && <div className="text-right"><ErrorText>{submitError}</ErrorText></div>}
            {!submitError && Object.keys(errors).length > 0 && <div className="text-right"><ErrorText>Fix the highlighted fields to continue.</ErrorText></div>}
          </>
        )}
      </OnboardingFrame>
    </div>
  )
}
