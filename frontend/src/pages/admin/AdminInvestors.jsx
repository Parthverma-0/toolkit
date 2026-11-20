import { useState } from 'react'
import { Download } from 'lucide-react'
import { Badge, Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, SearchInput, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import HBarList from '../../components/dashboard/HBarList.jsx'
import DocumentsManager, { documentHref } from '../../components/investor/DocumentsManager.jsx'
import { Field, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { Avatar } from '../../components/network/People.jsx'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import {
  BUSINESS_MODELS, GEOGRAPHIES, INVESTOR_CATEGORIES, INVESTOR_SECTORS, INVESTOR_STAGES, INVESTOR_TYPES,
  REPORT_REASONS, TICKET_SIZES, VERIFICATION_STATUSES, labelOf,
} from '../../constants/investor.js'
import { download, errorMessage, get, patch, post } from '../../api/client.js'
import { formatDate, formatDateTime, formatINRShort } from '../../utils/format.js'

const BASE = '/admin/investor-network'
const ALL = { id: '', label: 'All' }
const statusPill = (s) => <StatusPill status={s === 'verified' ? 'verified' : s === 'rejected' ? 'rejected' : 'pending'} label={labelOf(VERIFICATION_STATUSES, s).replace('Additional Information Required', 'Info required')} />

export default function AdminInvestors() {
  const [tab, setTab] = useState('overview')
  const [openId, setOpenId] = useState(null)
  return (
    <div>
      <PageHeader title="Investors" subtitle="Verify investor accounts, moderate profiles and watch investor-founder activity." />
      <Tabs
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'investors', label: 'All investors' }, { id: 'connections', label: 'Connections' }, { id: 'reports', label: 'Reported profiles' }]}
        value={tab} onChange={setTab}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'investors' && <InvestorList onOpen={setOpenId} />}
      {tab === 'connections' && <ConnectionList />}
      {tab === 'reports' && <Reports onOpen={setOpenId} />}
      {openId && <InvestorDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

// ---------- overview ----------

const rows = (list, labels) => (list ?? []).map((r) => ({ label: labelOf(labels, r.id), value: r.count }))

function Overview() {
  const state = useApi(() => get(`${BASE}/stats`).then((r) => r.data))
  return (
    <Async state={state}>{(s) => (
      <div className="grid gap-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Card><Stat value={s.totalInvestors} label="Registered investors" /></Card>
          <Card><Stat value={s.verified} label="Verified investors" /></Card>
          <Card><Stat value={s.pending + s.infoRequired} label="Waiting for review" /></Card>
          <Card><Stat value={`${s.acceptedConnections} / ${s.totalConnections}`} label="Investor-founder connections (accepted / total)" /></Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Investor categories">{s.categories.length ? <HBarList rows={rows(s.categories, INVESTOR_CATEGORIES)} /> : <Empty>No data yet.</Empty>}</Card>
          <Card title="Investor types">{s.types.length ? <HBarList rows={rows(s.types, INVESTOR_TYPES)} /> : <Empty>No data yet.</Empty>}</Card>
          <Card title="Sector-wise distribution">{s.sectors.length ? <HBarList rows={rows(s.sectors, INVESTOR_SECTORS)} /> : <Empty>No data yet.</Empty>}</Card>
          <Card title="Location-wise distribution">{s.locations.length ? <HBarList rows={s.locations.map((r) => ({ label: r.id, value: r.count }))} /> : <Empty>No data yet.</Empty>}</Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Verification"><HBarList rows={[
            { label: 'Verified', value: s.verified }, { label: 'Pending', value: s.pending },
            { label: 'Information required', value: s.infoRequired }, { label: 'Rejected', value: s.rejected },
          ]} /></Card>
          <Announce />
        </div>
      </div>
    )}</Async>
  )
}

function Announce() {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!title.trim()) return toast('Add a title', 'error')
    setBusy(true)
    try {
      const r = await post(`${BASE}/announcements`, { title: title.trim(), body: body.trim() || undefined })
      toast(r.message)
      setTitle('')
      setBody('')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Platform announcement">
      <div className="grid gap-4">
        <Field label="Title" htmlFor="an-title"><TextInput id="an-title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Message" htmlFor="an-body" optional><Textarea id="an-body" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div><Button disabled={busy} onClick={send}>{busy ? 'Sending...' : 'Send to all investors'}</Button></div>
      </div>
    </Card>
  )
}

// ---------- investors ----------

