import { useState } from 'react'
import { Badge, Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import { ErrorText, Field, Textarea, TextInput } from '../../components/ui/Field.jsx'
import Async from '../../components/dashboard/Async.jsx'
import useApi from '../../hooks/useApi.js'
import { errorMessage, get, patch } from '../../api/client.js'
import { formatDateTime, humanize, relativeDays } from '../../utils/format.js'

export default function MentorSessions() {
  const state = useApi(() => get('/mentoring/sessions', { limit: 50 }).then((r) => r.data))
  return <Async state={state}>{(list) => <SessionsView sessions={list} reload={state.reload} />}</Async>
}

function SessionsView({ sessions, reload }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('requests')
  const [selected, setSelected] = useState(null)
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')

  const now = new Date()
  const requests = sessions.filter((s) => s.status === 'requested')
  const upcoming = sessions.filter((s) => s.status === 'confirmed' && new Date(s.scheduledAt) >= now)
  // Confirmed sessions whose time has passed still need to be marked complete
  const toClose = sessions.filter((s) => s.status === 'confirmed' && new Date(s.scheduledAt) < now)
  const past = sessions.filter((s) => ['completed', 'cancelled', 'rejected'].includes(s.status))
  const lists = { requests, upcoming: [...toClose, ...upcoming], past }

  const open = (s) => { setSelected(s); setLink(s.meetingLink || ''); setNotes(s.mentorNotes || ''); setReason(''); setError('') }
  // action = confirm | reject | cancel | complete (PATCH /api/mentoring/sessions/:id/:action)
  const update = async (action, body, msg) => {
    setBusy(true)
    setError('')
    try {
      await patch(`/mentoring/sessions/${selected._id}/${action}`, body)
      setSelected(null)
      toast(msg)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const s = selected
  const isPast = s && new Date(s.scheduledAt) < now

  return (
    <div>
      <PageHeader title="Sessions" subtitle="Confirm requests, share meeting links and close sessions with notes." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'requests', label: 'Requests', count: requests.length },
        { id: 'upcoming', label: 'Upcoming', count: upcoming.length + toClose.length },
        { id: 'past', label: 'Past' },
      ]} />

      <Card>
        {lists[tab].length === 0 ? <Empty>{tab === 'requests' ? 'No requests waiting.' : tab === 'upcoming' ? 'Nothing scheduled.' : 'No past sessions yet.'}</Empty> : (
          <ul className="-my-3 divide-y divide-line">
            {[...lists[tab]].sort((a, b) => (tab === 'past' ? new Date(b.scheduledAt) - new Date(a.scheduledAt) : new Date(a.scheduledAt) - new Date(b.scheduledAt))).map((x) => (
              <li key={x._id}>
                <button type="button" onClick={() => open(x)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-brand-soft/60">
                  <div>
                    <p className="text-sm font-medium text-ink">{x.topic}</p>
                    <p className="text-xs text-ink-soft">{x.startup?.name} · {formatDateTime(x.scheduledAt)} · {x.durationMinutes} min · {humanize(x.mode)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {toClose.includes(x) && <Badge tone="warning">Mark complete</Badge>}
                    {x.feedback?.rating && <span className="text-xs text-ink-soft">Rated {x.feedback.rating}/5</span>}
                    <StatusPill status={x.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(s)} title={s?.topic} subtitle={s?.startup?.name} onClose={() => setSelected(null)}
        footer={s && (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            {s.status === 'requested' && (
              <>
                <Button variant="danger" className="mr-auto" disabled={busy || !reason.trim()} onClick={() => update('reject', { reason: reason.trim() }, 'Request declined')}>Decline</Button>
                <Button disabled={busy || (s.mode === 'online' && !link.trim())}
                  onClick={() => update('confirm', s.mode === 'online' ? { meetingLink: link.trim() } : { location: link.trim() || undefined }, 'Session confirmed')}>Confirm</Button>
              </>
            )}
            {s.status === 'confirmed' && !isPast && <Button variant="danger" className="mr-auto" disabled={busy || !reason.trim()} onClick={() => update('cancel', { reason: reason.trim() }, 'Session cancelled')}>Cancel session</Button>}
            {s.status === 'confirmed' && isPast && <Button disabled={busy} onClick={() => update('complete', { mentorNotes: notes.trim() || undefined }, 'Session marked complete')}>Mark complete</Button>}
          </>
        )}>
        {s && (
          <div className="grid gap-5">
            <dl className="grid gap-2">
              <Detail label="Status"><StatusPill status={s.status} /></Detail>
              <Detail label="When">{formatDateTime(s.scheduledAt)} · {relativeDays(s.scheduledAt)}</Detail>
              <Detail label="Duration">{s.durationMinutes} min</Detail>
              <Detail label="Mode">{humanize(s.mode)}</Detail>
              <Detail label="Agenda">{s.agenda}</Detail>
            </dl>
            {s.status === 'requested' && (
              <Field label={s.mode === 'online' ? 'Meeting link' : 'Location'} htmlFor="ml" required={s.mode === 'online'} optional={s.mode !== 'online'}>
                <TextInput id="ml" value={link} placeholder={s.mode === 'online' ? 'https://meet.google.com/...' : 'Office address'} onChange={(e) => setLink(e.target.value)} />
              </Field>
            )}
            {s.status === 'confirmed' && (s.meetingLink || s.location) && (
              <Detail label={s.meetingLink ? 'Meeting link' : 'Location'}>{s.meetingLink || s.location}</Detail>
            )}
            {['requested', 'confirmed'].includes(s.status) && !isPast && (
              <Field label={s.status === 'requested' ? 'Reason, if declining' : 'Reason, if cancelling'} htmlFor="mr" optional hint="Sent to the founder.">
                <Textarea id="mr" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            {s.status === 'confirmed' && isPast && (
              <Field label="Session notes" htmlFor="mn" optional hint="Private to you and the startup.">
                <Textarea id="mn" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            )}
            {s.status === 'completed' && (
              <dl className="grid gap-2 border-t border-line pt-5">
                <Detail label="Your notes">{s.mentorNotes}</Detail>
                <Detail label="Founder rating">{s.feedback?.rating ? `${s.feedback.rating} / 5` : 'Not rated yet'}</Detail>
                {s.feedback?.comment && <Detail label="Comment">{s.feedback.comment}</Detail>}
              </dl>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
