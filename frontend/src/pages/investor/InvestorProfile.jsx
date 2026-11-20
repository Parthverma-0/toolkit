import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil } from 'lucide-react'
import { Badge, Card } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, useToast } from '../../components/dashboard/ui.jsx'
import CompletePrompt from '../../components/investor/CompletePrompt.jsx'
import { Avatar } from '../../components/network/People.jsx'
import { useInvestor } from '../../components/investor/InvestorContext.jsx'
import {
  SECTION_COMPONENTS, formFromProfile, payloadFromForm, validateSection,
} from '../../components/investor/ProfileForm.jsx'
import { ErrorText } from '../../components/ui/Field.jsx'
import {
  BUSINESS_MODELS, EQUITY_RANGES, EXPERTISE_AREAS, GEOGRAPHIES, INVESTMENT_APPROACHES, INVESTMENT_FREQUENCIES, INVESTOR_CATEGORIES, INVESTOR_SECTORS,
  INVESTOR_STAGES, INVESTOR_TYPES, REVENUE_PREFERENCES, TICKET_SIZES, VERIFICATION_STATUSES, VISIBILITIES, labelOf,
} from '../../constants/investor.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage, fieldErrors, put } from '../../api/client.js'
import { formatINRShort } from '../../utils/format.js'

const TITLES = {
  basic: 'Basic information',
  organisation: 'Investor and organisation details',
  preferences: 'Investment preferences',
  background: 'Background and expertise',
}

const names = (list, ids = []) => ids.map((id) => labelOf(list, id)).join(', ')
const Chips = ({ list, ids }) => (ids?.length ? (
  <div className="flex flex-wrap gap-2">{ids.map((id) => <Badge key={id} tone="brand">{labelOf(list, id)}</Badge>)}</div>
) : null)

// Own profile, laid out like the public page founders see, with an editor per section
export default function InvestorProfile() {
  const { complete, openProfileForm } = useInvestor()
  if (!complete) return <CompletePrompt title="Profile" onComplete={() => openProfileForm('profile')} />
  return <ProfileView />
}

