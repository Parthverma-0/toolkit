import { useRef, useState } from 'react'
import OnboardingFrame, { ReviewBlock, StepHeading, StepNav, SuccessPanel } from '../../components/onboarding/OnboardingFrame.jsx'
import MultiToggle from '../../components/dashboard/MultiToggle.jsx'
import { Detail } from '../../components/dashboard/ui.jsx'
import { ErrorText, Field, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { SECTORS } from '../../constants/startup.js'
import { VIDEO_CATEGORIES, WEEKDAYS } from '../../constants/enums.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage, fieldErrors, put } from '../../api/client.js'
import { humanize } from '../../utils/format.js'
import AvailabilityEditor from '../../components/dashboard/AvailabilityEditor.jsx'

const STEPS = [
  { title: 'Professional details', description: 'Your role and background' },
  { title: 'Expertise & availability', description: 'What you help with, and when' },
  { title: 'Review', description: 'Check everything and submit' },
]
const EXPERTISE = VIDEO_CATEGORIES.filter((c) => c !== 'other').map((c) => ({ id: c, label: humanize(c) }))
const EMPTY = { name: '', designation: '', organization: '', yearsOfExperience: '', bio: '', linkedin: '', website: '', expertise: [], sectors: [], availability: [] }

function validate(step, f) {
  const e = {}
  if (step === 0) {
    if (!f.name.trim()) e.name = 'Enter your name'
    if (!f.designation.trim()) e.designation = 'Enter your designation'
    if (!f.organization.trim()) e.organization = 'Enter your organisation'
    if (f.yearsOfExperience === '' || +f.yearsOfExperience < 0) e.yearsOfExperience = 'Enter years of experience'
    if (f.bio.trim().length < 40) e.bio = 'Write at least 40 characters so founders know how you can help'
  }
  if (step === 1) {
    if (!f.expertise.length) e.expertise = 'Pick at least one area'
    if (!f.availability.length) e.availability = 'Add at least one weekly slot'
  }
  return e
}

export default function MentorOnboarding() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => ({ ...EMPTY, name: user?.name ?? '' }))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const topRef = useRef(null)

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n })
  }
  const goTo = (i) => { setStep(i); setErrors({}); topRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  // PUT /api/mentors/me/profile (name comes from the Google account)
  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await put('/mentors/me/profile', {
        designation: form.designation.trim(),
        organization: form.organization.trim(),
        yearsOfExperience: Number(form.yearsOfExperience),
        bio: form.bio.trim(),
        linkedin: form.linkedin.trim() || undefined,
        website: form.website.trim() || undefined,
        expertise: form.expertise,
        sectors: form.sectors,
        availability: form.availability,
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
      <OnboardingFrame role="mentor"
        title="Set up your mentor profile" roleLabel="Mentor"
        intro="Founders browse this profile to request 1:1 sessions. You can edit it any time."
        steps={STEPS} current={done ? STEPS.length : step} onSelect={goTo}
      >
        {done ? (
          <SuccessPanel title="Your mentor profile is live" to="/mentor" cta="Go to dashboard">
            Founders can now request sessions with you. You will get an email for every new request.
          </SuccessPanel>
        ) : (
          <>
            <StepHeading title={STEPS[step].title}>
                {step === 0 && 'This is the first thing founders read about you.'}
                {step === 1 && 'Founders filter mentors by these areas and only see your open slots.'}
                {step === 2 && 'Make sure everything is correct before submitting.'}
            </StepHeading>

            {step === 0 && (
              <div className="grid gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="mname" required hint="From your Google account">
                    <TextInput id="mname" value={form.name} readOnly className="bg-sidebar" />
                  </Field>
                  <Field label="Designation" htmlFor="mdes" required error={errors.designation}>
                    <TextInput id="mdes" value={form.designation} error={errors.designation} placeholder="Partner" onChange={(e) => set({ designation: e.target.value })} />
                  </Field>
                  <Field label="Organisation" htmlFor="morg" required error={errors.organization}>
                    <TextInput id="morg" value={form.organization} error={errors.organization} onChange={(e) => set({ organization: e.target.value })} />
                  </Field>
                  <Field label="Years of experience" htmlFor="myrs" required error={errors.yearsOfExperience}>
                    <TextInput id="myrs" type="number" min={0} value={form.yearsOfExperience} error={errors.yearsOfExperience} onChange={(e) => set({ yearsOfExperience: e.target.value })} />
                  </Field>
                </div>
                <Field label="Bio" htmlFor="mbio" required error={errors.bio} hint={`${form.bio.length} / 2000`}>
                  <Textarea id="mbio" rows={4} maxLength={2000} value={form.bio} error={errors.bio} onChange={(e) => set({ bio: e.target.value })}
                    placeholder="What have you built or backed, and what do founders usually come to you for?" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="LinkedIn" htmlFor="mli" optional>
                    <TextInput id="mli" value={form.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
                  </Field>
                  <Field label="Website" htmlFor="mweb" optional>
                    <TextInput id="mweb" value={form.website} onChange={(e) => set({ website: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-7">
                <Field label="Areas of expertise" required error={errors.expertise}>
                  <MultiToggle label="Expertise" options={EXPERTISE} value={form.expertise} onChange={(expertise) => set({ expertise })} />
                </Field>
                <Field label="Sectors you know best" optional>
                  <MultiToggle label="Sectors" options={SECTORS} value={form.sectors} onChange={(sectors) => set({ sectors })} />
                </Field>
                <Field label="Weekly availability" required error={errors.availability}>
                  <AvailabilityEditor value={form.availability} onChange={(availability) => set({ availability })} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5">
                <ReviewBlock title="Professional details" onEdit={() => goTo(0)}>
                  <Detail label="Name">{form.name}</Detail>
                  <Detail label="Role">{form.designation}, {form.organization}</Detail>
                  <Detail label="Experience">{form.yearsOfExperience} years</Detail>
                  <Detail label="Bio">{form.bio}</Detail>
                  <Detail label="LinkedIn">{form.linkedin}</Detail>
                </ReviewBlock>
                <ReviewBlock title="Expertise & availability" onEdit={() => goTo(1)}>
                  <Detail label="Expertise">{form.expertise.map(humanize).join(', ')}</Detail>
                  <Detail label="Sectors">{form.sectors.map((s) => SECTORS.find((x) => x.id === s)?.label).join(', ')}</Detail>
                  <Detail label="Availability">
                    {[...form.availability].sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))
                      .map((a) => `${humanize(a.day)} ${a.from}-${a.to}`).join(' · ')}
                  </Detail>
                </ReviewBlock>
              </div>
            )}

            <StepNav step={step} total={STEPS.length} onBack={() => goTo(step - 1)} onNext={next}
              nextLabel={step === STEPS.length - 1 ? (submitting ? 'Publishing...' : 'Publish profile') : undefined}
              disabled={step === STEPS.length - 1 && submitting} />
            {submitError && <div className="text-right"><ErrorText>{submitError}</ErrorText></div>}
            {!submitError && Object.keys(errors).length > 0 && <div className="text-right"><ErrorText>Fix the highlighted fields to continue.</ErrorText></div>}
          </>
        )}
      </OnboardingFrame>
    </div>
  )
}
