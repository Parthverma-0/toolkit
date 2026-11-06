import { useState } from 'react'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { SECTORS, STAGES } from '../../constants/startup.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch, post, toFormData } from '../../api/client.js'
import { formatDate, formatINR, humanize, rangeINR, relativeDays } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const PROVIDERS = [{ id: 'all', label: 'All' }, ...['government', 'incubator', 'corporate', 'foundation', 'other'].map((p) => ({ id: p, label: humanize(p) }))]

export default function Grants() {
  const toast = useToast()
  const [tab, setTab] = useState('browse')
  const [provider, setProvider] = useState('all')
  const grants = useApi(() => get('/grants', { limit: 50, providerType: provider === 'all' ? undefined : provider }).then((r) => r.data), [provider])
  const apps = useApi(() => get('/grants/applications/mine').then((r) => r.data))
  const [selected, setSelected] = useState(null) // grant
  const [form, setForm] = useState({ amountRequested: '', purpose: '', documents: [] })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const appList = apps.data ?? []
  const appFor = (id) => appList.find((a) => a.grant?._id === id)

  const open = async (grantId) => {
    setError('')
    try {
      const { data } = await get(`/grants/${grantId}`)
      setSelected(data)
      const existing = data.myApplication
      setForm({ amountRequested: existing?.amountRequested ?? '', purpose: existing?.purpose ?? '', documents: [] })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  // submit=false saves a draft. A draft that already exists is updated with PATCH.
  const save = async (submit) => {
    if (submit && (!form.amountRequested || !form.purpose.trim())) return setError('Amount and purpose are required to submit')
    setSaving(true)
    setError('')
    const body = toFormData({
      amountRequested: form.amountRequested, purpose: form.purpose.trim(), submit, documents: form.documents,
    })
    try {
      const existing = selected.myApplication
      if (existing) await patch(`/grants/applications/${existing._id}`, body)
      else await post(`/grants/${selected._id}/applications`, body)
      toast(submit ? `Applied to ${selected.title}` : 'Draft saved')
      setSelected(null)
      apps.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteDraft = async (a) => {
    try {
      await del(`/grants/applications/${a._id}`)
      toast('Draft deleted')
      apps.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const existing = selected?.myApplication
  const editable = !existing || existing.status === 'draft'

  return (
    <div>
      <PageHeader title="Grants" subtitle="Non-dilutive funding matched to your sector and stage." />
      <Tabs tabs={[{ id: 'browse', label: 'Open grants', count: grants.data?.length }, { id: 'mine', label: 'My applications', count: appList.length }]} value={tab} onChange={setTab} />

      {tab === 'browse' ? (
        <>
          <div className="mb-5"><Chips options={PROVIDERS} value={provider} onChange={setProvider} /></div>
          <Async state={grants}>
            {(list) => (list.length === 0 ? <Card><Empty title="No grants listed yet">New grants appear here as soon as they are published.</Empty></Card> : (
              <div className="grid gap-4 md:grid-cols-2">
                {list.map((g) => {
                  const app = appFor(g._id)
                  return (
                    <Card key={g._id} className="flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-ink">{g.title}</p>
                          <p className="text-sm text-ink-soft">{g.incubator?.name ?? g.provider} · {humanize(g.providerType)}</p>
                        </div>
                        <StatusPill status={g.status} />
                      </div>
                      <p className="mt-3 flex-1 text-sm text-ink">{g.description}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                        <div className="text-sm">
                          <span className="font-semibold text-ink">{rangeINR(g.amount)}</span>
                          {g.deadline && <span className="text-ink-soft"> · closes {formatDate(g.deadline)}</span>}
                        </div>
                        {app && app.status !== 'draft'
                          ? <StatusPill status={app.status} />
                          : <Button size="sm" disabled={g.status !== 'open'} onClick={() => open(g._id)}>
                            {g.status !== 'open' ? 'Opens soon' : app ? 'Continue draft' : 'View & apply'}
                          </Button>}
                      </div>
                    </Card>
                  )
                })}
              </div>
            ))}
          </Async>
        </>
      ) : (
        <Card title="My applications">
          <Async state={apps}>
            {(list) => (list.length === 0 ? <Empty>You have not applied to any grants yet.</Empty> : (
              <ul className="divide-y divide-line">
                {list.map((a) => (
                  <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{a.grant?.title}</p>
                      <p className="text-xs text-ink-soft">
                        {[a.grant?.provider, a.amountRequested != null && `requested ${formatINR(a.amountRequested)}`, `updated ${formatDate(a.updatedAt)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={a.status} />
                      {a.status === 'draft' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => deleteDraft(a)}>Delete</Button>
                          <Button size="sm" variant="secondary" onClick={() => open(a.grant?._id)}>Continue</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </Async>
        </Card>
      )}

      <Drawer
        open={Boolean(selected)} title={selected?.title} subtitle={selected?.incubator?.name ?? selected?.provider} onClose={() => setSelected(null)}
        footer={editable && selected?.isAcceptingApplications ? (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            <Button variant="ghost" disabled={saving} onClick={() => save(false)}>Save draft</Button>
            <Button disabled={saving} onClick={() => save(true)}>{saving ? 'Saving...' : 'Submit application'}</Button>
          </>
        ) : <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="grid gap-5">
            <p className="text-sm text-ink">{selected.description}</p>
            <dl className="grid gap-2">
              <Detail label="Amount">{rangeINR(selected.amount)}</Detail>
              <Detail label="Deadline">{selected.deadline && `${formatDate(selected.deadline)} · ${relativeDays(selected.deadline)}`}</Detail>
              <Detail label="Sectors">{(selected.sectors ?? []).map((s) => labelOf(SECTORS, s)).join(', ') || 'All sectors'}</Detail>
              <Detail label="Stages">{(selected.stages ?? []).map((s) => labelOf(STAGES, s)).join(', ') || 'All stages'}</Detail>
              {selected.applyUrl && <Detail label="Official page"><a href={selected.applyUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{selected.applyUrl}</a></Detail>}
            </dl>
            {selected.eligibility?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Eligibility</p>
                <ul className="grid gap-1.5 text-sm text-ink-soft">{selected.eligibility.map((e) => <li key={e}>- {e}</li>)}</ul>
              </div>
            )}
            {!editable ? (
              <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-ink">Your application is <StatusPill status={existing.status} />.</p>
            ) : !selected.isAcceptingApplications ? (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">This grant is not accepting applications right now.</p>
            ) : (
              <div className="grid gap-5 border-t border-line pt-5">
                <Field label="Amount requested (₹)" htmlFor="gamt" required>
                  <TextInput id="gamt" type="number" min={0} value={form.amountRequested} onChange={(e) => setForm({ ...form, amountRequested: e.target.value })} />
                </Field>
                <Field label="How will you use it?" htmlFor="gpur" required>
                  <Textarea id="gpur" rows={4} maxLength={5000} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </Field>
                <Field label="Supporting documents" htmlFor="gdocs" optional hint="Up to 5 PDFs, 10 MB each">
                  <input id="gdocs" type="file" accept="application/pdf" multiple
                    onChange={(e) => setForm({ ...form, documents: [...e.target.files].slice(0, 5) })}
                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink" />
                </Field>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
