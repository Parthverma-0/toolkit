import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Card, Empty, Progress, Stat } from '../../components/dashboard/Card.jsx'
import BarChart from '../../components/dashboard/BarChart.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, SearchInput, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, Pills, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { SECTORS, STAGES } from '../../constants/startup.js'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import { errorMessage, fileUrl, get, patch, post, toFormData } from '../../api/client.js'
import { MONTHS, formatDate, formatINR, formatINRShort, humanize, relativeDays } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const STATUS = [{ id: 'all', label: 'All' }, ...['active', 'graduated', 'exited', 'dropped'].map((s) => ({ id: s, label: humanize(s) }))]
const SECTOR_FILTER = [{ id: 'all', label: 'All sectors' }, ...SECTORS]
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function Startups() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [sector, setSector] = useState('all')
  const q = useDebounced(query.trim(), 300)
  const state = useApi(() => get('/incubators/me/startups', {
    limit: 100, q: q || undefined, status: status === 'all' ? undefined : status, sector: sector === 'all' ? undefined : sector,
  }).then((r) => ({ items: r.data, total: r.pagination?.total ?? r.data.length })), [q, status, sector])

  const exportCsv = () => {
    const header = ['Name', 'Sector', 'Stage', 'Cohort', 'Status', 'Onboarded', 'IC funding distributed', 'External funding', 'Achievements']
    const rows = (state.data?.items ?? []).map((r) => [
      r.startup?.name, labelOf(SECTORS, r.startup?.sector), labelOf(STAGES, r.startup?.stage), r.cohort?.name, r.latestEnrollment?.status,
      formatDate(r.firstOnboardedAt), r.funding?.ic_fund_distributed ?? 0, r.funding?.external_funding ?? 0, r.achievements,
    ].map(csvCell).join(','))
    const url = URL.createObjectURL(new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'startups.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Startups" subtitle="Every startup you have onboarded, across cohorts." action={<Button variant="secondary" disabled={!state.data?.items.length} onClick={exportCsv}>Export CSV</Button>} />
      <div className="mb-5 grid gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search startups" />
        <Chips options={STATUS} value={status} onChange={setStatus} />
        <Chips options={SECTOR_FILTER} value={sector} onChange={setSector} />
      </div>
      <Card>
        <Async state={state}>
          {({ items }) => (items.length === 0 ? <Empty>No startups match these filters. Startups appear here once you enroll them in a cohort.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="py-2 pr-4 font-medium">Startup</th>
                    <th className="py-2 pr-4 font-medium">Cohort</th>
                    <th className="py-2 pr-4 font-medium">Onboarded</th>
                    <th className="py-2 pr-4 text-right font-medium">IC funding</th>
                    <th className="py-2 pr-4 text-right font-medium">Achievements</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((r) => (
                    <tr key={r.startup?._id} className="hover:bg-brand-soft/60">
                      <td className="py-3 pr-4">
                        <Link to={`/incubator/startups/${r.startup?._id}`} className="font-medium text-ink hover:text-brand">{r.startup?.name}</Link>
                        <span className="block text-xs text-ink-soft">{labelOf(SECTORS, r.startup?.sector)} · {labelOf(STAGES, r.startup?.stage)}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{r.cohort?.name}{r.cohortCount > 1 && ` +${r.cohortCount - 1}`}</td>
                      <td className="py-3 pr-4 text-ink-soft">{formatDate(r.firstOnboardedAt)}</td>
                      <td className="py-3 pr-4 text-right text-ink tabular-nums">{formatINRShort(r.funding?.ic_fund_distributed ?? 0)}</td>
                      <td className="py-3 pr-4 text-right text-ink tabular-nums">{r.achievements}</td>
                      <td className="py-3"><StatusPill status={r.latestEnrollment?.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Async>
      </Card>
      {state.data && <p className="mt-3 text-xs text-ink-soft">{state.data.items.length} of {state.data.total} startups</p>}
    </div>
  )
}

/* ---------- Startup detail ---------- */
const EXIT_TYPES = [{ id: 'graduation', label: 'Graduation' }, { id: 'voluntary', label: 'Voluntary' }, { id: 'termination', label: 'Termination' }]

export function StartupDetail() {
  const { id } = useParams()
  const state = useApi(() => get(`/incubators/me/startups/${id}`).then((r) => r.data), [id])
  return (
    <div>
      <Link to="/incubator/startups" className="text-sm font-medium text-brand hover:text-brand-dark">Back to startups</Link>
      <div className="mt-4">
        <Async state={state}>{(data) => <StartupView data={data} reload={state.reload} />}</Async>
      </div>
    </div>
  )
}

function StartupView({ data, reload }) {
  const toast = useToast()
  const { startup, founders, enrollments, funding, achievements, metrics } = data
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?._id)
  const enr = enrollments.find((e) => e._id === enrollmentId) ?? enrollments[0]
  const [tab, setTab] = useState('milestones')
  const [newMilestone, setNewMilestone] = useState(null)
  const [exit, setExit] = useState(null)
  const [agreement, setAgreement] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const base = `/incubators/me/enrollments/${enr._id}`
  const milestones = enr.milestones ?? []
  const done = milestones.filter((m) => m.status === 'completed').length
  const months = [...metrics].reverse() // oldest first for the chart
  const latest = metrics[0]

  const run = async (fn, message, close) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      toast(message)
      close?.()
      reload()
    } catch (err) {
      setError(errorMessage(err))
      if (!close) toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const addMilestone = () => run(
    () => post(`${base}/milestones`, { title: newMilestone.title.trim(), dueDate: newMilestone.dueDate || undefined }),
    'Milestone added', () => setNewMilestone(null),
  )
  const setMilestone = (m, status) => run(() => patch(`${base}/milestones/${m._id}`, { status }), status === 'completed' ? 'Milestone verified' : `Milestone marked ${humanize(status).toLowerCase()}`)
  const toggleChecklist = (c) => run(() => patch(`${base}/checklist/${c._id}`, { isDone: !c.isDone }), c.isDone ? 'Marked not done' : 'Marked done')
  const confirmExit = () => run(
    () => post(`${base}/exit`, { type: exit.type, date: exit.date, remarks: exit.remarks.trim() || undefined }),
    `${startup.name} marked ${exit.type === 'graduation' ? 'graduated' : 'exited'}`, () => setExit(null),
  )
  const signAgreement = () => run(
    () => post(`${base}/agreement`, toFormData({
      signedAgreement: agreement.file, equityPercent: agreement.equityPercent,
      acceptedConditions: agreement.conditions.split('\n').map((c) => c.trim()).filter(Boolean),
    })),
    'Agreement recorded', () => setAgreement(null),
  )

  return (
    <div>
      <PageHeader title={startup.name} subtitle={`${labelOf(SECTORS, startup.sector)} · ${labelOf(STAGES, startup.stage)} · ${enr.cohort?.name ?? ''}`}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {enrollments.length > 1 && (
              <select aria-label="Enrollment" value={enr._id} onChange={(e) => setEnrollmentId(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
                {enrollments.map((e) => <option key={e._id} value={e._id}>{e.cohort?.name}</option>)}
              </select>
            )}
            <StatusPill status={enr.status} />
            {enr.status === 'active' && <Button size="sm" variant="secondary" onClick={() => { setExit({ type: 'graduation', date: '', remarks: '' }); setError('') }}>Record exit</Button>}
          </div>
        )} />

      <div className="mb-6 grid gap-6 sm:grid-cols-4">
        <Card><Stat value={`${done}/${milestones.length}`} label="Milestones done" /></Card>
        <Card><Stat value={formatINRShort(latest?.revenue)} label={latest ? `Revenue, ${MONTHS[latest.period.month - 1]} ${latest.period.year}` : 'Latest revenue'} /></Card>
        <Card><Stat value={formatINRShort(funding.reduce((s, f) => s + (f.amount || 0), 0))} label="Funding recorded" /></Card>
        <Card><Stat value={formatDate(enr.onboardedAt)} label="Onboarded" /></Card>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'milestones', label: 'Milestones' }, { id: 'program', label: 'Agreement & checklist' }, { id: 'metrics', label: 'Metrics' },
        { id: 'funding', label: 'Funding', count: funding.length }, { id: 'achievements', label: 'Achievements', count: achievements.length }, { id: 'team', label: 'Founders' },
      ]} />

      {tab === 'milestones' && (
        <Card title="Milestones" action={enr.status === 'active' && <Button size="sm" onClick={() => { setNewMilestone({ title: '', dueDate: '' }); setError('') }}>Add milestone</Button>}>
          {milestones.length === 0 ? <Empty>No milestones yet.</Empty> : (
            <>
              <div className="mb-4"><Progress value={done} total={milestones.length} /></div>
              <ul className="divide-y divide-line">
                {milestones.map((m) => (
                  <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{m.title}</p>
                      <p className="text-xs text-ink-soft">
                        {m.dueDate ? `Due ${formatDate(m.dueDate)}${m.status !== 'completed' ? ` · ${relativeDays(m.dueDate)}` : ''}` : 'No due date'}
                        {m.evidenceUrl && <> · <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Evidence</a></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={m.status} />
                      {!['completed', 'missed'].includes(m.status) && (
                        <>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMilestone(m, 'missed')}>Missed</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMilestone(m, 'completed')}>Verify done</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {tab === 'program' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Agreement" action={!enr.agreement?.isSigned && <Button size="sm" onClick={() => { setAgreement({ file: null, equityPercent: '', conditions: '' }); setError('') }}>Record signed agreement</Button>}>
            <Badge tone={enr.agreement?.isSigned ? 'success' : 'warning'}>{enr.agreement?.isSigned ? `Signed ${formatDate(enr.agreement.signedAt)}` : 'Not signed'}</Badge>
            <dl className="mt-4 grid gap-2">
              {enr.agreement?.equityPercent != null && <Detail label="Equity">{enr.agreement.equityPercent}%</Detail>}
              {enr.agreement?.documentUrl && <Detail label="Document"><a href={fileUrl(enr.agreement.documentUrl)} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open PDF</a></Detail>}
              {enr.agreement?.acceptedConditions?.length > 0 && <Detail label="Conditions">{enr.agreement.acceptedConditions.join('; ')}</Detail>}
            </dl>
          </Card>
          <Card title="Marketing checklist">
            {(enr.marketingChecklist ?? []).length === 0 ? <p className="text-sm text-ink-soft">No checklist items for this cohort.</p> : (
              <ul className="grid gap-2">
                {enr.marketingChecklist.map((c) => (
                  <li key={c._id}>
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                      <input type="checkbox" checked={c.isDone} disabled={busy} onChange={() => toggleChecklist(c)} className="size-4 accent-brand" />
                      <span className={c.isDone ? 'text-ink-soft line-through' : ''}>{c.item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'metrics' && (
        metrics.length === 0 ? <Card><Empty>The startup has not recorded any monthly metrics yet.</Empty></Card> : (
          <div className="grid gap-6">
            <Card title="Monthly revenue">
              <BarChart ariaLabel="Monthly revenue" format={formatINRShort}
                data={months.map((r) => ({ label: `${MONTHS[r.period.month - 1]} ${String(r.period.year).slice(2)}`, value: r.revenue }))} />
            </Card>
            <Card title="All months">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-ink-soft"><th className="py-2 font-medium">Month</th><th className="py-2 text-right font-medium">Revenue</th><th className="py-2 text-right font-medium">Expenses</th><th className="py-2 text-right font-medium">Customers</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {metrics.map((r) => (
                    <tr key={`${r.period.year}${r.period.month}`}>
                      <td className="py-2.5 text-ink">{MONTHS[r.period.month - 1]} {r.period.year}</td>
                      <td className="py-2.5 text-right text-ink tabular-nums">{formatINR(r.revenue)}</td>
                      <td className="py-2.5 text-right text-ink tabular-nums">{formatINR(r.expenses)}</td>
                      <td className="py-2.5 text-right text-ink tabular-nums">{r.customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )
      )}

      {tab === 'funding' && (
        <Card title="Funding" to="/incubator/funding" linkLabel="Open ledger">
          {funding.length === 0 ? <Empty>No funding recorded for this startup.</Empty> : (
            <ul className="divide-y divide-line">
              {funding.map((f) => (
                <li key={f._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{humanize(f.type)}{f.instrument && ` · ${humanize(f.instrument)}`}</p>
                    <p className="text-xs text-ink-soft">{f.source || 'From your IC fund'} · {formatDate(f.date)}</p>
                  </div>
                  <span className="font-semibold text-ink tabular-nums">{formatINR(f.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'achievements' && (
        <Card title="Achievements" to="/incubator/achievements" linkLabel="Verify">
          {achievements.length === 0 ? <Empty>No achievements reported yet.</Empty> : (
            <ul className="divide-y divide-line">
              {achievements.map((a) => (
                <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-medium text-ink">{a.title}</p><p className="text-xs text-ink-soft">{humanize(a.type)} · {formatDate(a.date)}</p></div>
                  <Badge tone={a.isVerified ? 'success' : 'warning'}>{a.isVerified ? 'Verified' : 'Awaiting verification'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'team' && (
        <Card title="Founders">
          <ul className="divide-y divide-line">
            {founders.map((f) => (
              <li key={f._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="text-sm font-medium text-ink">{f.fullName}</p><p className="text-xs text-ink-soft">{f.designation} · {f.email}</p></div>
                {f.isPrimary && <Badge tone="brand">Primary</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Drawer open={Boolean(newMilestone)} title="Add milestone" onClose={() => setNewMilestone(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setNewMilestone(null)}>Cancel</Button><Button disabled={busy || !newMilestone?.title.trim()} onClick={addMilestone}>Add</Button></>}>
        {newMilestone && (
          <div className="grid gap-5">
            <Field label="Title" htmlFor="nmt" required><TextInput id="nmt" maxLength={200} value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })} /></Field>
            <Field label="Due date" htmlFor="nmd" optional><TextInput id="nmd" type="date" value={newMilestone.dueDate} onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(agreement)} title="Record signed agreement" subtitle="Upload the countersigned PDF." onClose={() => setAgreement(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setAgreement(null)}>Cancel</Button><Button disabled={busy || !agreement?.file} onClick={signAgreement}>Save</Button></>}>
        {agreement && (
          <div className="grid gap-5">
            <Field label="Signed agreement (PDF)" htmlFor="agf" required>
              <input id="agf" type="file" accept="application/pdf" onChange={(e) => setAgreement({ ...agreement, file: e.target.files?.[0] || null })}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink" />
            </Field>
            <Field label="Equity to the incubator (%)" htmlFor="age" optional>
              <TextInput id="age" type="number" min={0} max={100} value={agreement.equityPercent} onChange={(e) => setAgreement({ ...agreement, equityPercent: e.target.value })} />
            </Field>
            <Field label="Accepted conditions" htmlFor="agc" optional hint="One per line">
              <Textarea id="agc" rows={3} value={agreement.conditions} onChange={(e) => setAgreement({ ...agreement, conditions: e.target.value })} />
            </Field>
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(exit)} title={`Record exit for ${startup.name}`} subtitle="This ends their active enrollment." onClose={() => setExit(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setExit(null)}>Cancel</Button><Button variant={exit?.type === 'termination' ? 'danger' : 'primary'} disabled={busy || !exit?.date} onClick={confirmExit}>Confirm exit</Button></>}>
        {exit && (
          <div className="grid gap-5">
            <Field label="Exit type" required><Pills label="Exit type" options={EXIT_TYPES} value={exit.type} onChange={(type) => setExit({ ...exit, type })} /></Field>
            <Field label="Exit date" htmlFor="exd" required><TextInput id="exd" type="date" value={exit.date} onChange={(e) => setExit({ ...exit, date: e.target.value })} /></Field>
            <Field label="Remarks" htmlFor="exr" optional><Textarea id="exr" rows={3} maxLength={2000} value={exit.remarks} onChange={(e) => setExit({ ...exit, remarks: e.target.value })} /></Field>
            <dl><Detail label="Milestones">{done} of {milestones.length} completed</Detail></dl>
          </div>
        )}
      </Drawer>
    </div>
  )
}
