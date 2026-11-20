import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react'
import { Badge } from '../dashboard/Card.jsx'
import { Button, Detail, Drawer, StatusPill, useToast } from '../dashboard/ui.jsx'
import Async from '../dashboard/Async.jsx'
import { Field, Textarea } from '../ui/Field.jsx'
import { Avatar } from '../network/People.jsx'
import { MatchBadge, connectionState } from './StartupCard.jsx'
import { useInvestor } from './InvestorContext.jsx'
import useApi from '../../hooks/useApi.js'
import { SECTORS, STAGES } from '../../constants/startup.js'
import { BUSINESS_MODELS, FUNDING_STATUSES, REVENUE_PREFERENCES, ageLabel, labelOf } from '../../constants/investor.js'
import { del, errorMessage, get, post, put } from '../../api/client.js'
import { formatDate, formatINR } from '../../utils/format.js'

// Full startup profile for an investor: facts the founder shares, shortlist + private note,
// and the "Connect with Founder" request with an introductory message.
export default function StartupDrawer({ id, onClose, onChanged }) {
  const state = useApi(() => get(`/investor-portal/startups/${id}`).then((r) => r.data), [id])
  return (
    <Drawer open title={state.data?.name ?? 'Startup'} subtitle={state.data?.tagline} onClose={onClose}>
      <Async state={state}>{(s) => <Body startup={s} reload={state.reload} onChanged={onChanged} />}</Async>
    </Drawer>
  )
}

function Body({ startup: s, reload, onChanged }) {
  const toast = useToast()
  const { verified, complete, openProfileForm } = useInvestor()
  const [note, setNote] = useState(s.note ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const conn = connectionState(s.connection)
  const place = [s.address?.city, s.address?.state, s.address?.country].filter(Boolean).join(', ')

  const run = async (fn, success) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (success) toast(success)
      await reload()
      onChanged?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleShortlist = () => (!complete ? openProfileForm('shortlist') : run(
    () => (s.shortlisted ? del(`/investor-portal/shortlist/${s.id}`) : put(`/investor-portal/shortlist/${s.id}`, { note })),
    s.shortlisted ? 'Removed from shortlist' : 'Added to shortlist',
  ))
  const saveNote = () => run(() => put(`/investor-portal/shortlist/${s.id}`, { note }), 'Note saved')
  const connect = () => (!complete ? openProfileForm('connect') : run(() => post('/network/connections', { startupId: s.id, message: message.trim() || undefined }), 'Connection request sent'))

  return (
    <div className="grid gap-7">
      <div className="flex items-start gap-4">
        <Avatar name={s.name} src={s.logo} size={64} square />
        <div className="min-w-0 flex-1">
          <p className="text-base text-ink-soft">{labelOf(SECTORS, s.sector)} · {labelOf(STAGES, s.stage)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <MatchBadge match={s.match} />
            {s.verified && <Badge tone="success">Verified startup</Badge>}
            {s.incubator && <Badge tone="brand">{s.incubator.name}</Badge>}
          </div>
        </div>
        <Button size="sm" variant={s.shortlisted ? 'secondary' : 'primary'} disabled={busy} onClick={toggleShortlist}>
          <span className="inline-flex items-center gap-1.5">
            {s.shortlisted ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {s.shortlisted ? 'Shortlisted' : 'Shortlist'}
          </span>
        </Button>
      </div>

      {s.match?.reasons?.length > 0 && (
        <p className="rounded-lg bg-brand-soft/60 px-4 py-3 text-sm text-ink">
          Matches your preferences on: <strong>{s.match.reasons.join(', ')}</strong>
        </p>
      )}

      {(s.problemStatement || s.solution || s.tagline) && (
        <section className="grid gap-3">
          {s.problemStatement && <div><h3 className="text-sm font-semibold text-ink-soft uppercase">Problem</h3><p className="mt-1 text-base whitespace-pre-line text-ink">{s.problemStatement}</p></div>}
          {s.solution && <div><h3 className="text-sm font-semibold text-ink-soft uppercase">Solution</h3><p className="mt-1 text-base whitespace-pre-line text-ink">{s.solution}</p></div>}
        </section>
      )}

      <dl className="grid gap-2.5">
        <Detail label="Funding required">{s.fundingAsk ? formatINR(s.fundingAsk) : ''}</Detail>
        <Detail label="Funding status">{s.fundingStatus && labelOf(FUNDING_STATUSES, s.fundingStatus)}</Detail>
        <Detail label="Business model">{s.businessModel && labelOf(BUSINESS_MODELS, s.businessModel)}</Detail>
        <Detail label="Revenue">{s.revenueStatus && labelOf(REVENUE_PREFERENCES, s.revenueStatus)}</Detail>
        <Detail label="Location">{place}</Detail>
        <Detail label="Founded">{s.foundedOn && `${formatDate(s.foundedOn)} ${new Date(s.foundedOn).getFullYear()} (${ageLabel(s.foundedOn)})`}</Detail>
        <Detail label="Team size">{s.teamSize}</Detail>
        <Detail label="Website">{s.website && <a href={s.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{s.website} <ExternalLink size={13} /></a>}</Detail>
      </dl>
      <p className="-mt-3 text-xs text-ink-soft">Funding and revenue details appear only when the founder chooses to share them.</p>

      {s.founders?.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-soft uppercase">Founders</h3>
          <ul className="grid gap-2">
            {s.founders.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-base text-ink">
                <span>{f.fullName}{f.designation && <span className="text-ink-soft"> · {f.designation}</span>}</span>
                {f.linkedin && <a href={f.linkedin} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand hover:underline">LinkedIn</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.contact && (
        <section className="rounded-xl border border-line p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-soft uppercase">Contact (shared after connecting)</h3>
          <dl className="grid gap-1.5 text-base">
            <Detail label="Founder email">{s.contact.founderEmail}</Detail>
            <Detail label="Founder phone">{s.contact.founderPhone}</Detail>
            <Detail label="Startup email">{s.contact.startupEmail}</Detail>
          </dl>
        </section>
      )}

      {s.shortlisted && complete && (
        <section>
          <Field label="Private note" htmlFor="snote" hint="Only you can see this.">
            <Textarea id="snote" rows={3} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-2 text-right"><Button size="sm" variant="secondary" disabled={busy || note === (s.note ?? '')} onClick={saveNote}>Save note</Button></div>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">Connection</h3>
        {conn.action === 'connect' && (
          <div className="grid gap-3">
            {complete && !verified && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You can connect with founders once our team has verified your profile. <Link to="/investor/settings?tab=verification" className="font-semibold underline">Check status</Link>
              </p>
            )}
            <Field label="Introductory message" htmlFor="smsg" optional hint="A few lines on why this startup interests you.">
              <Textarea id="smsg" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div><Button disabled={busy || (complete && !verified)} onClick={connect}>{busy ? 'Sending...' : conn.label}</Button></div>
          </div>
        )}
        {conn.action === 'none' && <p className="text-base text-ink-soft"><StatusPill status="requested" label="Request sent" /> Waiting for the founder to respond.</p>}
        {conn.action === 'respond' && (
          <p className="text-base text-ink">The founder has asked to connect with you. <Link to="/investor/connections" className="font-semibold text-brand hover:underline">Respond in Connections</Link></p>
        )}
        {conn.action === 'message' && (
          <p className="text-base text-ink"><StatusPill status="accepted" label="Connected" /> <Link to="/investor/messages" className="ml-2 font-semibold text-brand hover:underline">Open messages</Link></p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  )
}
