import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Badge, Card } from '../../components/dashboard/Card.jsx'
import { Button, Detail, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import CompletePrompt from '../../components/investor/CompletePrompt.jsx'
import DocumentsManager, { documentHref } from '../../components/investor/DocumentsManager.jsx'
import { useInvestor } from '../../components/investor/InvestorContext.jsx'
import { ErrorText, Field, TextInput } from '../../components/ui/Field.jsx'
import { VERIFICATION_STATUSES, VISIBILITIES } from '../../constants/investor.js'
import { EMAIL_REGEX, normalizePhone } from '../../constants/startup.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage, fieldErrors, patch, post, put, toFormData } from '../../api/client.js'
import { formatDate } from '../../utils/format.js'

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'visibility', label: 'Profile visibility' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'verification', label: 'Verification and documents' },
  { id: 'danger', label: 'Deactivate' },
]

export default function Settings() {
  const { complete, openProfileForm } = useInvestor()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'account'
  if (!complete) return <CompletePrompt title="Settings" onComplete={() => openProfileForm('settings')} />
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account, who can see your profile, notifications and verification." />
      <Tabs tabs={TABS} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === 'account' && <Account />}
      {tab === 'visibility' && <Visibility />}
      {tab === 'notifications' && <NotificationPrefs />}
      {tab === 'verification' && <Verification />}
      {tab === 'danger' && <Deactivate />}
    </div>
  )
}

