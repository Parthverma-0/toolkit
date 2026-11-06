import { useState } from 'react'
import { Badge, Card } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import OtpField from '../../components/onboarding/OtpField.jsx'
import LogoUpload from '../../components/onboarding/LogoUpload.jsx'
import { ErrorText, Field, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { EMAIL_REGEX, SECTORS, STAGES, normalizePhone } from '../../constants/startup.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, fieldErrors, fileUrl, get, patch, post, put, toFormData } from '../../api/client.js'
import { formatDate } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? '-'
const EMPTY_FOUNDER = { fullName: '', designation: '', email: '', phone: '', linkedin: '', equityPercent: '' }

// Startup document -> flat form values for the edit drawer
const toForm = (s) => ({
  name: s.name ?? '', startupEmail: s.startupEmail ?? '', startupEmailVerified: true, website: s.website ?? '',
  city: s.address?.city ?? '', state: s.address?.state ?? '', teamSize: s.teamSize ?? '',
  foundedOn: s.foundedOn ? s.foundedOn.slice(0, 10) : '', tagline: s.tagline ?? '',
  sector: s.sector, stage: s.stage, problemStatement: s.problemStatement ?? '', solution: s.solution ?? '', logo: null,
})

export default function Profile() {
  const state = useApi(() => get('/startups/me').then((r) => r.data))
  return <Async state={state}>{(startup) => <ProfileView startup={startup} reload={state.reload} />}</Async>
}

function ProfileView({ startup, reload }) {
  const toast = useToast()
  const founders = startup.founders ?? []
  const [editingProfile, setEditingProfile] = useState(null)
  const [founderDraft, setFounderDraft] = useState(null) // founder doc or EMPTY_FOUNDER for new
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const totalEquity = founders.reduce((s, f) => s + (Number(f.equityPercent) || 0), 0)

  const run = async (fn, message) => {
    setSaving(true)
    setSaveError('')
    try {
      await fn()
      closeDrawers()
      toast(message)
      reload()
    } catch (err) {
      setErrors(fieldErrors(err))
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = () => {
    const p = editingProfile
    const e = {}
    if (!p.name.trim()) e.name = 'Enter your startup name'
    if (!EMAIL_REGEX.test(p.startupEmail)) e.startupEmail = 'Enter a valid email'
    else if (!p.startupEmailVerified) e.startupEmail = 'Verify the new email first'
    if (p.teamSize !== '' && Number(p.teamSize) < 1) e.teamSize = 'Team size is at least 1'
    setErrors(e)
    if (Object.keys(e).length) return
    run(() => patch('/startups/me', toFormData({
      name: p.name.trim(), startupEmail: p.startupEmail.trim().toLowerCase(), website: p.website.trim() || undefined,
      tagline: p.tagline.trim() || undefined, teamSize: p.teamSize || undefined, foundedOn: p.foundedOn || undefined,
      address: { city: p.city.trim() || undefined, state: p.state.trim() || undefined },
      sector: p.sector, stage: p.stage, problemStatement: p.problemStatement.trim(), solution: p.solution.trim(), logo: p.logo,
    })), 'Startup profile updated')
  }

  const saveFounder = () => {
    const f = founderDraft
    const e = {}
    if (!f.fullName.trim()) e.fullName = 'Enter a name'
    if (!f.designation.trim()) e.designation = 'Enter a designation'
    if (!f.isPrimary) {
      if (!EMAIL_REGEX.test(f.email)) e.email = 'Enter a valid email'
      if (!normalizePhone(f.phone)) e.phone = 'Enter a valid mobile number'
    }
    const others = founders.filter((x) => x._id !== f._id).reduce((s, x) => s + (Number(x.equityPercent) || 0), 0)
    if (others + (Number(f.equityPercent) || 0) > 100) e.equityPercent = `Total equity would exceed 100% (others hold ${others}%)`
    setErrors(e)
    if (Object.keys(e).length) return

    const body = {
      fullName: f.fullName.trim(), designation: f.designation.trim(),
      linkedin: f.linkedin?.trim() || undefined, equityPercent: f.equityPercent === '' ? undefined : f.equityPercent,
    }
    if (!f.isPrimary) Object.assign(body, { email: f.email.trim().toLowerCase(), phone: normalizePhone(f.phone) })

    if (f.isPrimary) run(() => put('/startups/me/founders/primary', toFormData(body)), 'Your founder profile was updated')
    else if (f._id) run(() => patch(`/startups/me/founders/${f._id}`, toFormData(body)), 'Founder updated')
    else run(() => post('/startups/me/founders', toFormData(body)), 'Co-founder added')
  }

  const removeFounder = (id) => run(() => del(`/startups/me/founders/${id}`), 'Co-founder removed')

  const closeDrawers = () => { setEditingProfile(null); setFounderDraft(null); setErrors({}); setSaveError('') }
  const p = editingProfile
  const f = founderDraft
  const setP = (patchValues) => setEditingProfile((cur) => ({ ...cur, ...patchValues }))

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Incubators, mentors and investors see this profile."
        action={<Button onClick={() => setEditingProfile(toForm(startup))}>Edit startup details</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Startup details">
          <div className="mb-6 flex items-center gap-4">
            {startup.logo
              ? <img src={fileUrl(startup.logo)} alt="" className="size-16 rounded-2xl border border-line object-cover" />
              : <span className="flex size-16 items-center justify-center rounded-2xl bg-brand font-display text-2xl font-bold text-white">{startup.name[0]}</span>}
            <div>
              <p className="text-lg font-semibold text-ink">{startup.name}</p>
              <p className="text-sm text-ink-soft">{labelOf(SECTORS, startup.sector)} · {labelOf(STAGES, startup.stage)}</p>
            </div>
            {startup.isVerified && <Badge tone="success">Verified</Badge>}
          </div>
          <dl className="grid gap-3">
            <Detail label="Startup email">{startup.startupEmail}</Detail>
            <Detail label="Tagline">{startup.tagline}</Detail>
            <Detail label="Website">{startup.website}</Detail>
            <Detail label="City">{[startup.address?.city, startup.address?.state].filter(Boolean).join(', ')}</Detail>
            <Detail label="Founded">{startup.foundedOn && formatDate(startup.foundedOn)}</Detail>
            <Detail label="Team size">{startup.teamSize}</Detail>
            <Detail label="CIN"><span className="font-mono">{startup.cin}</span></Detail>
            <Detail label="DPIIT number"><span className="font-mono">{startup.dpiitNumber}</span></Detail>
            <Detail label="Problem">{startup.problemStatement}</Detail>
            <Detail label="Solution">{startup.solution}</Detail>
          </dl>
        </Card>

        <Card title="Founders" action={<Button size="sm" variant="secondary" onClick={() => setFounderDraft({ ...EMPTY_FOUNDER })}>Add co-founder</Button>}>
          <ul className="grid gap-3">
            {founders.map((x) => (
              <li key={x._id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{x.fullName}</p>
                    <p className="text-sm text-ink-soft">{x.designation}{x.equityPercent ? ` · ${x.equityPercent}% equity` : ''}</p>
                  </div>
                  <button type="button" onClick={() => setFounderDraft({ ...EMPTY_FOUNDER, ...x, equityPercent: x.equityPercent ?? '' })}
                    className="text-sm font-medium text-brand hover:text-brand-dark">Edit</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {x.isPrimary && <Badge tone="brand">Primary</Badge>}
                  <Badge tone={x.isEmailVerified ? 'success' : 'warning'}>{x.isEmailVerified ? 'Email verified' : 'Email not verified'}</Badge>
                  <Badge tone={x.isPhoneVerified ? 'success' : 'warning'}>{x.isPhoneVerified ? 'Phone verified' : 'Phone not verified'}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-soft">Founders hold {totalEquity}% equity in total.</p>
        </Card>
      </div>

      <Drawer
        open={Boolean(p)} title="Edit startup details" onClose={closeDrawers}
        footer={(
          <>
            {saveError && <ErrorText>{saveError}</ErrorText>}
            <Button variant="ghost" onClick={closeDrawers}>Cancel</Button>
            <Button onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
          </>
        )}
      >
        {p && (
          <div className="grid gap-5">
            <Field label="Logo" optional hint="Leave empty to keep the current logo">
              <LogoUpload file={p.logo} onChange={(logo) => setP({ logo })} />
            </Field>
            <Field label="Startup name" htmlFor="pname" required error={errors.name}>
              <TextInput id="pname" value={p.name} error={errors.name} onChange={(e) => setP({ name: e.target.value })} />
            </Field>
            <Field label="Startup email" htmlFor="pemail" required hint="A new email must be verified by OTP">
              <OtpField id="pemail" channel="email" type="email" value={p.startupEmail}
                toTarget={(v) => v.trim().toLowerCase()}
                onChange={(startupEmail) => setP({
                  startupEmail,
                  startupEmailVerified: startupEmail.trim().toLowerCase() === startup.startupEmail,
                })}
                verified={p.startupEmailVerified} onVerified={() => setP({ startupEmailVerified: true })}
                validate={(v) => (EMAIL_REGEX.test(v.trim()) ? '' : 'Enter a valid email address')} error={errors.startupEmail} />
            </Field>
            <Field label="Tagline" htmlFor="ptag" optional>
              <TextInput id="ptag" value={p.tagline} maxLength={160} onChange={(e) => setP({ tagline: e.target.value })} />
            </Field>
            <Field label="Website" htmlFor="pweb" optional error={errors.website}>
              <TextInput id="pweb" value={p.website} placeholder="https://" error={errors.website} onChange={(e) => setP({ website: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" htmlFor="pcity" optional>
                <TextInput id="pcity" value={p.city} onChange={(e) => setP({ city: e.target.value })} />
              </Field>
              <Field label="State" htmlFor="pstate" optional>
                <TextInput id="pstate" value={p.state} onChange={(e) => setP({ state: e.target.value })} />
              </Field>
              <Field label="Founded on" htmlFor="pfound" optional error={errors.foundedOn}>
                <TextInput id="pfound" type="date" value={p.foundedOn} error={errors.foundedOn} onChange={(e) => setP({ foundedOn: e.target.value })} />
              </Field>
              <Field label="Team size" htmlFor="pteam" optional error={errors.teamSize}>
                <TextInput id="pteam" type="number" min={1} value={p.teamSize} error={errors.teamSize} onChange={(e) => setP({ teamSize: e.target.value })} />
              </Field>
            </div>
            <Field label="Sector" htmlFor="psector" required>
              <Select id="psector" value={p.sector} options={SECTORS} onChange={(e) => setP({ sector: e.target.value })} />
            </Field>
            <Field label="Current stage" required>
              <Pills label="Current stage" options={STAGES} value={p.stage} onChange={(stage) => setP({ stage })} />
            </Field>
            <Field label="Problem statement" htmlFor="pprob" optional>
              <Textarea id="pprob" rows={3} maxLength={3000} value={p.problemStatement} onChange={(e) => setP({ problemStatement: e.target.value })} />
            </Field>
            <Field label="Solution" htmlFor="psol" optional>
              <Textarea id="psol" rows={3} maxLength={3000} value={p.solution} onChange={(e) => setP({ solution: e.target.value })} />
            </Field>
            <p className="text-xs text-ink-soft">CIN and DPIIT number can only be changed by contacting support.</p>
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(f)} title={f?.isPrimary ? 'Edit your founder profile' : f?._id ? 'Edit founder' : 'Add co-founder'} onClose={closeDrawers}
        subtitle={f?.isPrimary ? 'Email and phone come from your verified account.' : undefined}
        footer={(
          <>
            {saveError && <ErrorText>{saveError}</ErrorText>}
            {f?._id && !f.isPrimary && <Button variant="danger" className="mr-auto" disabled={saving} onClick={() => removeFounder(f._id)}>Remove</Button>}
            <Button variant="ghost" onClick={closeDrawers}>Cancel</Button>
            <Button onClick={saveFounder} disabled={saving}>{saving ? 'Saving...' : f?._id ? 'Save changes' : 'Add co-founder'}</Button>
          </>
        )}
      >
        {f && (
          <div className="grid gap-5">
            <Field label="Full name" htmlFor="fname" required error={errors.fullName}>
              <TextInput id="fname" value={f.fullName} error={errors.fullName} onChange={(e) => setFounderDraft({ ...f, fullName: e.target.value })} />
            </Field>
            <Field label="Designation" htmlFor="fdes" required error={errors.designation}>
              <TextInput id="fdes" value={f.designation} placeholder="Co-founder & CTO" error={errors.designation} onChange={(e) => setFounderDraft({ ...f, designation: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="femail" required error={errors.email}>
              <TextInput id="femail" type="email" value={f.email} readOnly={f.isPrimary} className={f.isPrimary ? 'bg-sidebar' : ''}
                error={errors.email} onChange={(e) => setFounderDraft({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Mobile number" htmlFor="fphone" required error={errors.phone}>
              <TextInput id="fphone" type="tel" value={f.phone} readOnly={f.isPrimary} className={f.isPrimary ? 'bg-sidebar' : ''}
                error={errors.phone} onChange={(e) => setFounderDraft({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="LinkedIn" htmlFor="fli" optional error={errors.linkedin}>
              <TextInput id="fli" value={f.linkedin} placeholder="https://linkedin.com/in/..." error={errors.linkedin} onChange={(e) => setFounderDraft({ ...f, linkedin: e.target.value })} />
            </Field>
            <Field label="Equity (%)" htmlFor="feq" optional error={errors.equityPercent}>
              <TextInput id="feq" type="number" min={0} max={100} value={f.equityPercent} error={errors.equityPercent} onChange={(e) => setFounderDraft({ ...f, equityPercent: e.target.value })} />
            </Field>
          </div>
        )}
      </Drawer>
    </div>
  )
}
