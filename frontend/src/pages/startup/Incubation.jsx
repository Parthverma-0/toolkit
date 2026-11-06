import { useState } from 'react'
import { Badge, Card, Empty, Progress, Stat } from '../../components/dashboard/Card.jsx'
import BarChart from '../../components/dashboard/BarChart.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import { Field, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { SECTORS, STAGES } from '../../constants/startup.js'
import { ACHIEVEMENT_TYPES } from '../../constants/enums.js'
import Async from '../../components/dashboard/Async.jsx'
import FormFields from '../../components/dashboard/FormFields.jsx'
import { ErrorText } from '../../components/ui/Field.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, fieldErrors, get, patch, post } from '../../api/client.js'
import { MONTHS, formatDate, formatINR, formatINRShort, humanize, relativeDays } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const TABS = [
  { id: 'program', label: 'My program' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'cohorts', label: 'Open cohorts' },
  { id: 'applications', label: 'Applications' },
]

export default function Incubation() {
  const [tab, setTab] = useState('program')
  return (
    <div>
      <PageHeader title="Incubation" subtitle="Your cohort, milestones, monthly metrics and applications to programs." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'program' && <Program />}
      {tab === 'metrics' && <Metrics />}
      {tab === 'achievements' && <Achievements />}
      {tab === 'cohorts' && <Cohorts />}
      {tab === 'applications' && <Applications />}
    </div>
  )
}

/* ---------- My program ---------- */
function Program() {
  // Active enrollment first; the list carries the incubator name, the detail carries milestones etc.
  const state = useApi(async () => {
    const { data: list } = await get('/startups/me/enrollments')
    const current = list.find((e) => e.status === 'active') ?? list[0]
    if (!current) return null
    const { data } = await get(`/startups/me/enrollments/${current._id}`)
    return { ...data, cohort: { ...data.cohort, incubator: current.cohort?.incubator } }
  })
  return (
    <Async state={state}>
      {(enr) => (enr
        ? <ProgramView enr={enr} setEnr={state.setData} />
        : <Card><Empty title="Not in a cohort yet">Apply to an open cohort to start your incubation.</Empty></Card>)}
    </Async>
  )
}