function ProfileView() {
  const { profile, reload } = useInvestor()
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // section name
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const open = (section) => { setForm(formFromProfile(profile, user)); setErrors({}); setSaveError(''); setEditing(section) }
  const close = () => setEditing(null)
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n })
  }

  const save = async () => {
    const e = validateSection(editing, form)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    setSaveError('')
    try {
      const { data } = await put('/investor-portal/me/profile', payloadFromForm(form, [editing]))
      if (editing === 'basic') updateUser({ name: data.fullName, phone: data.phone })
      await reload()
      toast('Profile updated')
      close()
    } catch (err) {
      setSaveError(errorMessage(err))
      setErrors(fieldErrors(err))
    } finally {
      setSaving(false)
    }
  }

  const p = profile
  const status = VERIFICATION_STATUSES.find((s) => s.id === p.verification.status)
  const Section = editing ? SECTION_COMPONENTS[editing] : null
  const ticket = [names(TICKET_SIZES, p.ticketSizes),
    (p.customTicket?.min != null || p.customTicket?.max != null) && `Custom ${formatINRShort(p.customTicket.min ?? 0)} - ${p.customTicket.max != null ? formatINRShort(p.customTicket.max) : 'no limit'}`]
    .filter(Boolean).join(' · ')
  const editBtn = (section) => (
    <Button size="sm" variant="secondary" onClick={() => open(section)}>
      <span className="inline-flex items-center gap-1.5"><Pencil size={14} /> Edit</span>
    </Button>
  )

  return (
    <div>
      <PageHeader title="Profile" subtitle="This is how founders see you. Update your investment preferences any time; recommendations follow them." />

      <div className="grid gap-6">
        <Card>
          <div className="flex flex-wrap items-start gap-5">
            <Avatar name={p.fullName} src={p.photo} size={88} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold text-ink">{p.fullName}</h2>
              <p className="text-base text-ink-soft">{[p.designation, p.organisationName].filter(Boolean).join(' · ')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{labelOf(INVESTOR_TYPES, p.investorType)}</Badge>
                <StatusPill status={p.verification.status === 'verified' ? 'verified' : 'pending'} label={status.label} />
                <Badge>{labelOf(VISIBILITIES, p.visibility).replace(' profile', '')} profile</Badge>
              </div>
              {p.bio && <p className="mt-4 max-w-3xl text-base whitespace-pre-line text-ink">{p.bio}</p>}
            </div>
            {editBtn('basic')}
          </div>
          <dl className="mt-6 grid gap-2.5 border-t border-line pt-5">
            <Detail label="Location">{[p.location, p.country].filter(Boolean).join(', ')}</Detail>
            <Detail label="Email (private)">{p.contactEmail}</Detail>
            <Detail label="Mobile (private)">{p.phone}</Detail>
            <Detail label="LinkedIn">{p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{p.linkedin} <ExternalLink size={13} /></a>}</Detail>
          </dl>
          <p className="mt-4 text-sm text-ink-soft">Your email and mobile number are only shared with founders after you accept a connection. Change who sees your profile in <Link to="/investor/settings" className="font-semibold text-brand hover:underline">Settings</Link>.</p>
        </Card>

        <Card title="Investor and organisation" action={editBtn('organisation')}>
          <dl className="grid gap-2.5">
            <Detail label="Category">{labelOf(INVESTOR_CATEGORIES, p.category)}</Detail>
            <Detail label="Investor type">{labelOf(INVESTOR_TYPES, p.investorType)}</Detail>
            <Detail label="Organisation">{p.organisationName}</Detail>
            <Detail label="Head office">{p.headOffice}</Detail>
            <Detail label="Established">{p.yearEstablished}</Detail>
            <Detail label="Website">{p.organisationWebsite && <a href={p.organisationWebsite} target="_blank" rel="noreferrer" className="text-brand hover:underline">{p.organisationWebsite}</a>}</Detail>
            <Detail label="Organisation LinkedIn">{p.organisationLinkedin && <a href={p.organisationLinkedin} target="_blank" rel="noreferrer" className="text-brand hover:underline">{p.organisationLinkedin}</a>}</Detail>
          </dl>
        </Card>

        <Card title="Investment preferences" action={editBtn('preferences')}>
          <div className="grid gap-5">
            <div><p className="mb-2 text-sm font-semibold text-ink-soft uppercase">Sectors</p><Chips list={INVESTOR_SECTORS} ids={p.sectors} /></div>
            <div><p className="mb-2 text-sm font-semibold text-ink-soft uppercase">Stages</p><Chips list={INVESTOR_STAGES} ids={p.stages} /></div>
            <div><p className="mb-2 text-sm font-semibold text-ink-soft uppercase">Locations</p><Chips list={GEOGRAPHIES} ids={p.locations} /></div>
            <dl className="grid gap-2.5 border-t border-line pt-5">
              <Detail label="Ticket size">{ticket}</Detail>
              <Detail label="Business models">{names(BUSINESS_MODELS, p.businessModels)}</Detail>
              <Detail label="Revenue preference">{names(REVENUE_PREFERENCES, p.revenuePreferences)}</Detail>
              <Detail label="Approach">{names(INVESTMENT_APPROACHES, p.approaches)}</Detail>
              <Detail label="Frequency">{p.frequency && labelOf(INVESTMENT_FREQUENCIES, p.frequency)}</Detail>
              <Detail label="Equity range">{names(EQUITY_RANGES, p.equityRanges)}</Detail>
            </dl>
            <p className="text-sm text-ink-soft">{p.showTicketSize ? 'Your ticket size is shown on your public profile.' : 'Your ticket size is hidden from your public profile. You can show it in Settings.'}</p>
          </div>
        </Card>

        <Card title="Background and expertise" action={editBtn('background')}>
          <dl className="grid gap-2.5">
            <Detail label="Professional background">{p.professionalBackground && <span className="whitespace-pre-line">{p.professionalBackground}</span>}</Detail>
            <Detail label="Investment experience">{p.yearsOfExperience != null && `${p.yearsOfExperience} years`}</Detail>
            <Detail label="Startups invested in">{p.previousInvestments}</Detail>
            <Detail label="Expertise">{names(EXPERTISE_AREAS, p.expertise)}</Detail>
            <Detail label="Support offered">{[p.mentorshipAvailable && 'Mentorship', p.strategicSupport && 'Strategic guidance', p.networkingSupport && 'Industry connections'].filter(Boolean).join(', ')}</Detail>
          </dl>
          {p.portfolio?.length > 0 && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 text-sm font-semibold text-ink-soft uppercase">Portfolio</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.portfolio.map((c) => (
                  <li key={c._id} className="rounded-lg border border-line px-4 py-3 text-base text-ink">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-ink-soft">{[c.sector, c.year].filter(Boolean).map((v) => ` · ${v}`).join('')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={Boolean(editing)} title={editing ? TITLES[editing] : ''} onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</Button></>}
      >
        {Section && form && (
          <>
            <Section form={form} set={set} errors={errors} />
            <ErrorText>{saveError}</ErrorText>
          </>
        )}
      </Drawer>
    </div>
  )
}
