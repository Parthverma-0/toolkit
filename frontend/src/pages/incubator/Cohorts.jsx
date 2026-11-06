import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import MultiToggle from '../../components/dashboard/MultiToggle.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { SECTORS, STAGES } from '../../constants/startup.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch, post } from '../../api/client.js'
import { formatDate, humanize, relativeDays } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const FILTERS = [{ id: 'all', label: 'All' }, ...['registration_open', 'ongoing', 'draft', 'completed', 'cancelled'].map((s) => ({ id: s, label: humanize(s) }))]
// Allowed status moves for a cohort (mirrors backend)
const NEXT_STATUS = { draft: ['registration_open', 'cancelled'], registration_open: ['ongoing', 'cancelled'], ongoing: ['completed'] }
const QUESTION_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'date', 'url', 'select', 'multiselect', 'checkbox']
  .map((t) => ({ id: t, label: humanize(t) }))
const sumCounts = (obj = {}) => Object.values(obj).reduce((a, b) => a + b, 0)
const dateOnly = (iso) => (iso ? iso.slice(0, 10) : '')
const keyFrom = (label, i) => `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'q_$1').slice(0, 40) || 'question'}_${i + 1}`

const EMPTY = {
  name: '', objective: '', startDate: '', endDate: '', opensAt: '', closesAt: '', count: '', sectors: [], stages: [],
  milestones: '', checklist: '', eligibility: '', questions: [],
}

// Cohort document -> drawer form values
const toForm = (c) => ({
  _id: c._id, name: c.name, objective: c.objective ?? '', startDate: dateOnly(c.startDate), endDate: dateOnly(c.endDate),
  opensAt: dateOnly(c.registrationForm?.opensAt), closesAt: dateOnly(c.registrationForm?.closesAt),
  count: c.targetStartups?.count ?? '', sectors: c.targetStartups?.sectors ?? [], stages: c.targetStartups?.stages ?? [],
  milestones: (c.milestoneChecklist ?? []).map((m) => m.title).join('\n'),
  checklist: (c.marketing?.checklist ?? []).map((m) => m.item).join('\n'),
  eligibility: (c.eligibilityCriteria ?? []).map((e) => e.criterion).join('\n'),
  questions: (c.registrationForm?.fields ?? []).map((f) => ({ ...f, options: (f.options ?? []).join(', ') })),
})

const lines = (text) => text.split('\n').map((t) => t.trim()).filter(Boolean)

// Drawer form values -> POST / PATCH body
const toBody = (d) => ({
  name: d.name.trim(), objective: d.objective.trim(), startDate: d.startDate, endDate: d.endDate,
  targetStartups: { count: d.count === '' ? undefined : Number(d.count), sectors: d.sectors, stages: d.stages },
  registrationForm: {
    opensAt: d.opensAt || null, closesAt: d.closesAt || null,
    fields: d.questions.filter((q) => q.label.trim()).map((q, i) => ({
      key: q.key || keyFrom(q.label, i), label: q.label.trim(), type: q.type, required: Boolean(q.required), order: i,
      options: ['select', 'multiselect'].includes(q.type) ? q.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
    })),
  },
  milestoneChecklist: lines(d.milestones).map((title) => ({ title })),
  marketing: { checklist: lines(d.checklist).map((item) => ({ item })) },
  eligibilityCriteria: lines(d.eligibility).map((criterion) => ({ criterion })),
})

