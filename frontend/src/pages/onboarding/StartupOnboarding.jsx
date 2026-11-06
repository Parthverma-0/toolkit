import { useEffect, useMemo, useRef, useState } from 'react'
import OnboardingFrame, { PRIMARY_BTN, GHOST_BTN, StepHeading, SuccessPanel } from '../../components/onboarding/OnboardingFrame.jsx'
import LogoUpload from '../../components/onboarding/LogoUpload.jsx'
import OtpField from '../../components/onboarding/OtpField.jsx'
import { Field, ErrorText, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import {
  CIN_REGEX, DPIIT_REGEX, EMAIL_REGEX, SECTORS, STAGES, normalizePhone,
} from '../../constants/startup.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage, fieldErrors, patch, post, put, toFormData } from '../../api/client.js'

const STEPS = [
  { title: 'Startup details', description: 'Legal identity and what you do' },
  { title: 'Founder & contact', description: 'Verify your email and phone' },
  { title: 'Review', description: 'Check everything and submit' },
]

const EMPTY = {
  logo: null, name: '', startupEmail: '', startupEmailVerified: false, cin: '', dpiitNumber: '', sector: '', stage: '',
  problemStatement: '', solution: '',
  fullName: '', designation: '', email: '', emailVerified: false, phone: '', phoneVerified: false,
}

const TEXT_MAX = 3000

const emailError = (v) => (EMAIL_REGEX.test(v.trim()) ? '' : 'Enter a valid email address')
const phoneError = (v) => (normalizePhone(v) ? '' : 'Enter a valid 10-digit mobile number')

function validateStep(step, f) {
  const e = {}
  if (step === 0) {
    if (!f.logo) e.logo = 'Upload your startup logo'
    if (!f.name.trim()) e.name = 'Enter your startup name'
    if (emailError(f.startupEmail)) e.startupEmail = emailError(f.startupEmail)
    else if (!f.startupEmailVerified) e.startupEmail = 'Verify the startup email to continue'
    if (!CIN_REGEX.test(f.cin)) e.cin = 'CIN must be 21 characters, e.g. U72900KA2021PTC123456'
    if (!DPIIT_REGEX.test(f.dpiitNumber)) e.dpiitNumber = 'DPIIT number looks like DIPP123456'
    if (!f.sector) e.sector = 'Choose a sector'
    if (!f.stage) e.stage = 'Choose your current stage'
  }
  if (step === 1) {
    if (!f.fullName.trim()) e.fullName = 'Enter your full name'
    if (!f.designation.trim()) e.designation = 'Enter your designation'
    e.phone = phoneError(f.phone) || (f.phoneVerified ? '' : 'Verify your phone to continue')
    if (!e.phone) delete e.phone
  }
  return e
}

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? '-'

export default function StartupOnboarding() {
  const [step, setStep] = useState(0)
  const { user, updateUser } = useAuth()
  // Founder email is the Google account email (already verified); phone may be verified from an earlier attempt
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    emailVerified: true,
    phone: user?.phone?.replace(/^\+91/, '') ?? '',
    phoneVerified: Boolean(user?.isPhoneVerified),
  }))
  const [startupCreated, setStartupCreated] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const topRef = useRef(null)

  const logoUrl = useMemo(() => (form.logo ? URL.createObjectURL(form.logo) : ''), [form.logo])
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl) }, [logoUrl])

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      Object.keys(patch).forEach((k) => delete next[k.replace('Verified', '')])
      return next
    })
  }

  const goTo = (i) => {
    setStep(i)
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const next = () => {
    const e = validateStep(step, form)
    setErrors(e)
    if (Object.keys(e).length) return
    goTo(step + 1)
  }

  // 1) POST /startups/me (or PATCH if an earlier attempt already created it)  2) PUT primary founder
  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    const startup = {
      logo: form.logo, name: form.name.trim(), startupEmail: form.startupEmail.trim().toLowerCase(),
      cin: form.cin, dpiitNumber: form.dpiitNumber, sector: form.sector, stage: form.stage,
      problemStatement: form.problemStatement.trim(), solution: form.solution.trim(),
    }
    try {
      if (!startupCreated) {
        try {
          await post('/startups/me', toFormData(startup))
        } catch (err) {
          if (err?.response?.status !== 409 || !/already created/i.test(err.response.data?.message)) throw err
          await patch('/startups/me', toFormData(startup))
        }
        setStartupCreated(true)
      }
      await put('/startups/me/founders/primary', toFormData({ fullName: form.fullName.trim(), designation: form.designation.trim() }))
      setSubmitted(true)
    } catch (err) {
      const fe = fieldErrors(err)
      setSubmitError(errorMessage(err))
      if (Object.keys(fe).length) {
        setErrors(fe)
        goTo(['fullName', 'designation'].some((k) => fe[k]) ? 1 : 0)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={topRef}>
      <OnboardingFrame
        title="Set up your startup profile" role="startup" roleLabel="Startup"
        intro="Incubators, mentors and investors see this. You can edit it any time from your dashboard."
        steps={STEPS} current={submitted ? STEPS.length : step} onSelect={goTo}
      >
          {submitted ? (
            <SuccessPanel title={`${form.name} is all set`} to="/startup" cta="Go to dashboard"
              media={logoUrl && <img src={logoUrl} alt="" className="mx-auto size-20 rounded-xl border border-line object-cover" />}>
              Your profile is complete. Tools, mentoring, videos, grants and events are now unlocked.
            </SuccessPanel>
          ) : (
            <>
              <StepHeading title={STEPS[step].title}>
                {step === 0 && 'These must match your company registration documents.'}
                {step === 1 && 'You are the primary founder. Co-founders can be added from your dashboard.'}
                {step === 2 && 'Make sure everything is correct before submitting.'}
              </StepHeading>

              {step === 0 && (
                <div className="grid gap-6">
                  <Field label="Startup logo" required>
                    <LogoUpload file={form.logo} onChange={(logo) => update({ logo })} error={errors.logo} />
                  </Field>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Startup name" htmlFor="name" required error={errors.name}>
                      <TextInput id="name" value={form.name} onChange={(e) => update({ name: e.target.value })}
                        placeholder="Acme Labs Pvt. Ltd." maxLength={150} error={errors.name} />
                    </Field>
                    <Field label="Startup email" htmlFor="startupEmail" required hint="Official company inbox, verified by OTP">
                      <OtpField id="startupEmail" channel="email" type="email" value={form.startupEmail} placeholder="hello@acmelabs.in"
                        toTarget={(v) => v.trim().toLowerCase()}
                        onChange={(startupEmail) => update({
                          startupEmail,
                          startupEmailVerified: startupEmail.trim().toLowerCase() === user?.email,
                        })}
                        verified={form.startupEmailVerified} onVerified={() => update({ startupEmailVerified: true })}
                        validate={emailError} error={errors.startupEmail} />
                    </Field>
                    <Field label="CIN" htmlFor="cin" required error={errors.cin} hint="21-character Corporate Identification Number">
                      <TextInput id="cin" value={form.cin} maxLength={21} className="font-mono uppercase"
                        onChange={(e) => update({ cin: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        placeholder="U72900KA2021PTC123456" error={errors.cin} />
                    </Field>
                    <Field label="DPIIT recognition number" htmlFor="dpiit" required error={errors.dpiitNumber}>
                      <TextInput id="dpiit" value={form.dpiitNumber} className="font-mono uppercase"
                        onChange={(e) => update({ dpiitNumber: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        placeholder="DIPP123456" error={errors.dpiitNumber} />
                    </Field>
                    <Field label="Sector" htmlFor="sector" required error={errors.sector}>
                      <Select id="sector" value={form.sector} onChange={(e) => update({ sector: e.target.value })}
                        options={SECTORS} placeholder="Select a sector" error={errors.sector} />
                    </Field>
                  </div>

                  <Field label="Current stage" required error={errors.stage}>
                    <Pills label="Current stage" options={STAGES} value={form.stage} onChange={(stage) => update({ stage })} error={errors.stage} />
                  </Field>

                  <div className="grid gap-6 border-t border-line pt-6">
                    <Field label="Problem statement" htmlFor="problem" optional
                      hint={`${form.problemStatement.length} / ${TEXT_MAX}`}>
                      <Textarea id="problem" rows={3} maxLength={TEXT_MAX} value={form.problemStatement}
                        onChange={(e) => update({ problemStatement: e.target.value })}
                        placeholder="What problem are you solving, and for whom?" />
                    </Field>
                    <Field label="Solution" htmlFor="solution" optional hint={`${form.solution.length} / ${TEXT_MAX}`}>
                      <Textarea id="solution" rows={3} maxLength={TEXT_MAX} value={form.solution}
                        onChange={(e) => update({ solution: e.target.value })}
                        placeholder="How does your product solve it?" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
                      <TextInput id="fullName" value={form.fullName} maxLength={100}
                        onChange={(e) => update({ fullName: e.target.value })} placeholder="Priya Sharma" error={errors.fullName} />
                    </Field>
                    <Field label="Designation" htmlFor="designation" required error={errors.designation}>
                      <TextInput id="designation" value={form.designation} maxLength={60}
                        onChange={(e) => update({ designation: e.target.value })} placeholder="Founder & CEO" error={errors.designation} />
                    </Field>
                  </div>
                  <Field label="Email" htmlFor="email" required hint="Your Google sign-in email">
                    <div className="flex gap-2">
                      <TextInput id="email" type="email" value={form.email} readOnly className="flex-1 bg-sidebar" />
                      <span className="inline-flex shrink-0 items-center rounded-lg bg-emerald-50 px-4 text-base font-semibold text-emerald-700">Verified</span>
                    </div>
                  </Field>
                  <Field label="Mobile number" htmlFor="phone" required>
                    <OtpField id="phone" channel="phone" type="tel" inputMode="numeric" prefix="+91" value={form.phone} placeholder="98765 43210"
                      toTarget={(v) => normalizePhone(v)}
                      onChange={(phone) => update({ phone, phoneVerified: false })}
                      verified={form.phoneVerified}
                      onVerified={(res) => { update({ phoneVerified: true }); if (res?.user) updateUser(res.user) }}
                      validate={phoneError} error={errors.phone} />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <ReviewSection title="Startup details" onEdit={() => goTo(0)}>
                    <div className="mb-4 flex items-center gap-4">
                      {logoUrl && <img src={logoUrl} alt="" className="size-14 rounded-xl border border-line object-cover" />}
                      <div>
                        <p className="font-semibold text-ink">{form.name}</p>
                        <p className="text-sm text-ink-soft">{labelOf(SECTORS, form.sector)} · {labelOf(STAGES, form.stage)}</p>
                      </div>
                    </div>
                    <ReviewRow label="Startup email" value={form.startupEmail} verified />
                    <ReviewRow label="CIN" value={form.cin} mono />
                    <ReviewRow label="DPIIT number" value={form.dpiitNumber} mono />
                    <ReviewRow label="Problem statement" value={form.problemStatement} />
                    <ReviewRow label="Solution" value={form.solution} />
                  </ReviewSection>

                  <ReviewSection title="Founder & contact" onEdit={() => goTo(1)}>
                    <ReviewRow label="Name" value={`${form.fullName}, ${form.designation}`} />
                    <ReviewRow label="Email" value={form.email} verified />
                    <ReviewRow label="Mobile" value={normalizePhone(form.phone)} verified />
                  </ReviewSection>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm text-ink-soft">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 size-4 accent-brand" />
                    I confirm these details are accurate and match my company&apos;s registration with MCA and DPIIT.
                  </label>
                </div>
              )}

              <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
                {step > 0 ? (
                  <button type="button" onClick={() => goTo(step - 1)} className={GHOST_BTN}>
                    Back
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={step === STEPS.length - 1 ? submit : next}
                  disabled={(step === STEPS.length - 1 && !confirmed) || submitting}
                  className={PRIMARY_BTN}
                >
                  {step < STEPS.length - 1 ? 'Continue' : submitting ? 'Submitting...' : 'Submit profile'}
                </button>
              </div>
              {submitError && <div className="text-right"><ErrorText>{submitError}</ErrorText></div>}
              {!submitError && Object.keys(errors).length > 0 && (
                <div className="text-right"><ErrorText>Fix the highlighted fields to continue.</ErrorText></div>
              )}
            </>
          )}
      </OnboardingFrame>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <div className="rounded-xl border border-line bg-white p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="text-base font-semibold text-brand hover:text-brand-dark">Edit</button>
      </div>
      <dl className="grid gap-3">{children}</dl>
    </div>
  )
}

function ReviewRow({ label, value, mono, verified }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`text-sm break-words text-ink ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-ink-soft/60">Not added</span>}
        {verified && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>}
      </dd>
    </div>
  )
}