function InvestorList({ onOpen }) {
  const toast = useToast()
  const [f, setF] = useState({ status: '', type: '', category: '', featured: '' })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(query.trim(), 300)
  const params = { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), q: q || undefined }
  const state = useApi(() => get(`${BASE}/investors`, { ...params, page, limit: 25 }), [JSON.stringify(params), page])
  const set = (patch2) => { setF((x) => ({ ...x, ...patch2 })); setPage(1) }

  const exportCsv = async () => {
    try { await download(`${BASE}/export`, 'investors.csv', params) } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1) }} placeholder="Search name, email, organisation or city" />
        <div className="w-48"><Select aria-label="Verification status" value={f.status} options={[{ id: '', label: 'Any verification' }, ...VERIFICATION_STATUSES]} onChange={(e) => set({ status: e.target.value })} /></div>
        <div className="w-52"><Select aria-label="Investor type" value={f.type} options={[{ id: '', label: 'Any type' }, ...INVESTOR_TYPES]} onChange={(e) => set({ type: e.target.value })} /></div>
        <div className="w-44"><Select aria-label="Category" value={f.category} options={[{ id: '', label: 'Any category' }, ...INVESTOR_CATEGORIES]} onChange={(e) => set({ category: e.target.value })} /></div>
        <div className="w-40"><Select aria-label="Featured" value={f.featured} options={[{ id: '', label: 'Featured: any' }, { id: 'true', label: 'Featured' }, { id: 'false', label: 'Not featured' }]} onChange={(e) => set({ featured: e.target.value })} /></div>
        <Button variant="secondary" onClick={exportCsv}><span className="inline-flex items-center gap-2"><Download size={18} /> Export CSV</span></Button>
      </div>
      <Async state={state}>{({ data, pagination }) => (
        <Card>
          {data.length === 0 ? <Empty title="No investors match">Try changing the filters.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-soft">
                    <th className="py-2 pr-4 font-medium">Investor</th><th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Location</th><th className="py-2 pr-4 font-medium">Docs</th>
                    <th className="py-2 pr-4 font-medium">Submitted</th><th className="py-2 pr-4 font-medium">Verification</th>
                    <th className="py-2 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.map((i) => (
                    <tr key={i.id} onClick={() => onOpen(i.id)} className="cursor-pointer hover:bg-canvas">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={i.name} src={i.photo} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{i.name} {i.isFeatured && <Badge tone="brand">Featured</Badge>}</p>
                            <p className="truncate text-ink-soft">{i.organisationName || i.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-ink">{labelOf(INVESTOR_TYPES, i.investorType)}</td>
                      <td className="py-3 pr-4 text-ink-soft">{[i.location, i.country].filter(Boolean).join(', ')}</td>
                      <td className="py-3 pr-4 text-ink-soft tabular-nums">{i.documentCount}</td>
                      <td className="py-3 pr-4 text-ink-soft">{formatDate(i.submittedAt)}</td>
                      <td className="py-3 pr-4">{statusPill(i.verification.status)}</td>
                      <td className="py-3"><StatusPill status={i.accountStatus === 'active' ? 'active' : 'rejected'} label={i.accountStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between text-sm text-ink-soft">
            <span>{pagination.total} investors</span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              Page {page} of {Math.max(pagination.totalPages, 1)}
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </span>
          </div>
        </Card>
      )}</Async>
    </div>
  )
}

function InvestorDrawer({ id, onClose }) {
  const state = useApi(() => get(`${BASE}/investors/${id}`).then((r) => r.data), [id])
  const p = state.data
  return (
    <Drawer open title={p?.fullName ?? 'Investor'} subtitle={p && [p.designation, p.organisationName].filter(Boolean).join(' · ')} onClose={onClose}>
      <Async state={state}>{(inv) => <DrawerBody inv={inv} reload={state.reload} />}</Async>
    </Drawer>
  )
}

function DrawerBody({ inv, reload }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const names = (list, ids = []) => ids.map((x) => labelOf(list, x)).join(', ')
  const ticket = [names(TICKET_SIZES, inv.ticketSizes), (inv.customTicket?.min != null || inv.customTicket?.max != null) && `Custom ${formatINRShort(inv.customTicket.min ?? 0)} - ${inv.customTicket.max != null ? formatINRShort(inv.customTicket.max) : 'no limit'}`].filter(Boolean).join(' · ')

  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); toast(ok); setNote(''); await reload() } catch (err) { toast(errorMessage(err), 'error') } finally { setBusy(false) }
  }
  const verify = (status) => run(() => patch(`${BASE}/investors/${inv.id ?? inv._id}/verification`, { status, note: note.trim() || undefined }), 'Verification updated')
  const feature = () => run(() => patch(`${BASE}/investors/${inv._id}/feature`, { isFeatured: !inv.isFeatured }), inv.isFeatured ? 'Removed from featured' : 'Marked as featured')
  const suspended = inv.accountStatus === 'suspended'
  const setAccount = () => run(() => patch(`/admin/users/${inv.userId}/status`, { status: suspended ? 'active' : 'suspended' }), suspended ? 'Account reactivated' : 'Account suspended')
  const needsNote = !note.trim()

  return (
    <div className="grid gap-7">
      <div className="flex items-center gap-4">
        <Avatar name={inv.fullName} src={inv.photo} size={64} />
        <div>
          <div className="flex flex-wrap items-center gap-2">{statusPill(inv.verification.status)}{inv.isFeatured && <Badge tone="brand">Featured</Badge>}{suspended && <Badge tone="danger">Suspended</Badge>}</div>
          <p className="mt-1 text-sm text-ink-soft">Registered {formatDate(inv.registeredAt)} · Last sign-in {inv.lastLoginAt ? formatDate(inv.lastLoginAt) : 'never'}</p>
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-line p-4">
        <h3 className="font-display text-lg font-bold text-ink">Verification decision</h3>
        {inv.verification.note && <p className="text-sm text-ink-soft">Last note: {inv.verification.note}</p>}
        <Field label="Note to the investor" htmlFor="vnote" hint="Required to reject or ask for more information.">
          <Textarea id="vnote" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || inv.verification.status === 'verified'} onClick={() => verify('verified')}>Verify</Button>
          <Button size="sm" variant="secondary" disabled={busy || needsNote} onClick={() => verify('info_required')}>Request information</Button>
          <Button size="sm" variant="danger" disabled={busy || needsNote} onClick={() => verify('rejected')}>Reject</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={feature}>{inv.isFeatured ? 'Unfeature' : 'Feature'}</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={setAccount}>{suspended ? 'Reactivate account' : 'Suspend account'}</Button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">Registration details</h3>
        <dl className="grid gap-2.5">
          <Detail label="Sign-in email">{inv.email}</Detail>
          <Detail label="Contact email">{inv.contactEmail}</Detail>
          <Detail label="Mobile">{inv.phone}</Detail>
          <Detail label="Location">{[inv.location, inv.country].filter(Boolean).join(', ')}</Detail>
          <Detail label="LinkedIn">{inv.linkedin && <a href={inv.linkedin} target="_blank" rel="noreferrer" className="text-brand hover:underline">{inv.linkedin}</a>}</Detail>
          <Detail label="Category">{labelOf(INVESTOR_CATEGORIES, inv.category)}</Detail>
          <Detail label="Investor type">{labelOf(INVESTOR_TYPES, inv.investorType)}</Detail>
          <Detail label="Organisation">{inv.organisationName}</Detail>
          <Detail label="Website">{inv.organisationWebsite && <a href={inv.organisationWebsite} target="_blank" rel="noreferrer" className="text-brand hover:underline">{inv.organisationWebsite}</a>}</Detail>
          <Detail label="Org. LinkedIn">{inv.organisationLinkedin && <a href={inv.organisationLinkedin} target="_blank" rel="noreferrer" className="text-brand hover:underline">{inv.organisationLinkedin}</a>}</Detail>
          <Detail label="Established">{inv.yearEstablished}</Detail>
          <Detail label="Head office">{inv.headOffice}</Detail>
          <Detail label="Sectors">{names(INVESTOR_SECTORS, inv.sectors)}</Detail>
          <Detail label="Stages">{names(INVESTOR_STAGES, inv.stages)}</Detail>
          <Detail label="Ticket size">{ticket}</Detail>
          <Detail label="Locations">{names(GEOGRAPHIES, inv.locations)}</Detail>
          <Detail label="Business models">{names(BUSINESS_MODELS, inv.businessModels)}</Detail>
          <Detail label="Experience">{inv.yearsOfExperience != null && `${inv.yearsOfExperience} years, ${inv.previousInvestments ?? 0} investments`}</Detail>
          <Detail label="Portfolio">{inv.portfolio?.map((c) => c.name).join(', ')}</Detail>
          <Detail label="Bio">{inv.bio && <span className="whitespace-pre-line">{inv.bio}</span>}</Detail>
          <Detail label="Profile visibility">{inv.visibility}</Detail>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">Verification documents</h3>
        {inv.documents.length === 0
          ? <p className="text-base text-ink-soft">No documents uploaded.</p>
          : <DocumentsManager readOnly documents={inv.documents} onChange={() => {}} hrefFor={(d) => documentHref(`${BASE}/investors/${inv._id}/documents/${d._id}/file`)} />}
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">Activity</h3>
        <dl className="grid gap-2.5">
          <Detail label="Requests sent">{inv.activity.requestsSent}</Detail>
          <Detail label="Requests received">{inv.activity.requestsReceived}</Detail>
          <Detail label="Accepted">{inv.activity.accepted}</Detail>
          <Detail label="Shortlisted">{inv.activity.shortlisted}</Detail>
          <Detail label="Messages sent">{inv.activity.messagesSent}</Detail>
          <Detail label="Open reports">{inv.activity.openReports}</Detail>
        </dl>
        {inv.recentConnections.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
            {inv.recentConnections.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-ink">{c.startup ?? 'Startup removed'} <span className="text-ink-soft">({c.initiatedBy} started)</span></span>
                <span className="text-ink-soft">{c.status} · {formatDate(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---------- connections & reports ----------

function ConnectionList() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const state = useApi(() => get(`${BASE}/connections`, { status: status || undefined, page, limit: 25 }), [status, page])
  return (
    <div className="grid gap-5">
      <div className="w-52"><Select aria-label="Status" value={status} options={[ALL, { id: 'pending', label: 'Pending' }, { id: 'accepted', label: 'Accepted' }, { id: 'declined', label: 'Declined' }, { id: 'withdrawn', label: 'Withdrawn' }]} onChange={(e) => { setStatus(e.target.value); setPage(1) }} /></div>
      <Async state={state}>{({ data, pagination }) => (
        <Card>
          {data.length === 0 ? <Empty title="No connections yet">Requests between investors and founders appear here.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-line text-xs text-ink-soft">
                  <th className="py-2 pr-4 font-medium">Investor</th><th className="py-2 pr-4 font-medium">Startup</th><th className="py-2 pr-4 font-medium">Started by</th>
                  <th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Requested</th><th className="py-2 font-medium">Last message</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4 text-ink">{c.investor?.name ?? '-'}</td>
                      <td className="py-3 pr-4 text-ink">{c.startup?.name ?? '-'}</td>
                      <td className="py-3 pr-4 text-ink-soft capitalize">{c.initiatedBy}</td>
                      <td className="py-3 pr-4"><StatusPill status={c.status} /></td>
                      <td className="py-3 pr-4 text-ink-soft">{formatDateTime(c.createdAt)}</td>
                      <td className="py-3 text-ink-soft">{c.lastMessageAt ? formatDateTime(c.lastMessageAt) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between text-sm text-ink-soft">
            <span>{pagination.total} connections</span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              Page {page} of {Math.max(pagination.totalPages, 1)}
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </span>
          </div>
        </Card>
      )}</Async>
    </div>
  )
}

function Reports({ onOpen }) {
  const toast = useToast()
  const [status, setStatus] = useState('open')
  const state = useApi(() => get(`${BASE}/reports`, { status }).then((r) => r.data), [status])
  const resolve = async (r, next) => {
    try { await patch(`${BASE}/reports/${r.id}`, { status: next }); toast(next === 'resolved' ? 'Marked resolved' : 'Report dismissed'); state.reload() } catch (err) { toast(errorMessage(err), 'error') }
  }
  return (
    <div className="grid gap-5">
      <div className="w-52"><Select aria-label="Report status" value={status} options={[{ id: 'open', label: 'Open' }, { id: 'resolved', label: 'Resolved' }, { id: 'dismissed', label: 'Dismissed' }]} onChange={(e) => setStatus(e.target.value)} /></div>
      <Async state={state}>{(list) => (list.length === 0 ? <Card><Empty title="No reports">Profiles reported by founders appear here.</Empty></Card> : (
        <div className="grid gap-4">
          {list.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">{r.investorName ?? 'Investor'}{r.organisationName && <span className="font-normal text-ink-soft"> · {r.organisationName}</span>}</p>
                  <p className="mt-1 text-base text-ink">{labelOf(REPORT_REASONS, r.reason)}</p>
                  {r.details && <p className="mt-2 max-w-2xl text-base whitespace-pre-line text-ink-soft">{r.details}</p>}
                  <p className="mt-2 text-xs text-ink-soft">Reported by {r.reportedBy?.name ?? 'a founder'} on {formatDate(r.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.investorId && <Button size="sm" variant="secondary" onClick={() => onOpen(r.investorId)}>View investor</Button>}
                  {r.status === 'open' && <><Button size="sm" onClick={() => resolve(r, 'resolved')}>Resolve</Button><Button size="sm" variant="ghost" onClick={() => resolve(r, 'dismissed')}>Dismiss</Button></>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}</Async>
    </div>
  )
}
