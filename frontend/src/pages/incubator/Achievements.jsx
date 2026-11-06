import { useState } from 'react'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Chips, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ACHIEVEMENT_TYPES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch } from '../../api/client.js'
import { formatDate, humanize } from '../../utils/format.js'

const TYPES = [{ id: 'all', label: 'All types' }, ...ACHIEVEMENT_TYPES.map((t) => ({ id: t, label: humanize(t) }))]

export default function Achievements() {
  const state = useApi(() => get('/incubators/me/achievements').then((r) => r.data))
  return (
    <div>
      <PageHeader title="Achievements" subtitle="Startups report awards, patents, funding and launches. Verified ones appear in your reports." />
      <Async state={state}>{(list) => <AchievementsView list={list} setList={state.setData} />}</Async>
    </div>
  )
}

function AchievementsView({ list, setList }) {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [type, setType] = useState('all')
  const [busy, setBusy] = useState(null)
  const pending = list.filter((a) => !a.isVerified)
  const shown = (tab === 'pending' ? pending : list.filter((a) => a.isVerified)).filter((a) => type === 'all' || a.type === type)

  const decide = async (a, verify) => {
    setBusy(a._id)
    try {
      if (verify) {
        const r = await patch(`/incubators/me/achievements/${a._id}`, { isVerified: true })
        setList((l) => l.map((x) => (x._id === a._id ? { ...x, ...r.data, startup: x.startup } : x)))
      } else {
        await del(`/incubators/me/achievements/${a._id}`)
        setList((l) => l.filter((x) => x._id !== a._id))
      }
      toast(verify ? `Verified: ${a.title}` : 'Achievement rejected and removed')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Tabs tabs={[{ id: 'pending', label: 'To verify', count: pending.length }, { id: 'verified', label: 'Verified', count: list.length - pending.length }]} value={tab} onChange={setTab} />
      <div className="mb-5"><Chips options={TYPES} value={type} onChange={setType} /></div>
      <Card>
        {shown.length === 0 ? <Empty>{tab === 'pending' ? 'Nothing waiting for verification.' : 'No verified achievements of this type.'}</Empty> : (
          <ul className="divide-y divide-line">
            {shown.map((a) => (
              <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <p className="text-xs text-ink-soft">
                    {a.startup?.name} · {humanize(a.type)} · {formatDate(a.date)}
                    {a.proofUrl && <> · <a href={a.proofUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Proof</a></>}
                  </p>
                  {a.description && <p className="mt-1 text-sm text-ink-soft">{a.description}</p>}
                </div>
                {a.isVerified ? <StatusPill status="verified" /> : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={busy === a._id} onClick={() => decide(a, false)}>Reject</Button>
                    <Button size="sm" disabled={busy === a._id} onClick={() => decide(a, true)}>Verify</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
