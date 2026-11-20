import { useState } from 'react'
import { Button, Drawer } from '../dashboard/ui.jsx'
import { ErrorText } from '../ui/Field.jsx'
import {
  ALL_SECTIONS, SECTION_COMPONENTS, emptyForm, formFromProfile, payloadFromForm, validateSection,
} from './ProfileForm.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage, fieldErrors, put } from '../../api/client.js'

const STEPS = [
  { id: 'basic', title: 'Basic information', text: 'Your contact details stay private until you connect with a founder.' },
  { id: 'organisation', title: 'Investor details', text: 'Tell founders whether you invest on your own or through an organisation.' },
  { id: 'preferences', title: 'Investment preferences', text: 'We use these to recommend startups and to show you to the right founders.' },
  { id: 'background', title: 'Background (optional)', text: 'Founders like to know who they would be working with.' },
]

const stepOf = (field) => ALL_SECTIONS.findIndex((s) => ({
  basic: ['fullName', 'phone', 'contactEmail', 'designation', 'linkedin', 'location', 'country'],
  organisation: ['category', 'investorType', 'organisationName', 'organisationWebsite', 'organisationLinkedin', 'yearEstablished', 'headOffice'],
  preferences: ['sectors', 'stages', 'ticketSizes', 'locations', 'customTicket'],
  background: ['bio', 'portfolio', 'professionalBackground'],
}[s].includes(field.split('.')[0])))

// "Complete your investor profile" popup. Investors land on the dashboard right after signing up;
// this opens when they try to connect, shortlist or anything else that needs a profile.
// Verification documents are added afterwards in Settings.
export default function InvestorProfileDialog({ profile, reason, onClose, onSaved }) {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState(() => (profile ? formFromProfile(profile, user) : emptyForm(user)))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const Section = SECTION_COMPONENTS[STEPS[step].id]
  const last = step === STEPS.length - 1

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await put('/investor-portal/me/profile', payloadFromForm(form))
      updateUser({ name: data.fullName, phone: data.phone })
      await onSaved()
    } catch (err) {
      setError(errorMessage(err))
      const fe = fieldErrors(err)
      setErrors(fe)
      const first = Object.keys(fe).map(stepOf).filter((i) => i >= 0).sort()[0]
      if (first !== undefined) setStep(first)
    } finally {
      setSaving(false)
    }
  }

  const next = () => {
    const e = validateSection(STEPS[step].id, form)
    setErrors(e)
    if (Object.keys(e).length) return
    if (last) save()
    else setStep(step + 1)
  }

  return (
    <Drawer
      open
      title="Complete your investor profile"
      subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].title}${reason ? '. Needed before you can continue.' : ''}`}
      onClose={onClose}
      footer={(
        <>
          {error && <ErrorText>{error}</ErrorText>}
          {step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <Button variant="ghost" onClick={onClose}>Not now</Button>}
          <Button disabled={saving} onClick={next}>{last ? (saving ? 'Saving...' : 'Save profile') : 'Continue'}</Button>
        </>
      )}
    >
      <p className="mb-6 text-base text-ink-soft">{STEPS[step].text}</p>
      <Section form={form} set={set} errors={errors} />
    </Drawer>
  )
}
