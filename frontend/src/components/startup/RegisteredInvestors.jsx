import { useState } from 'react'
import { ExternalLink, Flag, Star } from 'lucide-react'
import { Badge, Card, Empty } from '../dashboard/Card.jsx'
import { Button, Detail, Drawer, SearchInput, StatusPill, useToast } from '../dashboard/ui.jsx'
import Async from '../dashboard/Async.jsx'
import { Field, Select, Textarea } from '../ui/Field.jsx'
import { Avatar } from '../network/People.jsx'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import {
  EXPERTISE_AREAS, GEOGRAPHIES, INVESTOR_SECTORS, INVESTOR_STAGES, INVESTOR_TYPES, REPORT_REASONS, TICKET_SIZES, labelOf,
} from '../../constants/investor.js'
import { errorMessage, get, post } from '../../api/client.js'

const ANY = (label) => ({ id: '', label })
const names = (list, ids = []) => ids.map((id) => labelOf(list, id)).join(', ')
const connectLabel = (c) => {
  if (!c) return null
  if (c.status === 'accepted') return 'Connected'
  if (c.status === 'pending') return c.initiatedBy === 'startup' ? 'Request sent' : 'Wants to connect'
  return null
}

// Verified investors who joined Toolkit as investors; founders filter, read profiles and connect.
export default function RegisteredInvestors({ onChanged }) {
  const [query, setQuery] = useState('')
  const [f, setF] = useState({ type: '', sector: '', stage: '', ticket: '', featured: '' })
  const [selected, setSelected] = useState(null)
  const q = useDebounced(query.trim(), 300)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const params = { q: q || undefined, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')) }
  const state = useApi(() => get('/network/investors', { ...params, limit: 48 }).then((r) => r.data), [JSON.stringify(params)])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or firm" />
        <div className="w-56"><Select aria-label="Investor type" value={f.type} options={[ANY('Any investor type'), ...INVESTOR_TYPES]} onChange={(e) => set({ type: e.target.value })} /></div>
        <div className="w-48"><Select aria-label="Sector" value={f.sector} options={[ANY('Any sector'), ...INVESTOR_SECTORS]} onChange={(e) => set({ sector: e.target.value })} /></div>
        <div className="w-48"><Select aria-label="Stage" value={f.stage} options={[ANY('Any stage'), ...INVESTOR_STAGES]} onChange={(e) => set({ stage: e.target.value })} /></div>
        <div className="w-52"><Select aria-label="Ticket size" value={f.ticket} options={[ANY('Any ticket size'), ...TICKET_SIZES]} onChange={(e) => set({ ticket: e.target.value })} /></div>
      </div>

      <Async state={state}>{(list) => (list.length === 0 ? (
        <Card><Empty title="No investors found">Verified investors who match these filters will appear here. Try removing a filter.</Empty></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((i) => (
            <Card key={i.id} className="flex flex-col">
              <div className="flex items-start gap-4">
                <Avatar name={i.name} src={i.photo} size={52} />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setSelected(i.id)} className="block max-w-full truncate text-left text-lg font-semibold text-ink hover:text-brand">{i.name}</button>
                  <p className="truncate text-sm text-ink-soft">{[i.designation, i.organisationName].filter(Boolean).join(', ')}</p>
                </div>
                {i.isFeatured && <Star size={18} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Featured investor" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="brand">{labelOf(INVESTOR_TYPES, i.investorType)}</Badge>
                <Badge tone="success">Verified</Badge>
              </div>
              <p className="mt-3 flex-1 text-sm text-ink-soft">{names(INVESTOR_SECTORS, i.sectors.slice(0, 5)) || 'Sector agnostic'}{i.sectors.length > 5 && ` +${i.sectors.length - 5}`}</p>
              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <Button size="sm" variant="secondary" onClick={() => setSelected(i.id)}>View profile</Button>
                {connectLabel(i.connection)
                  ? <StatusPill status={i.connection.status === 'accepted' ? 'accepted' : 'requested'} label={connectLabel(i.connection)} />
                  : <Button size="sm" onClick={() => setSelected(i.id)}>Connect</Button>}
              </div>
            </Card>
          ))}
        </div>
      ))}</Async>

      {selected && <InvestorDrawer id={selected} onClose={() => setSelected(null)} onChanged={() => { state.reload(); onChanged?.() }} />}
    </>
  )
}

function InvestorDrawer({ id, onClose, onChanged }) {
  const state = useApi(() => get(`/network/investors/${id}`).then((r) => r.data), [id])
  return (
    <Drawer open title={state.data?.name ?? 'Investor'} subtitle={state.data && [state.data.designation, state.data.organisationName].filter(Boolean).join(', ')} onClose={onClose}>
      <Async state={state}>{(i) => <Body i={i} reload={state.reload} onChanged={onChanged} />}</Async>
    </Drawer>
  )
}

