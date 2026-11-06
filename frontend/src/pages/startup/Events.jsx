import { useState } from 'react'
import { Badge, Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText } from '../../components/ui/Field.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, post } from '../../api/client.js'
import { formatDateTime, humanize, relativeDays } from '../../utils/format.js'

const TYPES = [{ id: 'all', label: 'All' }, ...['workshop', 'webinar', 'demo_day', 'networking', 'hackathon', 'bootcamp', 'pitch_event'].map((t) => ({ id: t, label: humanize(t) }))]
const timeRange = (e) => `${formatDateTime(e.startsAt)} - ${new Date(e.endsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
const hostOf = (e) => e.incubator?.name ?? e.organizer?.name

// Shared by the startup and mentor dashboards (both can attend events)
export default function Events({ subtitle = 'Workshops, webinars, demo days and networking from your incubator and the community.' }) {
  const toast = useToast()
  const [tab, setTab] = useState('upcoming')
  const [type, setType] = useState('all')
  const events = useApi(() => get('/events', { limit: 50, type: type === 'all' ? undefined : type }).then((r) => r.data), [type])
  const regs = useApi(() => get('/events/registrations/mine').then((r) => r.data))
  const [selected, setSelected] = useState(null) // event detail (with seatsLeft, myRegistration)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const active = (regs.data ?? []).filter((r) => r.status === 'registered' && r.event)
  const registeredIds = active.map((r) => r.event._id)

  const open = async (id) => {
    setError('')
    try {
      setSelected((await get(`/events/${id}`)).data)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const toggle = async () => {
    const isIn = selected.myRegistration?.status === 'registered'
    setBusy(true)
    setError('')
    try {
      if (isIn) await del(`/events/${selected._id}/register`)
      else await post(`/events/${selected._id}/register`)
      toast(isIn ? 'Registration cancelled' : `Registered for ${selected.title}`)
      setSelected(null)
      regs.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const state = tab === 'mine' ? { ...regs, data: regs.data && active.map((r) => r.event).filter((e) => type === 'all' || e.type === type) } : events
  const isIn = selected?.myRegistration?.status === 'registered'
  const full = selected && selected.seatsLeft === 0 && !isIn

  return (
    <div>
      <PageHeader title="Events" subtitle={subtitle} />
      <Tabs tabs={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'mine', label: 'Registered', count: registeredIds.length }]} value={tab} onChange={setTab} />
      <div className="mb-5"><Chips options={TYPES} value={type} onChange={setType} /></div>

      <Async state={state}>
        {(list) => (list.length === 0 ? (
          <Card><Empty>{tab === 'mine' ? 'You have not registered for any events yet.' : 'No events of this type coming up.'}</Empty></Card>
        ) : (
          <div className="grid gap-4">
            {list.map((e) => (
              <Card key={e._id}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-xs font-semibold tracking-wider text-brand uppercase">{new Date(e.startsAt).toLocaleString('en-IN', { month: 'short' })}</p>
                    <p className="font-display text-3xl font-bold text-ink">{new Date(e.startsAt).getDate()}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">{e.title}</p>
                    <p className="text-sm text-ink-soft">{[humanize(e.type), humanize(e.mode), timeRange(e), hostOf(e)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {registeredIds.includes(e._id) && <Badge tone="success">Registered</Badge>}
                    {e.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => open(e._id)}>Details</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </Async>

      <Drawer
        open={Boolean(selected)} title={selected?.title} subtitle={selected && `${humanize(selected.type)}${hostOf(selected) ? ` by ${hostOf(selected)}` : ''}`} onClose={() => setSelected(null)}
        footer={selected && (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            {isIn
              ? <Button variant="danger" disabled={busy} onClick={toggle}>Cancel registration</Button>
              : <Button disabled={busy || full || selected.status !== 'published'} onClick={toggle}>{full ? 'Event full' : 'Register'}</Button>}
          </>
        )}
      >
        {selected && (
          <div className="grid gap-5">
            <p className="text-sm whitespace-pre-line text-ink">{selected.description}</p>
            <dl className="grid gap-2">
              <Detail label="When">{timeRange(selected)} · {relativeDays(selected.startsAt)}</Detail>
              <Detail label="Mode">{humanize(selected.mode)}</Detail>
              {selected.venue && <Detail label="Venue">{selected.venue}</Detail>}
              {selected.capacity && <Detail label="Seats">{selected.seatsLeft} of {selected.capacity} left</Detail>}
              {selected.meetingLink && (
                <Detail label="Joining link"><a href={selected.meetingLink} target="_blank" rel="noreferrer" className="text-brand hover:underline">{selected.meetingLink}</a></Detail>
              )}
            </dl>
            {isIn && !selected.meetingLink && selected.mode !== 'offline' && (
              <p className="text-sm text-ink-soft">The organiser will share the joining link before the event.</p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
