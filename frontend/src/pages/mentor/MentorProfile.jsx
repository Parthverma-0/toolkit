import { useState } from 'react'
import { Badge, Card } from '../../components/dashboard/Card.jsx'
import AvailabilityEditor from '../../components/dashboard/AvailabilityEditor.jsx'
import MultiToggle from '../../components/dashboard/MultiToggle.jsx'
import { Button, Detail, Drawer, PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import { Field, Textarea, TextInput } from '../../components/ui/Field.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { SECTORS } from '../../constants/startup.js'
import { VIDEO_CATEGORIES, WEEKDAYS } from '../../constants/enums.js'
import { useAuth } from '../../context/AuthContext.jsx'
import useApi from '../../hooks/useApi.js'
import { errorMessage, get, put } from '../../api/client.js'
import { humanize } from '../../utils/format.js'

const EXPERTISE = VIDEO_CATEGORIES.filter((c) => c !== 'other').map((c) => ({ id: c, label: humanize(c) }))

const BLANK = { designation: '', organization: '', yearsOfExperience: '', bio: '', expertise: [], sectors: [], linkedin: '', website: '', availability: [] }

export default function MentorProfile() {
  const state = useApi(() => get('/mentors/me/profile').then((r) => ({ ...BLANK, ...(r.data ?? {}) })))
  return <Async state={state}>{(profile) => <ProfileView profile={profile} setProfile={state.setData} />}</Async>
}

function ProfileView({ profile, setProfile }) {
  const toast = useToast()
  const { user } = useAuth()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const availability = profile.availability ?? []
  const slots = [...availability].sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))

  // PUT /api/mentors/me/profile replaces only the fields sent
  const persist = async (body, message) => {
    const { data } = await put('/mentors/me/profile', body)
    setProfile({ ...BLANK, ...data })
    toast(message)
  }

  const save = async () => {
    if (!draft.designation.trim() || !draft.organization.trim()) return setError('Designation and organisation are required')
    if (!draft.expertise.length) return setError('Pick at least one area of expertise')
    setSaving(true)
    try {
      await persist({
        designation: draft.designation.trim(), organization: draft.organization.trim(),
        yearsOfExperience: draft.yearsOfExperience === '' ? undefined : Number(draft.yearsOfExperience),
        bio: draft.bio.trim(), expertise: draft.expertise, sectors: draft.sectors,
        linkedin: draft.linkedin?.trim() || '', website: draft.website?.trim() || '',
      }, 'Profile updated')
      setDraft(null)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const changeAvailability = async (next) => {
    try {
      await persist({ availability: next }, 'Availability saved')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="This is what founders see when they browse mentors."
        action={<Button onClick={() => { setDraft({ ...profile, yearsOfExperience: profile.yearsOfExperience ?? '', bio: profile.bio ?? '', linkedin: profile.linkedin ?? '', website: profile.website ?? '' }); setError('') }}>Edit profile</Button>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-ink">{user?.name}</p>
              <p className="text-sm text-ink-soft">{[profile.designation, profile.organization].filter(Boolean).join(', ')}{profile.yearsOfExperience !== '' && profile.yearsOfExperience != null && ` · ${profile.yearsOfExperience} years`}</p>
            </div>
            <Badge tone={profile.isVerified ? 'success' : 'warning'}>{profile.isVerified ? 'Verified mentor' : 'Verification pending'}</Badge>
          </div>
          <p className="text-sm text-ink">{profile.bio}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">{(profile.expertise ?? []).map((e) => <Badge key={e} tone="brand">{humanize(e)}</Badge>)}</div>
          <dl className="mt-6 grid gap-2 border-t border-line pt-5">
            <Detail label="Sectors">{(profile.sectors ?? []).map((s) => SECTORS.find((x) => x.id === s)?.label).join(', ')}</Detail>
            <Detail label="LinkedIn">{profile.linkedin}</Detail>
            <Detail label="Website">{profile.website}</Detail>
          </dl>
        </Card>

        <Card title="Weekly availability">
          <p className="mb-4 text-sm text-ink-soft">Founders can only request sessions inside these slots.</p>
          <AvailabilityEditor value={availability} onChange={changeAvailability} />
          {slots.length === 0 && <p className="mt-3 text-xs text-amber-700">With no slots, founders cannot request sessions.</p>}
        </Card>
      </div>

      <Drawer open={Boolean(draft)} title="Edit profile" onClose={() => setDraft(null)}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button></>}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Full name" htmlFor="pn" hint="From your Google account"><TextInput id="pn" value={user?.name ?? ''} readOnly className="bg-sidebar" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Designation" htmlFor="pd" required><TextInput id="pd" value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} /></Field>
              <Field label="Organisation" htmlFor="po" required><TextInput id="po" value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></Field>
            </div>
            <Field label="Years of experience" htmlFor="py" required><TextInput id="py" type="number" min={0} value={draft.yearsOfExperience} onChange={(e) => setDraft({ ...draft, yearsOfExperience: e.target.value })} /></Field>
            <Field label="Bio" htmlFor="pb" required hint={`${draft.bio.length} / 2000`}><Textarea id="pb" rows={4} maxLength={2000} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></Field>
            <Field label="Expertise" required><MultiToggle label="Expertise" options={EXPERTISE} value={draft.expertise} onChange={(expertise) => setDraft({ ...draft, expertise })} /></Field>
            <Field label="Sectors" optional><MultiToggle label="Sectors" options={SECTORS} value={draft.sectors} onChange={(sectors) => setDraft({ ...draft, sectors })} /></Field>
            <Field label="LinkedIn" htmlFor="pl" optional><TextInput id="pl" value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} /></Field>
            <Field label="Website" htmlFor="pw" optional><TextInput id="pw" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  )
}