function Body({ i, reload, onChanged }) {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)
  const [report, setReport] = useState({ reason: 'fake_profile', details: '' })
  const c = i.connection
  const canConnect = !c || ['declined', 'withdrawn'].includes(c.status)

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      await post('/network/connections', { investorId: i.id, message: message.trim() || undefined })
      toast(`Connection request sent to ${i.name}`)
      await reload()
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const sendReport = async () => {
    setBusy(true)
    try {
      const r = await post(`/network/investors/${i.id}/report`, report)
      toast(r.message)
      setReporting(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-7">
      <div className="flex items-center gap-4">
        <Avatar name={i.name} src={i.photo} size={72} />
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{labelOf(INVESTOR_TYPES, i.investorType)}</Badge>
          <Badge tone="success">Verified</Badge>
          {i.isFeatured && <Badge tone="warning">Featured</Badge>}
        </div>
      </div>

      {i.limited && <p className="rounded-lg bg-canvas px-4 py-3 text-sm text-ink-soft">This investor shares a limited profile. More details appear once you are connected.</p>}
      {i.bio && <p className="text-base whitespace-pre-line text-ink">{i.bio}</p>}

      <dl className="grid gap-2.5">
        <Detail label="Sectors">{names(INVESTOR_SECTORS, i.sectors)}</Detail>
        {!i.limited && <Detail label="Stages">{names(INVESTOR_STAGES, i.stages)}</Detail>}
        {!i.limited && <Detail label="Ticket size">{i.ticketSizes && names(TICKET_SIZES, i.ticketSizes)}</Detail>}
        {!i.limited && <Detail label="Invests in">{names(GEOGRAPHIES, i.locations)}</Detail>}
        {!i.limited && <Detail label="Based in">{[i.location, i.country].filter(Boolean).join(', ')}</Detail>}
        {!i.limited && <Detail label="Experience">{i.yearsOfExperience != null && `${i.yearsOfExperience} years${i.previousInvestments ? `, ${i.previousInvestments} investments` : ''}`}</Detail>}
        {!i.limited && <Detail label="Expertise">{names(EXPERTISE_AREAS, i.expertise)}</Detail>}
        {!i.limited && <Detail label="Support offered">{[i.mentorshipAvailable && 'Mentorship', i.strategicSupport && 'Strategic guidance', i.networkingSupport && 'Industry connections'].filter(Boolean).join(', ')}</Detail>}
        {!i.limited && <Detail label="LinkedIn">{i.linkedin && <a href={i.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">Profile <ExternalLink size={13} /></a>}</Detail>}
        {!i.limited && <Detail label="Website">{i.organisationWebsite && <a href={i.organisationWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{i.organisationWebsite} <ExternalLink size={13} /></a>}</Detail>}
      </dl>

      {i.portfolio?.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-soft uppercase">Portfolio</h3>
          <ul className="grid gap-2">
            {i.portfolio.map((p) => <li key={p.id} className="rounded-lg border border-line px-4 py-2.5 text-base text-ink">{p.name}<span className="text-ink-soft">{[p.sector, p.year].filter(Boolean).map((v) => ` · ${v}`).join('')}</span></li>)}
          </ul>
        </section>
      )}

      {i.contact && (
        <section className="rounded-xl border border-line p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-soft uppercase">Contact (shared because you are connected)</h3>
          <dl className="grid gap-1.5"><Detail label="Email">{i.contact.email}</Detail><Detail label="Mobile">{i.contact.phone}</Detail></dl>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">Connection</h3>
        {canConnect && (
          <div className="grid gap-3">
            <Field label="Introduction" htmlFor="imsg2" optional hint="Who you are and why this investor fits your startup.">
              <Textarea id="imsg2" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div><Button disabled={busy} onClick={connect}>{busy ? 'Sending...' : c ? 'Connect again' : 'Send connection request'}</Button></div>
          </div>
        )}
        {c?.status === 'pending' && c.initiatedBy === 'startup' && <p className="text-base text-ink-soft">Your request is waiting for {i.name} to respond.</p>}
        {c?.status === 'pending' && c.initiatedBy === 'investor' && <p className="text-base text-ink">{i.name} has asked to connect with you. Accept the request from the Requests tab.</p>}
        {c?.status === 'accepted' && <p className="text-base text-ink">You are connected. Continue the conversation from the Messages tab.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className="border-t border-line pt-5">
        {!reporting ? (
          <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-red-600"><Flag size={14} /> Report this profile</button>
        ) : (
          <div className="grid gap-3">
            <Field label="Reason" htmlFor="rrs"><Select id="rrs" value={report.reason} options={REPORT_REASONS} onChange={(e) => setReport({ ...report, reason: e.target.value })} /></Field>
            <Field label="Details" htmlFor="rdt" optional><Textarea id="rdt" rows={3} maxLength={2000} value={report.details} onChange={(e) => setReport({ ...report, details: e.target.value })} /></Field>
            <div className="flex gap-2"><Button size="sm" variant="danger" disabled={busy} onClick={sendReport}>Submit report</Button><Button size="sm" variant="ghost" onClick={() => setReporting(false)}>Cancel</Button></div>
          </div>
        )}
      </section>
    </div>
  )
}