function CohortForm({ draft, setDraft, onSaved, onClose }) {
  const toast = useToast()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (patchValues) => setDraft((d) => ({ ...d, ...patchValues }))
  const setQuestion = (i, patchValues) => set({ questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patchValues } : q)) })

  const save = async () => {
    if (!draft.name.trim() || !draft.objective.trim() || !draft.startDate || !draft.endDate) return setError('Name, objective and dates are required')
    if (draft.endDate <= draft.startDate) return setError('End date must be after start date')
    if (draft.questions.some((q) => ['select', 'multiselect'].includes(q.type) && !q.options.trim())) return setError('Add options for every choice question')
    setSaving(true)
    setError('')
    try {
      const res = draft._id
        ? await patch(`/incubators/me/cohorts/${draft._id}`, toBody(draft))
        : await post('/incubators/me/cohorts', toBody(draft))
      toast(draft._id ? 'Cohort updated' : 'Cohort created as a draft')
      onSaved(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={Boolean(draft)} title={draft?._id ? 'Edit cohort' : 'New cohort'} subtitle={draft?._id ? undefined : 'Saved as a draft. Open registrations when you are ready.'} onClose={onClose}
      footer={(
        <>
          {error && <ErrorText>{error}</ErrorText>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : draft?._id ? 'Save changes' : 'Create cohort'}</Button>
        </>
      )}>
      {draft && (
        <div className="grid gap-5">
          <Field label="Cohort name" htmlFor="cname" required>
            <TextInput id="cname" value={draft.name} maxLength={150} placeholder="Spring 2027 Cohort" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Objective" htmlFor="cobj" required>
            <Textarea id="cobj" rows={3} maxLength={5000} value={draft.objective} onChange={(e) => set({ objective: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" htmlFor="cstart" required>
              <TextInput id="cstart" type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <Field label="Ends" htmlFor="cend" required>
              <TextInput id="cend" type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
            </Field>
            <Field label="Applications open" htmlFor="copen" optional>
              <TextInput id="copen" type="date" value={draft.opensAt} onChange={(e) => set({ opensAt: e.target.value })} />
            </Field>
            <Field label="Applications close" htmlFor="cclose" optional>
              <TextInput id="cclose" type="date" value={draft.closesAt} onChange={(e) => set({ closesAt: e.target.value })} />
            </Field>
            <Field label="Seats" htmlFor="cseats" optional>
              <TextInput id="cseats" type="number" min={1} value={draft.count} onChange={(e) => set({ count: e.target.value })} />
            </Field>
          </div>
          <Field label="Target sectors" optional hint="Leave empty to accept all sectors">
            <MultiToggle label="Sectors" options={SECTORS} value={draft.sectors} onChange={(sectors) => set({ sectors })} />
          </Field>
          <Field label="Target stages" optional>
            <MultiToggle label="Stages" options={STAGES} value={draft.stages} onChange={(stages) => set({ stages })} />
          </Field>
          <Field label="Eligibility criteria" htmlFor="celig" optional hint="One per line. Reviewers check these by hand.">
            <Textarea id="celig" rows={3} value={draft.eligibility} onChange={(e) => set({ eligibility: e.target.value })} />
          </Field>

          <div className="grid gap-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-ink">Application questions</p>
              <Button size="sm" variant="secondary" onClick={() => set({ questions: [...draft.questions, { label: '', type: 'text', required: false, options: '' }] })}>Add question</Button>
            </div>
            {draft.questions.length === 0 && <p className="text-sm text-ink-soft">Startups' profiles are attached automatically. Add questions for anything else you need.</p>}
            {draft.questions.map((q, i) => (
              <div key={q.key || i} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_150px]">
                <TextInput aria-label={`Question ${i + 1}`} value={q.label} placeholder="What traction do you have?" onChange={(e) => setQuestion(i, { label: e.target.value })} />
                <Select aria-label={`Question ${i + 1} type`} value={q.type} options={QUESTION_TYPES} onChange={(e) => setQuestion(i, { type: e.target.value })} />
                {['select', 'multiselect'].includes(q.type) && (
                  <TextInput aria-label={`Question ${i + 1} options`} className="sm:col-span-2" value={q.options} placeholder="Options, comma separated" onChange={(e) => setQuestion(i, { options: e.target.value })} />
                )}
                <div className="flex items-center justify-between sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={Boolean(q.required)} onChange={(e) => setQuestion(i, { required: e.target.checked })} className="size-4 accent-brand" />
                    Required
                  </label>
                  <button type="button" onClick={() => set({ questions: draft.questions.filter((_, j) => j !== i) })} className="text-sm font-medium text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>

          <Field label="Milestone checklist" htmlFor="cms" optional hint="One milestone per line. Every enrolled startup gets these.">
            <Textarea id="cms" rows={4} value={draft.milestones} onChange={(e) => set({ milestones: e.target.value })} />
          </Field>
          <Field label="Marketing checklist" htmlFor="cmk" optional hint="One item per line, e.g. Announce on LinkedIn">
            <Textarea id="cmk" rows={3} value={draft.checklist} onChange={(e) => set({ checklist: e.target.value })} />
          </Field>
        </div>
      )}
    </Drawer>
  )
}

export default function Cohorts() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const state = useApi(() => get('/incubators/me/cohorts', { status: filter === 'all' ? undefined : filter }).then((r) => r.data), [filter])
  const [draft, setDraft] = useState(null)

  return (
    <div>
      <PageHeader title="Cohorts" subtitle="Create programs, open registrations and review applications."
        action={<Button onClick={() => setDraft({ ...EMPTY })}>New cohort</Button>} />
      <div className="mb-5"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>

      <Async state={state}>
        {(shown) => (shown.length === 0 ? <Card><Empty>No cohorts with this status.</Empty></Card> : (
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((c) => (
              <Link key={c._id} to={`/incubator/cohorts/${c._id}`}
                className="flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:shadow-[0_18px_50px_-30px_rgba(30,64,175,0.5)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg font-semibold text-ink">{c.name}</p>
                  <StatusPill status={c.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                  <div><p className="font-semibold text-ink">{formatDate(c.startDate)}</p><p className="text-xs text-ink-soft">Starts</p></div>
                  <div><p className="font-semibold text-ink">{formatDate(c.endDate)}</p><p className="text-xs text-ink-soft">Ends</p></div>
                  <div><p className="font-semibold text-ink">{c.targetStartups?.count ?? '-'}</p><p className="text-xs text-ink-soft">Seats</p></div>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </Async>

      <CohortForm draft={draft} setDraft={setDraft} onClose={() => setDraft(null)}
        onSaved={(c) => { setDraft(null); navigate(`/incubator/cohorts/${c._id}`) }} />
    </div>
  )
}

/* ---------- Cohort detail: overview + applications review ---------- */
export function CohortDetail() {
  const { id } = useParams()
  const state = useApi(() => get(`/incubators/me/cohorts/${id}`).then((r) => r.data), [id])
  return (
    <div>
      <Link to="/incubator/cohorts" className="text-sm font-medium text-brand hover:text-brand-dark">Back to cohorts</Link>
      <div className="mt-4">
        <Async state={state}>{(cohort) => <CohortView cohort={cohort} reload={state.reload} />}</Async>
      </div>
    </div>
  )
}

function CohortView({ cohort, reload }) {
  const toast = useToast()
  const navigate = useNavigate()
  const apps = useApi(() => get(`/incubators/me/cohorts/${cohort._id}/applications`).then((r) => r.data), [cohort._id])
  const [tab, setTab] = useState('applications')
  const [appFilter, setAppFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const detail = useApi(() => (selectedId ? get(`/incubators/me/applications/${selectedId}`).then((r) => r.data) : Promise.resolve(null)), [selectedId])
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const setStatus = async (status) => {
    try {
      await patch(`/incubators/me/cohorts/${cohort._id}/status`, { status })
      toast(`Cohort moved to ${humanize(status).toLowerCase()}`)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  const removeCohort = async () => {
    try {
      await del(`/incubators/me/cohorts/${cohort._id}`)
      toast('Cohort deleted')
      navigate('/incubator/cohorts', { replace: true })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  // Shortlist / reject go through review; accepting enrolls the startup into the cohort
  const decide = async (status) => {
    const app = detail.data
    setBusy(true)
    setError('')
    try {
      if (status === 'accepted') await post(`/incubators/me/cohorts/${cohort._id}/enrollments`, { applicationId: app._id })
      else await patch(`/incubators/me/applications/${app._id}/review`, { status, remarks: remarks.trim() || undefined })
      toast(`${app.startup?.name} ${status === 'accepted' ? 'accepted and enrolled' : humanize(status).toLowerCase()}`)
      setSelectedId(null)
      apps.reload()
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const list = apps.data ?? []
  const counts = list.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {})
  const shownApps = list.filter((a) => appFilter === 'all' || a.status === appFilter)
  const APP_FILTERS = [{ id: 'all', label: `All ${list.length}` }, ...['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn']
    .filter((s) => counts[s]).map((s) => ({ id: s, label: `${humanize(s)} ${counts[s]}` }))]
  const enrolled = sumCounts(cohort.stats?.enrollments)
  const fields = cohort.registrationForm?.fields ?? []
  const selected = detail.data
  const answerOf = (key) => {
    const v = selected?.responses?.find((r) => r.key === key)?.value
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return v == null ? '' : String(v)
  }

  return (
    <div>
      <PageHeader title={cohort.name} subtitle={cohort.objective} action={(
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={cohort.status} />
          {cohort.status === 'draft' && <Button size="sm" variant="ghost" onClick={removeCohort}>Delete</Button>}
          {!['completed', 'cancelled'].includes(cohort.status) && <Button size="sm" variant="secondary" onClick={() => setEditing(toForm(cohort))}>Edit</Button>}
          {(NEXT_STATUS[cohort.status] || []).map((s) => (
            <Button key={s} size="sm" variant={s === 'cancelled' ? 'danger' : 'secondary'} onClick={() => setStatus(s)}>
              {s === 'registration_open' ? 'Open registrations' : s === 'ongoing' ? 'Start cohort' : s === 'completed' ? 'Mark completed' : 'Cancel cohort'}
            </Button>
          ))}
        </div>
      )} />

      <div className="mb-6 grid gap-6 sm:grid-cols-4">
        <Card><Stat value={sumCounts(cohort.stats?.applications)} label="Applications" /></Card>
        <Card><Stat value={cohort.stats?.applications?.shortlisted || 0} label="Shortlisted" /></Card>
        <Card><Stat value={`${enrolled}${cohort.targetStartups?.count ? `/${cohort.targetStartups.count}` : ''}`} label="Enrolled" /></Card>
        <Card><Stat value={cohort.registrationForm?.closesAt ? relativeDays(cohort.registrationForm.closesAt) : '-'} label="Applications close" /></Card>
      </div>

      <Tabs tabs={[{ id: 'applications', label: 'Applications', count: list.length }, { id: 'overview', label: 'Overview' }]} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Program">
            <dl className="grid gap-2">
              <Detail label="Runs">{formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}</Detail>
              <Detail label="Seats">{cohort.targetStartups?.count}</Detail>
              <Detail label="Sectors">{(cohort.targetStartups?.sectors ?? []).map((s) => labelOf(SECTORS, s)).join(', ') || 'All sectors'}</Detail>
              <Detail label="Stages">{(cohort.targetStartups?.stages ?? []).map((s) => labelOf(STAGES, s)).join(', ') || 'All stages'}</Detail>
              <Detail label="Registrations">{cohort.isRegistrationOpen ? 'Open' : 'Closed'}</Detail>
              <Detail label="Questions">{fields.length ? fields.map((f) => f.label).join('; ') : 'Profile only'}</Detail>
            </dl>
          </Card>
          <Card title="Milestone checklist">
            {cohort.milestoneChecklist?.length ? (
              <ol className="grid gap-2">
                {cohort.milestoneChecklist.map((m, i) => (
                  <li key={m._id ?? m.title} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink">{i + 1}. {m.title}</span>
                    {m.dueInWeeks && <span className="text-ink-soft">Week {m.dueInWeeks}</span>}
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-soft">No milestones defined yet.</p>}
          </Card>
        </div>
      ) : (
        <>
          {list.length > 0 && <div className="mb-5"><Chips options={APP_FILTERS} value={appFilter} onChange={setAppFilter} /></div>}
          <Card>
            <Async state={apps}>
              {() => (list.length === 0 ? <Empty>No applications for this cohort yet.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-ink-soft">
                        <th className="py-2 pr-4 font-medium">Startup</th>
                        <th className="py-2 pr-4 font-medium">Sector · stage</th>
                        <th className="py-2 pr-4 font-medium">Eligibility</th>
                        <th className="py-2 pr-4 font-medium">Applied</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {shownApps.map((a) => (
                        <tr key={a._id} onClick={() => { setSelectedId(a._id); setRemarks(a.remarks || ''); setError('') }} className="cursor-pointer hover:bg-brand-soft/60">
                          <td className="py-3 pr-4 font-medium text-ink">{a.startup?.name}<span className="block text-xs font-normal text-ink-soft">{a.startup?.tagline}</span></td>
                          <td className="py-3 pr-4 text-ink-soft">{labelOf(SECTORS, a.startup?.sector)} · {labelOf(STAGES, a.startup?.stage)}</td>
                          <td className="py-3 pr-4"><Badge tone={a.eligibility?.isEligible ? 'success' : 'warning'}>{a.eligibility?.isEligible ? 'Eligible' : 'Check criteria'}</Badge></td>
                          <td className="py-3 pr-4 text-ink-soft">{formatDate(a.createdAt)}</td>
                          <td className="py-3"><StatusPill status={a.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </Async>
          </Card>
        </>
      )}

      <Drawer open={Boolean(selectedId)} title={selected?.startup?.name ?? 'Loading...'}
        subtitle={selected?.startup && `${labelOf(SECTORS, selected.startup.sector)} · ${labelOf(STAGES, selected.startup.stage)}`}
        onClose={() => setSelectedId(null)}
        footer={selected && !['accepted', 'rejected', 'withdrawn'].includes(selected.status) && (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => decide('rejected')}>Reject</Button>
            {selected.status === 'submitted' && <Button variant="ghost" disabled={busy} onClick={() => decide('under_review')}>Mark in review</Button>}
            {selected.status !== 'shortlisted' && <Button variant="secondary" disabled={busy} onClick={() => decide('shortlisted')}>Shortlist</Button>}
            <Button disabled={busy} onClick={() => decide('accepted')}>Accept & enroll</Button>
          </>
        )}>
        {!selected ? <Async state={detail}>{() => null}</Async> : (
          <div className="grid gap-5">
            <dl className="grid gap-2">
              <Detail label="Status"><StatusPill status={selected.status} /></Detail>
              <Detail label="Applied">{formatDate(selected.createdAt)}</Detail>
              <Detail label="Email">{selected.startup?.startupEmail}</Detail>
              <Detail label="Website">{selected.startup?.website}</Detail>
            </dl>
            {fields.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wider text-ink-soft uppercase">Answers</p>
                <dl className="grid gap-2">{fields.map((f) => <Detail key={f.key} label={f.label}>{answerOf(f.key)}</Detail>)}</dl>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wider text-ink-soft uppercase">Eligibility check</p>
              <ul className="grid gap-1.5 text-sm">
                {(selected.eligibility?.criteriaMet ?? []).map((c) => <li key={c} className="text-emerald-700">Met: {c}</li>)}
                {(selected.eligibility?.criteriaFailed ?? []).map((c) => <li key={c} className="text-red-600">Not met: {c}</li>)}
                {!selected.eligibility?.criteriaMet?.length && !selected.eligibility?.criteriaFailed?.length && <li className="text-ink-soft">No automatic checks for this cohort.</li>}
              </ul>
            </div>
            {selected.remarks && ['accepted', 'rejected'].includes(selected.status) && <Detail label="Remarks">{selected.remarks}</Detail>}
            {!['accepted', 'rejected', 'withdrawn'].includes(selected.status) && (
              <Field label="Remarks" htmlFor="rem" optional hint="Shared with the startup with your decision.">
                <Textarea id="rem" rows={3} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Drawer>

      <CohortForm draft={editing} setDraft={setEditing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
    </div>
  )
}
