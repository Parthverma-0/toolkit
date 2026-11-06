import { ArrowDownToLine, ArrowUpFromLine, Landmark, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { Button, Chips, Drawer, PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { Field, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { FUNDING_INSTRUMENTS, FUNDING_TYPES, ROUNDS } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, fileUrl, get, patch, post, toFormData } from '../../api/client.js'
import { formatDate, formatINR, formatINRShort, humanize } from '../../utils/format.js'

const TYPE_LABEL = { ic_fund_raised: 'Raised by IC', ic_fund_distributed: 'Given to startup', external_funding: 'External funding' }
const FILTERS = [{ id: 'all', label: 'All' }, ...FUNDING_TYPES.map((t) => ({ id: t, label: TYPE_LABEL[t] }))]
const opts = (list) => list.map((x) => ({ id: x, label: humanize(x) }))
const EMPTY = { type: 'ic_fund_distributed', startup: '', source: '', instrument: 'grant', round: 'na', amount: '', date: '', referenceNo: '', notes: '', files: [] }

export default function Funding() {
  const [filter, setFilter] = useState('all')
  const ledger = useApi(() => get('/incubators/me/funding', { limit: 100, type: filter === 'all' ? undefined : filter })
    .then((r) => ({ rows: r.data, totals: r.totals, total: r.pagination?.total ?? r.data.length })), [filter])
  // Startups the IC has onboarded, for the startup picker
  const startups = useApi(() => get('/incubators/me/startups', { limit: 100 }).then((r) => r.data.map((s) => s.startup)))
  return <FundingView ledger={ledger} startups={startups.data ?? []} filter={filter} setFilter={setFilter} />
}

function FundingView({ ledger, startups, filter, setFilter }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const totals = ledger.data?.totals
  const needsStartup = draft && draft.type !== 'ic_fund_raised'

  const run = async (fn, message) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      toast(message)
      setDraft(null)
      ledger.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!draft.amount || +draft.amount <= 0 || !draft.date) return setError('Amount and date are required')
    if (needsStartup && !draft.startup) return setError('Choose the startup')
    if (!needsStartup && !draft.source.trim()) return setError('Enter who the funds came from')
    const previous = draft.original?.type === 'ic_fund_distributed' ? draft.original.amount : 0
    if (totals && draft.type === 'ic_fund_distributed' && +draft.amount > totals.availableBalance + previous) {
      return setError('This is more than your available IC fund balance')
    }
    const body = toFormData({
      type: draft.type, instrument: draft.instrument, round: draft.round, amount: draft.amount, date: draft.date,
      startup: needsStartup ? draft.startup : undefined,
      source: draft.type === 'ic_fund_distributed' ? undefined : draft.source.trim(),
      referenceNo: draft.referenceNo.trim(), notes: draft.notes.trim(), documents: draft.files,
    })
    return run(() => (draft._id ? patch(`/incubators/me/funding/${draft._id}`, body) : post('/incubators/me/funding', body)),
      draft._id ? 'Entry updated' : 'Funding recorded')
  }

  const remove = () => run(() => del(`/incubators/me/funding/${draft._id}`), 'Entry deleted')

  const edit = (r) => {
    setDraft({
      ...EMPTY, _id: r._id, original: r, type: r.type, startup: r.startup?._id || '', source: r.source || '', instrument: r.instrument,
      round: r.round || 'na', amount: String(r.amount), date: r.date.slice(0, 10), referenceNo: r.referenceNo || '', notes: r.notes || '',
    })
    setError('')
  }

  return (
    <div>
      <PageHeader title="Funding" subtitle="Money raised by your incubator, disbursed to startups, and raised by startups from outside."
        action={<Button onClick={() => { setDraft({ ...EMPTY }); setError('') }}>Record funding</Button>} />

      <div className="mb-6 grid gap-6 sm:grid-cols-4">
        <Card><Stat icon={ArrowDownToLine} value={formatINRShort(totals?.fundRaised.total ?? 0)} label="Raised by IC" /></Card>
        <Card><Stat icon={ArrowUpFromLine} value={formatINRShort(totals?.fundDistributed.total ?? 0)} label="Disbursed to startups" /></Card>
        <Card><Stat icon={Wallet} value={formatINRShort(totals?.availableBalance ?? 0)} label="Available balance" /></Card>
        <Card><Stat icon={Landmark} value={formatINRShort(totals?.externalFunding.total ?? 0)} label="External funding" /></Card>
      </div>

      <div className="mb-5"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      <Card>
        <Async state={ledger}>
          {({ rows, total }) => (rows.length === 0 ? <Empty>No entries of this type yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Startup / source</th>
                    <th className="py-2 pr-4 font-medium">Instrument</th>
                    <th className="py-2 pr-4 text-right font-medium">Amount</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td className="py-3 pr-4 text-ink-soft">{formatDate(r.date)}</td>
                      <td className="py-3 pr-4 text-ink">{TYPE_LABEL[r.type]}</td>
                      <td className="py-3 pr-4 text-ink">
                        {r.startup?.name || r.source}
                        {r.startup && r.source && <span className="block text-xs text-ink-soft">from {r.source}</span>}
                        {r.documents?.length > 0 && (
                          <span className="block text-xs">
                            {r.documents.map((d) => <a key={d.url} href={fileUrl(d.url)} target="_blank" rel="noreferrer" className="mr-2 text-brand hover:underline">{d.name}</a>)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{humanize(r.instrument)}{r.round && r.round !== 'na' && ` · ${humanize(r.round)}`}</td>
                      <td className="py-3 pr-4 text-right font-medium text-ink tabular-nums">{formatINR(r.amount)}</td>
                      <td className="py-3 text-right"><button type="button" onClick={() => edit(r)} className="text-sm font-medium text-brand hover:text-brand-dark">Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > rows.length && <p className="mt-3 text-xs text-ink-soft">Showing the latest {rows.length} of {total} entries.</p>}
            </div>
          ))}
        </Async>
      </Card>

      <Drawer open={Boolean(draft)} title={draft?._id ? 'Edit funding entry' : 'Record funding'} onClose={() => setDraft(null)}
        footer={(
          <>
            {draft?._id && <Button variant="ghost" disabled={busy} onClick={remove}>Delete</Button>}
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</Button>
          </>
        )}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Type" required>
              <Pills label="Type" options={FUNDING_TYPES.map((t) => ({ id: t, label: TYPE_LABEL[t] }))} value={draft.type} onChange={(type) => setDraft({ ...draft, type })} />
            </Field>
            {needsStartup && (
              <Field label="Startup" htmlFor="fst" required hint={startups.length === 0 ? 'Startups appear here once enrolled in one of your cohorts.' : undefined}>
                <Select id="fst" value={draft.startup} placeholder="Choose a startup" options={startups.map((s) => ({ id: s._id, label: s.name }))} onChange={(e) => setDraft({ ...draft, startup: e.target.value })} />
              </Field>
            )}
            {draft.type !== 'ic_fund_distributed' && (
              <Field label={draft.type === 'ic_fund_raised' ? 'Funded by' : 'Investor or funder'} htmlFor="fsrc" required={!needsStartup} optional={needsStartup}>
                <TextInput id="fsrc" value={draft.source} maxLength={200} placeholder={draft.type === 'ic_fund_raised' ? 'Startup India Seed Fund Scheme' : 'Seedfold Ventures'} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Instrument" htmlFor="fin" required>
                <Select id="fin" value={draft.instrument} options={opts(FUNDING_INSTRUMENTS)} onChange={(e) => setDraft({ ...draft, instrument: e.target.value })} />
              </Field>
              <Field label="Round" htmlFor="frd" optional>
                <Select id="frd" value={draft.round} options={ROUNDS.map((r) => ({ id: r, label: r === 'na' ? 'Not applicable' : humanize(r) }))} onChange={(e) => setDraft({ ...draft, round: e.target.value })} />
              </Field>
              <Field label="Amount (₹)" htmlFor="famt" required>
                <TextInput id="famt" type="number" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </Field>
              <Field label="Date" htmlFor="fdate" required>
                <TextInput id="fdate" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Reference number" htmlFor="fref" optional>
              <TextInput id="fref" maxLength={100} value={draft.referenceNo} onChange={(e) => setDraft({ ...draft, referenceNo: e.target.value })} />
            </Field>
            <Field label="Notes" htmlFor="fnotes" optional>
              <Textarea id="fnotes" rows={3} maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            <Field label="Documents (PDF)" htmlFor="fdocs" optional hint="Sanction letters or receipts. Up to 5 per entry, 10 MB each.">
              <input id="fdocs" type="file" multiple accept="application/pdf" onChange={(e) => setDraft({ ...draft, files: [...(e.target.files || [])].slice(0, 5) })}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink" />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  )
}
