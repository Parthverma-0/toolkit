import { useState } from 'react'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { EVENT_TYPES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch, post } from '../../api/client.js'
import { formatDateTime, humanize } from '../../utils/format.js'

const opts = (l) => l.map((x) => ({ id: x, label: humanize(x) }))
const MODES = opts(['online', 'offline', 'hybrid'])
const VISIBILITY = [{ id: 'public', label: 'Everyone' }, { id: 'incubator_only', label: 'My startups' }, { id: 'cohort_only', label: 'One cohort' }]
const EMPTY = { title: '', type: 'workshop', mode: 'online', startsAt: '', endsAt: '', venue: '', meetingLink: '', capacity: '', visibility: 'public', cohort: '', description: '' }

// ISO date -> value for <input type="datetime-local"> in local time
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Events the signed-in user organises. Incubators can restrict who joins; mentors run public events.
export function EventManager({ role = 'incubator', title = 'Events', subtitle }) {
  const toast = useToast()
  const isIncubator = role === 'incubator'
  const state = useApi(() => get('/events/mine').then((r) => r.data))
  const cohorts = useApi(() => (isIncubator ? get('/incubators/me/cohorts').then((r) => r.data) : Promise.resolve([])))
  const [tab, setTab] = useState('upcoming')
  const [draft, setDraft] = useState(null)
  const [viewing, setViewing] = useState(null)
  const regs = useApi(() => (viewing ? get(`/events/${viewing._id}/registrations`).then((r) => r.data) : Promise.resolve([])), [viewing?._id])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const now = new Date()

  const list = state.data ?? []
  const upcoming = list.filter((e) => new Date(e.endsAt) >= now && !['cancelled', 'completed'].includes(e.status))
  const shown = tab === 'upcoming' ? upcoming : list.filter((e) => !upcoming.includes(e))
  const visibilityOptions = isIncubator ? VISIBILITY : VISIBILITY.slice(0, 1)

  const run = async (fn, message) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      toast(message)
      setDraft(null)
      setViewing(null)
      state.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = (publish) => {
    if (!draft.title.trim() || !draft.startsAt || !draft.endsAt) return setError('Title, start and end are required')
    if (draft.endsAt <= draft.startsAt) return setError('End must be after start')
    if (draft.mode !== 'online' && !draft.venue.trim()) return setError('Add a venue for in-person events')
    if (draft.visibility === 'cohort_only' && !draft.cohort) return setError('Pick the cohort')
    const body = {
      title: draft.title.trim(), type: draft.type, mode: draft.mode, description: draft.description.trim() || undefined,
      startsAt: new Date(draft.startsAt).toISOString(), endsAt: new Date(draft.endsAt).toISOString(),
      venue: draft.mode !== 'online' ? draft.venue.trim() : undefined,
      meetingLink: draft.mode !== 'offline' ? draft.meetingLink.trim() || undefined : undefined,
      capacity: draft.capacity === '' ? null : Number(draft.capacity),
      visibility: draft.visibility, cohort: draft.visibility === 'cohort_only' ? draft.cohort : null,
    }
    run(async () => {
      const saved = draft._id ? (await patch(`/events/${draft._id}`, body)).data : (await post('/events', body)).data
      if (publish && saved.status === 'draft') await patch(`/events/${saved._id}/status`, { status: 'published' })
    }, publish ? 'Event published' : draft._id ? 'Event updated' : 'Event saved as draft')
  }

  const setStatus = (ev, status) => run(() => patch(`/events/${ev._id}/status`, { status }), `Event ${status === 'published' ? 'published' : status}`)
  const remove = (ev) => run(() => del(`/events/${ev._id}`), 'Event deleted')

  const markAttendance = async (r, status) => {
    try {
      await patch(`/events/${viewing._id}/registrations/${r._id}`, { status })
      regs.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const edit = (e) => {
    setViewing(null)
    setError('')
    setDraft({
      ...EMPTY, ...e, startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt),
      capacity: e.capacity ?? '', venue: e.venue ?? '', meetingLink: e.meetingLink ?? '', description: e.description ?? '', cohort: e.cohort ?? '',
    })
  }

  const attendees = regs.data ?? []

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}
        action={<Button onClick={() => { setDraft({ ...EMPTY }); setError('') }}>New event</Button>} />
      <Tabs tabs={[{ id: 'upcoming', label: 'Upcoming', count: upcoming.length }, { id: 'past', label: 'Past & cancelled' }]} value={tab} onChange={setTab} />

      <Card>
        <Async state={state}>
          {() => (shown.length === 0 ? <Empty>No events here.</Empty> : (
            <ul className="-my-3 divide-y divide-line">
              {shown.map((e) => (
                <li key={e._id}>
                  <button type="button" onClick={() => { setViewing(e); setError('') }} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-brand-soft/60">
                    <div>
                      <p className="text-sm font-medium text-ink">{e.title}</p>
                      <p className="text-xs text-ink-soft">{humanize(e.type)} · {humanize(e.mode)} · {formatDateTime(e.startsAt)} · {VISIBILITY.find((v) => v.id === e.visibility)?.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {e.capacity && <span className="text-sm text-ink-soft tabular-nums">{e.capacity} seats</span>}
                      <StatusPill status={e.status === 'published' ? 'open' : e.status} label={e.status === 'published' ? 'Published' : undefined} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </Async>
      </Card>

      <Drawer open={Boolean(viewing)} title={viewing?.title} subtitle={viewing && `${humanize(viewing.type)} · ${formatDateTime(viewing.startsAt)}`} onClose={() => setViewing(null)}
        footer={viewing && (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            {viewing.status === 'draft' && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => remove(viewing)}>Delete</Button>}
            {viewing.status === 'published' && new Date(viewing.startsAt) > now && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => setStatus(viewing, 'cancelled')}>Cancel event</Button>}
            {viewing.status === 'published' && new Date(viewing.endsAt) < now && <Button variant="secondary" disabled={busy} onClick={() => setStatus(viewing, 'completed')}>Mark completed</Button>}
            {['draft', 'published'].includes(viewing.status) && <Button variant="secondary" disabled={busy} onClick={() => edit(viewing)}>Edit</Button>}
            {viewing.status === 'draft' && <Button disabled={busy} onClick={() => setStatus(viewing, 'published')}>Publish</Button>}
          </>
        )}>
        {viewing && (
          <div className="grid gap-6">
            <dl className="grid gap-2">
              <Detail label="Mode">{humanize(viewing.mode)}</Detail>
              {viewing.venue && <Detail label="Venue">{viewing.venue}</Detail>}
              {viewing.meetingLink && <Detail label="Meeting link">{viewing.meetingLink}</Detail>}
              <Detail label="Who can join">{VISIBILITY.find((v) => v.id === viewing.visibility)?.label}</Detail>
              <Detail label="Registered">{attendees.filter((r) => r.status !== 'cancelled').length}{viewing.capacity ? ` of ${viewing.capacity}` : ''}</Detail>
            </dl>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wider text-ink-soft uppercase">Registrations</p>
              <Async state={regs}>
                {(rows) => (rows.length === 0 ? <p className="text-sm text-ink-soft">No registrations yet.</p> : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {rows.map((r) => (
                      <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                        <div>
                          <p className="text-sm text-ink">{r.user?.name}</p>
                          <p className="text-xs text-ink-soft">{[r.startup?.name, r.user?.email].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.status === 'registered' && new Date(viewing.startsAt) < now && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => markAttendance(r, 'no_show')}>No-show</Button>
                              <Button size="sm" variant="secondary" onClick={() => markAttendance(r, 'attended')}>Attended</Button>
                            </>
                          )}
                          <StatusPill status={r.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
              </Async>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(draft)} title={draft?._id ? 'Edit event' : 'New event'} onClose={() => setDraft(null)}
        footer={(
          <>
            {error && <ErrorText>{error}</ErrorText>}
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => save(false)}>{draft?._id ? 'Save changes' : 'Save draft'}</Button>
            {(!draft?._id || draft.status === 'draft') && <Button disabled={busy} onClick={() => save(true)}>Publish</Button>}
          </>
        )}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Title" htmlFor="evt" required><TextInput id="evt" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Type" htmlFor="evty" required><Select id="evty" value={draft.type} options={opts(EVENT_TYPES)} onChange={(e) => setDraft({ ...draft, type: e.target.value })} /></Field>
            <Field label="Mode" required><Pills label="Mode" options={MODES} value={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Starts" htmlFor="evs" required><TextInput id="evs" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></Field>
              <Field label="Ends" htmlFor="eve" required><TextInput id="eve" type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></Field>
            </div>
            {draft.mode !== 'online' && <Field label="Venue" htmlFor="evv" required><TextInput id="evv" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} /></Field>}
            {draft.mode !== 'offline' && <Field label="Meeting link" htmlFor="evl" optional hint="Shown to registered attendees only."><TextInput id="evl" value={draft.meetingLink} placeholder="https://" onChange={(e) => setDraft({ ...draft, meetingLink: e.target.value })} /></Field>}
            <Field label="Capacity" htmlFor="evc" optional><TextInput id="evc" type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></Field>
            {visibilityOptions.length > 1 && (
              <Field label="Who can join" required><Pills label="Visibility" options={visibilityOptions} value={draft.visibility} onChange={(visibility) => setDraft({ ...draft, visibility })} /></Field>
            )}
            {draft.visibility === 'cohort_only' && (
              <Field label="Cohort" htmlFor="evco" required>
                <Select id="evco" value={draft.cohort} placeholder="Select a cohort"
                  options={(cohorts.data ?? []).map((c) => ({ id: c._id, label: c.name }))} onChange={(e) => setDraft({ ...draft, cohort: e.target.value })} />
              </Field>
            )}
            <Field label="Description" htmlFor="evd" optional><Textarea id="evd" rows={4} maxLength={10000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default function IncubatorEvents() {
  return <EventManager role="incubator" subtitle="Run workshops, demo days and webinars for your startups and the community." />
}