function Account() {
  const { profile, reload } = useInvestor()
  const { user, signOut, updateUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState(profile.contactEmail ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const e = {}
    if (!EMAIL_REGEX.test(email)) e.contactEmail = 'Enter a valid email address'
    if (!normalizePhone(phone)) e.phone = 'Enter a valid mobile number'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const { data } = await put('/investor-portal/me/profile', toFormData({ contactEmail: email, phone }))
      updateUser({ phone: data.phone })
      await reload()
      toast('Contact details updated')
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="Sign-in">
        <dl className="grid gap-2.5">
          <Detail label="Google account">{user.email}</Detail>
        </dl>
        <p className="mt-3 text-sm text-ink-soft">You sign in with Google, so there is no password to change. To use a different sign-in email, create a new account with it.</p>
      </Card>
      <Card title="Contact details">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="sc-email" error={errors.contactEmail} hint="Shared with founders only after you connect.">
            <TextInput id="sc-email" type="email" value={email} error={errors.contactEmail} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mobile number" htmlFor="sc-phone" error={errors.phone} hint="Kept private.">
            <TextInput id="sc-phone" type="tel" value={phone} error={errors.phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <ErrorText>{errors.form && !errors.contactEmail && !errors.phone ? errors.form : ''}</ErrorText>
        <div className="mt-5"><Button disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save contact details'}</Button></div>
      </Card>
      <Card title="Session">
        <Button variant="secondary" onClick={async () => { await signOut(); navigate('/login?role=investor', { replace: true }) }}>
          <span className="inline-flex items-center gap-2"><LogOut size={18} /> Sign out</span>
        </Button>
      </Card>
    </div>
  )
}

function Visibility() {
  const { profile, reload } = useInvestor()
  const toast = useToast()
  const [visibility, setVisibility] = useState(profile.visibility)
  const [showTicketSize, setShowTicketSize] = useState(profile.showTicketSize)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await patch('/investor-portal/me/settings', { visibility, showTicketSize })
      await reload()
      toast('Visibility updated')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="Who can find you">
        <div role="radiogroup" aria-label="Profile visibility" className="grid gap-3">
          {VISIBILITIES.map((v) => (
            <label key={v.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${visibility === v.id ? 'border-brand bg-brand-soft/50' : 'border-line hover:border-glow'}`}>
              <input type="radio" name="visibility" checked={visibility === v.id} onChange={() => setVisibility(v.id)} className="mt-1 size-4 accent-brand" />
              <span><span className="block text-base font-semibold text-ink">{v.label}</span><span className="block text-sm text-ink-soft">{v.hint}</span></span>
            </label>
          ))}
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={showTicketSize} onChange={(e) => setShowTicketSize(e.target.checked)} className="mt-1 size-4 accent-brand" />
          <span><span className="block text-base text-ink">Show my ticket size on my public profile</span><span className="block text-sm text-ink-soft">Off by default. Your email and mobile number are never shown publicly.</span></span>
        </label>
        <div className="mt-6"><Button disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save visibility'}</Button></div>
      </Card>
      {profile.verification.status !== 'verified' && (
        <p className="text-sm text-ink-soft">Founders can only discover verified investors, whatever the setting above.</p>
      )}
    </div>
  )
}

const PREFS = [
  ['connections', 'Connection requests', 'When a founder sends, accepts or declines a request.'],
  ['messages', 'New messages', 'When a connected founder writes to you.'],
  ['matches', 'New matching startups', 'When startups that fit your preferences join.'],
  ['announcements', 'Platform announcements', 'News and updates from the Toolkit team.'],
]

function NotificationPrefs() {
  const { profile, reload } = useInvestor()
  const toast = useToast()
  const [prefs, setPrefs] = useState({ ...profile.notificationPrefs })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await patch('/investor-portal/me/settings', { notificationPrefs: prefs })
      await reload()
      toast('Notification preferences saved')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card title="Notify me about" className="max-w-3xl">
      <ul className="divide-y divide-line">
        {PREFS.map(([key, label, hint]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-3 py-4">
              <input type="checkbox" checked={prefs[key] !== false} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} className="mt-1 size-4 accent-brand" />
              <span><span className="block text-base text-ink">{label}</span><span className="block text-sm text-ink-soft">{hint}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4"><Button disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save preferences'}</Button></div>
    </Card>
  )
}

function Verification() {
  const { profile, reload, setProfile } = useInvestor()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const v = profile.verification
  const status = VERIFICATION_STATUSES.find((s) => s.id === v.status)

  const resubmit = async () => {
    setBusy(true)
    try {
      await post('/investor-portal/me/resubmit', {})
      await reload()
      toast('Resubmitted for verification')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="Verification status">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={v.status === 'verified' ? 'verified' : v.status === 'rejected' ? 'rejected' : 'pending'} label={status.label} />
          {v.reviewedAt && <span className="text-sm text-ink-soft">Reviewed {formatDate(v.reviewedAt)}</span>}
        </div>
        {v.note && (
          <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-base text-ink"><span className="font-semibold">Note from our team: </span>{v.note}</p>
        )}
        {v.status === 'pending' && <p className="mt-4 text-base text-ink-soft">Our team is reviewing your profile. Adding documents below helps us verify you faster.</p>}
        {v.status === 'verified' && <p className="mt-4 text-base text-ink-soft">You are verified. Founders see a verified badge on your profile and you can connect with them.</p>}
        {['rejected', 'info_required'].includes(v.status) && (
          <div className="mt-5">
            <p className="mb-3 text-base text-ink-soft">Update your profile or documents as asked, then resubmit for review.</p>
            <Button disabled={busy} onClick={resubmit}>{busy ? 'Submitting...' : 'Resubmit for verification'}</Button>
          </div>
        )}
      </Card>
      <Card title="Documents" action={<Badge>{profile.documents.length} / 10</Badge>}>
        <p className="mb-5 text-base text-ink-soft">
          Suggested: PAN or business PAN, organisation registration certificate, your investor profile or portfolio, and any accreditation or investment credentials.
          Your LinkedIn and website links on your profile are also used to verify you.
        </p>
        <DocumentsManager
          documents={profile.documents}
          onChange={(documents) => setProfile({ ...profile, documents })}
          hrefFor={(d) => documentHref(`/investor-portal/me/documents/${d._id ?? d.id}/file`)}
        />
      </Card>
    </div>
  )
}

function Deactivate() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      await post('/investor-portal/me/deactivate', { confirm: true })
      await signOut()
      navigate('/login?role=investor', { replace: true })
    } catch (err) {
      toast(errorMessage(err), 'error')
      setBusy(false)
    }
  }

  return (
    <Card title="Deactivate account" className="max-w-3xl">
      <p className="text-base text-ink">Deactivating hides your profile from founders and signs you out. Your connections, messages and profile are kept, and signing in with Google again reactivates your account.</p>
      <div className="mt-5">
        {!confirming
          ? <Button variant="danger" onClick={() => setConfirming(true)}>Deactivate my account</Button>
          : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-medium text-ink">Are you sure?</span>
              <Button variant="danger" disabled={busy} onClick={run}>{busy ? 'Deactivating...' : 'Yes, deactivate'}</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          )}
      </div>
    </Card>
  )
}
