import { useState } from 'react'
import { Badge, Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, SearchInput, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import { Field, Textarea, TextInput } from '../../components/ui/Field.jsx'
import Async from '../../components/dashboard/Async.jsx'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import { del, errorMessage, get, post } from '../../api/client.js'
import { SECTORS, STAGES } from '../../constants/startup.js'
import { INVESTOR_TYPES } from '../../constants/enums.js'
import { formatDate, formatINRShort, humanize, rangeINR } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const TYPES = [{ id: 'all', label: 'All types' }, ...INVESTOR_TYPES.map((t) => ({ id: t, label: humanize(t) }))]
const PIPELINE = ['requested', 'in_review', 'meeting_scheduled', 'in_discussion', 'invested', 'declined']

export default function Investors() {
  const [tab, setTab] = useState('directory')
  const state = useApi(() => get('/investors/connections').then((r) => r.data))
  const connections = state.data ?? []
  return (
    <div>
      <PageHeader title="Investors" subtitle="Find investors that back your sector and stage, and track every conversation." />
      <Tabs
        tabs={[{ id: 'directory', label: 'Directory' }, { id: 'pipeline', label: 'My pipeline', count: connections.length }]}
        value={tab} onChange={setTab}
      />
      {tab === 'directory'
        ? <Directory connections={connections} onConnect={state.reload} />
        : <Async state={state}>{(list) => <Pipeline connections={list} reload={state.reload} />}</Async>}
    </div>
  )
}

function Directory({ connections, onConnect }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ message: '', amountSought: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const connectedIds = connections.map((c) => c.investor?._id)
  const q = useDebounced(query.trim(), 300)
  const state = useApi(() => get('/investors', {
    limit: 50, q: q || undefined, type: type === 'all' ? undefined : type,
  }).then((r) => r.data), [q, type])

  const connect = async () => {
    if (!form.message.trim()) return setError('Add a short note for the investor')
    setSaving(true)
    try {
      await post(`/investors/${selected._id}/connect`, {
        message: form.message.trim(),
        amountSought: form.amountSought === '' ? undefined : +form.amountSought,
        pitchDeckUrl: form.pitchDeckUrl.trim() || undefined,
      })
      toast(`Connection request sent to ${selected.name}`)
      setSelected(null)
      onConnect()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-5 grid gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search investors or cities" />
        <Chips options={TYPES} value={type} onChange={setType} />
      </div>
      <Async state={state}>{(list) => (list.length === 0 ? <Card><Empty>No investors match these filters.</Empty></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((i) => (
            <Card key={i._id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{i.name}</p>
                  <p className="text-sm text-ink-soft">{[i.firm, humanize(i.type), i.location].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-sm font-medium whitespace-nowrap text-ink">{rangeINR(i.ticketSize)}</span>
              </div>
              <p className="mt-3 flex-1 text-sm text-ink">{i.about}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(i.stages?.length ? i.stages : ['any']).map((s) => <Badge key={s}>{s === 'any' ? 'Any stage' : labelOf(STAGES, s)}</Badge>)}
              </div>
              <div className="mt-5 border-t border-line pt-4">
                {connectedIds.includes(i._id)
                  ? <StatusPill status="requested" label="Connected" />
                  : <Button size="sm" onClick={() => { setSelected(i); setForm({ message: '', amountSought: '', pitchDeckUrl: '' }); setError('') }}>Connect</Button>}
              </div>
            </Card>
          ))}
        </div>
      ))}</Async>

      <Drawer
        open={Boolean(selected)} title={`Connect with ${selected?.name}`} subtitle="Your startup profile and latest metrics are shared." onClose={() => setSelected(null)}
        footer={<><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={connect} disabled={saving}>{saving ? 'Sending...' : 'Send request'}</Button></>}
      >
        {selected && (
          <div className="grid gap-5">
            <dl className="grid gap-2">
              <Detail label="Ticket size">{rangeINR(selected.ticketSize)}</Detail>
              <Detail label="Sectors">{(selected.sectors ?? []).map((s) => labelOf(SECTORS, s)).join(', ') || 'Sector agnostic'}</Detail>
              <Detail label="Stages">{(selected.stages ?? []).map((s) => labelOf(STAGES, s)).join(', ') || 'Any stage'}</Detail>
            </dl>
            <Field label="Amount you are raising (₹)" htmlFor="iamt" optional>
              <TextInput id="iamt" type="number" min={0} value={form.amountSought} onChange={(e) => setForm({ ...form, amountSought: e.target.value })} />
            </Field>
            <Field label="Pitch deck link" htmlFor="ideck" optional>
              <TextInput id="ideck" value={form.pitchDeckUrl} placeholder="https://" onChange={(e) => setForm({ ...form, pitchDeckUrl: e.target.value })} />
            </Field>
            <Field label="Note to the investor" htmlFor="imsg" required hint="Two or three lines: traction, raise, why them.">
              <Textarea id="imsg" rows={5} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </>
  )
}

function Pipeline({ connections, reload }) {
  const toast = useToast()
  const withdraw = async (c) => {
    try {
      await del(`/investors/connections/${c._id}`)
      toast(`Request to ${c.investor?.name} withdrawn`)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  const counts = Object.fromEntries(PIPELINE.map((s) => [s, connections.filter((c) => c.status === s).length]))
  const totalAsk = connections.filter((c) => c.status !== 'declined').reduce((s, c) => s + (c.amountSought || 0), 0)

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <Card><Stat value={connections.length} label="Conversations" /></Card>
        <Card><Stat value={counts.meeting_scheduled + counts.in_discussion} label="Meetings and discussions" /></Card>
        <Card><Stat value={formatINRShort(totalAsk)} label="Total being discussed" /></Card>
      </div>
      <Card title="Pipeline">
        {connections.length === 0 ? <Empty>Connect with investors from the directory to start your pipeline.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="py-2 pr-4 font-medium">Investor</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 text-right font-medium">Ask</th>
                  <th className="py-2 pr-4 font-medium">Since</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {connections.map((c) => (
                  <tr key={c._id}>
                    <td className="py-3 pr-4 font-medium text-ink">{c.investor?.name}</td>
                    <td className="py-3 pr-4 text-ink-soft">{c.investor?.type && humanize(c.investor.type)}</td>
                    <td className="py-3 pr-4 text-right text-ink tabular-nums">{formatINRShort(c.amountSought)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{formatDate(c.createdAt)}</td>
                    <td className="py-3 pr-4"><StatusPill status={c.status} /></td>
                    <td className="py-3 text-right">
                      {c.status === 'requested' && <Button size="sm" variant="ghost" onClick={() => withdraw(c)}>Withdraw</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