function ProgramView({ enr, setEnr }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const done = enr.milestones.filter((m) => m.status === 'completed').length
  const checklistDone = enr.marketingChecklist.filter((c) => c.isDone).length
  const base = `/startups/me/enrollments/${enr._id}`

  // Both endpoints return the updated item
  const replaceIn = (key, item) => setEnr((e) => ({ ...e, [key]: e[key].map((x) => (x._id === item._id ? item : x)) }))

  const markDone = async (id) => {
    setBusy(id)
    try {
      replaceIn('milestones', (await patch(`${base}/milestones/${id}`, { status: 'completed' })).data)
      toast('Milestone marked complete')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy('')
    }
  }
  const toggleItem = async (c) => {
    setBusy(c._id)
    try {
      replaceIn('marketingChecklist', (await patch(`${base}/checklist/${c._id}`, { isDone: !c.isDone })).data)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <Card title="Milestones">
        {enr.milestones.length === 0 ? <Empty>Your incubator hasn't added milestones yet.</Empty> : (
          <>
            <div className="mb-5">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-ink-soft">{done} of {enr.milestones.length} complete</span>
                <span className="font-medium text-ink">{Math.round((done / enr.milestones.length) * 100)}%</span>
              </div>
              <Progress value={done} total={enr.milestones.length} />
            </div>
            <ol className="divide-y divide-line">
              {enr.milestones.map((m, i) => {
                const overdue = m.status !== 'completed' && m.dueDate && new Date(m.dueDate) < new Date()
                return (
                  <li key={m._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold
                      ${m.status === 'completed' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft'}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${m.status === 'completed' ? 'text-ink-soft line-through' : 'text-ink'}`}>{m.title}</p>
                      {m.dueDate && (
                        <p className={`text-xs ${overdue ? 'text-red-600' : 'text-ink-soft'}`}>
                          Due {formatDate(m.dueDate)}{m.status !== 'completed' && ` · ${relativeDays(m.dueDate)}`}
                        </p>
                      )}
                    </div>
                    {m.status === 'completed' || m.status === 'missed'
                      ? <StatusPill status={m.status} />
                      : <Button size="sm" variant="secondary" disabled={busy === m._id} onClick={() => markDone(m._id)}>Mark done</Button>}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </Card>

      <div className="grid content-start gap-6">
        <Card title="Cohort">
          <p className="font-semibold text-ink">{enr.cohort.name}</p>
          <p className="text-sm text-ink-soft">{enr.cohort.incubator?.name}</p>
          <dl className="mt-4 grid gap-2">
            <Detail label="Runs">{formatDate(enr.cohort.startDate)} - {formatDate(enr.cohort.endDate)}</Detail>
            <Detail label="Mode">{enr.mode && humanize(enr.mode)}</Detail>
            <Detail label="Status"><StatusPill status={enr.status} /></Detail>
          </dl>
        </Card>

        <Card title="Agreement">
          <Badge tone={enr.agreement?.isSigned ? 'success' : 'warning'}>{enr.agreement?.isSigned ? `Signed ${formatDate(enr.agreement.signedAt)}` : 'Not signed'}</Badge>
          {enr.agreement?.equityPercent != null && <p className="mt-3 text-sm text-ink">{enr.agreement.equityPercent}% equity to the incubator</p>}
          <ul className="mt-3 grid gap-1.5 text-sm text-ink-soft">
            {(enr.agreement?.acceptedConditions ?? []).map((c) => <li key={c}>- {c}</li>)}
          </ul>
        </Card>

        <Card title={`Marketing checklist · ${checklistDone}/${enr.marketingChecklist.length}`}>
          {enr.marketingChecklist.length === 0 ? <p className="text-sm text-ink-soft">No checklist items yet.</p> : (
            <ul className="grid gap-2">
              {enr.marketingChecklist.map((c) => (
                <li key={c._id}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                    <input type="checkbox" checked={c.isDone} disabled={busy === c._id} onChange={() => toggleItem(c)} className="size-4 accent-brand" />
                    <span className={c.isDone ? 'text-ink-soft line-through' : ''}>{c.item}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------- Metrics ---------- */
const now = new Date()
const EMPTY_METRIC = { month: String(now.getMonth() + 1), year: String(now.getFullYear()), revenue: '', expenses: '', customers: '', employees: '' }

function Metrics() {
  const state = useApi(() => get('/startups/me/metrics').then((r) => r.data))
  return <Async state={state}>{(rows) => <MetricsView rows={rows} reload={state.reload} />}</Async>
}

function MetricsView({ rows, reload }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const latest = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const growth = latest && prev && prev.revenue ? Math.round(((latest.revenue - prev.revenue) / prev.revenue) * 100) : null
  const label = (r) => `${MONTHS[r.period.month - 1]} ${String(r.period.year).slice(2)}`

  const save = async () => {
    if (draft.revenue === '' || draft.expenses === '') return setError('Revenue and expenses are required')
    const month = Number(draft.month)
    const year = Number(draft.year)
    setSaving(true)
    try {
      await post('/startups/me/metrics', {
        month, year, revenue: +draft.revenue, expenses: +draft.expenses,
        customers: draft.customers === '' ? undefined : +draft.customers,
        employees: draft.employees === '' ? undefined : +draft.employees,
      })
      setDraft(null)
      setError('')
      toast(`Metrics saved for ${MONTHS[month - 1]} ${year}`)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-4">
        <Card><Stat value={formatINRShort(latest?.revenue)} label={`Revenue, ${latest ? label(latest) : '-'}`} /></Card>
        <Card><Stat value={growth == null ? '-' : `${growth > 0 ? '+' : ''}${growth}%`} label="Month-on-month revenue" /></Card>
        <Card><Stat value={latest?.customers ?? '-'} label="Paying customers" /></Card>
        <Card><Stat value={formatINRShort(latest ? latest.expenses - latest.revenue : null)} label="Monthly burn" /></Card>
      </div>

      <Card title="Monthly revenue" action={<Button size="sm" onClick={() => setDraft({ ...EMPTY_METRIC })}>Record month</Button>}>
        {rows.length === 0 ? <Empty>Record your first month to see the chart.</Empty> : <BarChart ariaLabel="Monthly revenue" data={rows.map((r) => ({ label: label(r), value: r.revenue }))} format={formatINRShort} />}
      </Card>

      <Card title="All months">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 text-right font-medium">Revenue</th>
                <th className="py-2 pr-4 text-right font-medium">Expenses</th>
                <th className="py-2 pr-4 text-right font-medium">Customers</th>
                <th className="py-2 text-right font-medium">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...rows].reverse().map((r) => (
                <tr key={r._id}>
                  <td className="py-2.5 pr-4 text-ink">{MONTHS[r.period.month - 1]} {r.period.year}</td>
                  <td className="py-2.5 pr-4 text-right text-ink tabular-nums">{formatINR(r.revenue)}</td>
                  <td className="py-2.5 pr-4 text-right text-ink tabular-nums">{formatINR(r.expenses)}</td>
                  <td className="py-2.5 pr-4 text-right text-ink tabular-nums">{r.customers}</td>
                  <td className="py-2.5 text-right text-ink tabular-nums">{r.employees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={Boolean(draft)} title="Record monthly metrics" subtitle="Your incubator sees these numbers." onClose={() => { setDraft(null); setError('') }}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}
      >
        {draft && (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month" htmlFor="mm" required>
                <Select id="mm" value={draft.month} options={MONTHS.map((m, i) => ({ id: String(i + 1), label: m }))} onChange={(e) => setDraft({ ...draft, month: e.target.value })} />
              </Field>
              <Field label="Year" htmlFor="my" required>
                <TextInput id="my" type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
              </Field>
            </div>
            <Field label="Revenue (₹)" htmlFor="mr" required>
              <TextInput id="mr" type="number" min={0} value={draft.revenue} onChange={(e) => setDraft({ ...draft, revenue: e.target.value })} />
            </Field>
            <Field label="Expenses (₹)" htmlFor="me" required>
              <TextInput id="me" type="number" min={0} value={draft.expenses} onChange={(e) => setDraft({ ...draft, expenses: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customers" htmlFor="mc" optional>
                <TextInput id="mc" type="number" min={0} value={draft.customers} onChange={(e) => setDraft({ ...draft, customers: e.target.value })} />
              </Field>
              <Field label="Team size" htmlFor="mt" optional>
                <TextInput id="mt" type="number" min={0} value={draft.employees} onChange={(e) => setDraft({ ...draft, employees: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-ink-soft">Saving a month that already exists replaces it.</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  )
}

/* ---------- Achievements ---------- */
function Achievements() {
  const state = useApi(() => get('/startups/me/achievements').then((r) => r.data))
  return <Async state={state}>{(list) => <AchievementsView list={list} reload={state.reload} />}</Async>
}

function AchievementsView({ list, reload }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!draft.title.trim() || !draft.date) return setError('Title and date are required')
    setSaving(true)
    try {
      await post('/startups/me/achievements', {
        type: draft.type, title: draft.title.trim(), date: draft.date,
        description: draft.description.trim() || undefined, proofUrl: draft.proofUrl?.trim() || undefined,
      })
      setDraft(null)
      setError('')
      toast('Achievement added. Your incubator will verify it.')
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await del(`/startups/me/achievements/${id}`)
      toast('Achievement deleted')
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <Card title="Achievements" action={<Button size="sm" onClick={() => setDraft({ type: 'award', title: '', date: '', description: '', proofUrl: '' })}>Add achievement</Button>}>
      {list.length === 0 ? <Empty>Awards, patents, launches and funding you add here appear in incubator reports.</Empty> : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{a.title}</p>
                <p className="text-xs text-ink-soft">{humanize(a.type)} · {formatDate(a.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={a.isVerified ? 'success' : 'warning'}>{a.isVerified ? 'Verified' : 'Awaiting verification'}</Badge>
                {!a.isVerified && (
                  <button type="button" onClick={() => remove(a._id)} className="text-sm font-medium text-red-600 hover:text-red-700">Delete</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={Boolean(draft)} title="Add achievement" onClose={() => setDraft(null)}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Adding...' : 'Add'}</Button></>}
      >
        {draft && (
          <div className="grid gap-5">
            <Field label="Type" htmlFor="at" required>
              <Select id="at" value={draft.type} options={ACHIEVEMENT_TYPES.map((t) => ({ id: t, label: humanize(t) }))} onChange={(e) => setDraft({ ...draft, type: e.target.value })} />
            </Field>
            <Field label="Title" htmlFor="atitle" required>
              <TextInput id="atitle" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor="adate" required>
              <TextInput id="adate" type="date" max={new Date().toISOString().slice(0, 10)} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="adesc" optional>
              <Textarea id="adesc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Proof link" htmlFor="aproof" optional hint="Press article, certificate, patent record...">
              <TextInput id="aproof" value={draft.proofUrl} placeholder="https://" onChange={(e) => setDraft({ ...draft, proofUrl: e.target.value })} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </Card>
  )
}

/* ---------- Open cohorts ---------- */
function Cohorts() {
  const toast = useToast()
  const state = useApi(() => get('/cohorts', { limit: 50 }).then((r) => r.data))
  const [selectedId, setSelectedId] = useState(null)
  const detail = useApi(() => (selectedId ? get(`/cohorts/${selectedId}`).then((r) => r.data) : Promise.resolve(null)), [selectedId])
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const [applied, setApplied] = useState([])

  const open = (id) => { setSelectedId(id); setAnswers({}); setErrors({}); setSubmitError('') }
  const close = () => setSelectedId(null)
  const selected = detail.data

  const apply = async () => {
    setSaving(true)
    setSubmitError('')
    try {
      await post(`/cohorts/${selected._id}/apply`, { responses: answers })
      setApplied((a) => [...a, selected._id])
      toast(`Applied to ${selected.name}`)
      close()
    } catch (err) {
      setErrors(fieldErrors(err))
      setSubmitError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const alreadyApplied = selected?.myApplication && selected.myApplication.status !== 'withdrawn'

  return (
    <Async state={state}>
      {(cohorts) => (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cohorts.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3"><Empty title="No open cohorts right now">Check back soon - incubators open new cohorts through the year.</Empty></Card>
          )}
          {cohorts.map((c) => (
            <Card key={c._id} className="flex flex-col">
              <p className="text-xs font-medium text-ink-soft">{c.incubator?.name}</p>
              <p className="mt-1 text-lg font-semibold text-ink">{c.name}</p>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{c.objective}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(c.targetStartups?.sectors?.length ? c.targetStartups.sectors : ['all sectors']).map((s) => <Badge key={s}>{labelOf(SECTORS, s)}</Badge>)}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs text-ink-soft">
                  {c.registrationForm?.closesAt ? `Closes ${formatDate(c.registrationForm.closesAt)} · ${relativeDays(c.registrationForm.closesAt)}` : 'Open'}
                </span>
                {applied.includes(c._id)
                  ? <StatusPill status="submitted" label="Applied" />
                  : <Button size="sm" onClick={() => open(c._id)}>View & apply</Button>}
              </div>
            </Card>
          ))}

          <Drawer
            open={Boolean(selectedId)} title={selected?.name ?? 'Loading...'} subtitle={selected?.incubator?.name} onClose={close}
            footer={(
              <>
                {submitError && <ErrorText>{submitError}</ErrorText>}
                <Button variant="ghost" onClick={close}>Cancel</Button>
                {selected && !alreadyApplied && (
                  <Button onClick={apply} disabled={saving || !selected.isRegistrationOpen}>{saving ? 'Submitting...' : 'Submit application'}</Button>
                )}
              </>
            )}
          >
            {!selected ? <Async state={detail}>{() => null}</Async> : (
              <div className="grid gap-5">
                <p className="text-sm text-ink">{selected.objective}</p>
                <dl className="grid gap-2">
                  <Detail label="Runs">{formatDate(selected.startDate)} - {formatDate(selected.endDate)}</Detail>
                  <Detail label="Seats">{selected.targetStartups?.count && `${selected.targetStartups.count} startups`}</Detail>
                  <Detail label="Sectors">{(selected.targetStartups?.sectors ?? []).map((s) => labelOf(SECTORS, s)).join(', ') || 'All sectors'}</Detail>
                  <Detail label="Stages">{(selected.targetStartups?.stages ?? []).map((s) => labelOf(STAGES, s)).join(', ') || 'All stages'}</Detail>
                  <Detail label="Applications close">{selected.registrationForm?.closesAt && formatDate(selected.registrationForm.closesAt)}</Detail>
                  {selected.eligibilityCriteria?.length > 0 && <Detail label="Eligibility">{selected.eligibilityCriteria.map((e) => e.criterion).join('; ')}</Detail>}
                </dl>
                {alreadyApplied ? (
                  <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-ink">
                    You applied on {formatDate(selected.myApplication.createdAt)}. Status: <StatusPill status={selected.myApplication.status} />
                  </p>
                ) : !selected.isRegistrationOpen ? (
                  <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Registration for this cohort is closed.</p>
                ) : (
                  <div className="grid gap-5 border-t border-line pt-5">
                    <p className="text-sm text-ink-soft">Your startup profile is attached automatically.</p>
                    <FormFields fields={selected.registrationForm?.fields} value={answers} onChange={setAnswers} errors={errors} />
                  </div>
                )}
              </div>
            )}
          </Drawer>
        </div>
      )}
    </Async>
  )
}

/* ---------- Applications ---------- */
function Applications() {
  const toast = useToast()
  const state = useApi(() => get('/startups/me/applications').then((r) => r.data))
  const withdraw = async (id) => {
    try {
      await post(`/startups/me/applications/${id}/withdraw`)
      toast('Application withdrawn')
      state.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  return (
    <Card title="My applications">
      <Async state={state}>
        {(list) => (list.length === 0 ? <Empty>You haven't applied to any cohort yet.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{a.cohort?.name}</p>
                  <p className="text-xs text-ink-soft">{a.cohort?.incubator?.name} · applied {formatDate(a.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={a.status} />
                  {['submitted', 'under_review', 'shortlisted'].includes(a.status) && (
                    <Button size="sm" variant="ghost" onClick={() => withdraw(a._id)}>Withdraw</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Async>
    </Card>
  )
}
