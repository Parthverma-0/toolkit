import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import StartupCard from '../../components/investor/StartupCard.jsx'
import StartupDrawer from '../../components/investor/StartupDrawer.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get } from '../../api/client.js'
import { formatDate } from '../../utils/format.js'

export default function Shortlist() {
  const state = useApi(() => get('/investor-portal/shortlist').then((r) => r.data))
  const toast = useToast()
  const [selected, setSelected] = useState(null)

  const remove = async (s) => {
    try {
      await del(`/investor-portal/shortlist/${s.id}`)
      toast('Removed from shortlist')
      state.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Shortlist" subtitle="Startups you saved, with your private notes and where each connection stands." />
      <Async state={state}>{(list) => (list.length === 0 ? (
        <Card>
          <Empty title="Nothing saved yet" action={<Link to="/investor/discover"><Button>Discover startups</Button></Link>}>
            Tap the bookmark on any startup to save it here and add private notes.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((s) => (
            <StartupCard key={s.id} startup={s} onOpen={() => setSelected(s.id)} onConnect={() => setSelected(s.id)} onToggleShortlist={remove}>
              <span className="ml-auto text-xs text-ink-soft">Saved {formatDate(s.savedAt)}</span>
            </StartupCard>
          ))}
        </div>
      ))}</Async>
      {state.data?.some((s) => s.note) && (
        <Card title="Your notes" className="mt-8">
          <ul className="divide-y divide-line">
            {state.data.filter((s) => s.note).map((s) => (
              <li key={s.id} className="py-3">
                <button type="button" onClick={() => setSelected(s.id)} className="font-semibold text-ink hover:text-brand">{s.name}</button>
                <p className="mt-0.5 text-base whitespace-pre-line text-ink-soft">{s.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {selected && <StartupDrawer id={selected} onClose={() => setSelected(null)} onChanged={state.reload} />}
    </div>
  )
}
