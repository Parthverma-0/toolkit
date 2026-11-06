import { useState } from 'react'
import { Badge, Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Chips, Detail, Drawer, PageHeader, SearchInput, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import { ErrorText, Field, Pills, Textarea, TextInput } from '../../components/ui/Field.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { VIDEO_CATEGORIES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import { errorMessage, get, patch, post } from '../../api/client.js'
import { formatDateTime, humanize, relativeDays } from '../../utils/format.js'

const EXPERTISE = [{ id: 'all', label: 'All' }, ...VIDEO_CATEGORIES.filter((c) => c !== 'other').map((c) => ({ id: c, label: humanize(c) }))]
const DURATIONS = [{ id: '30', label: '30 min' }, { id: '45', label: '45 min' }, { id: '60', label: '60 min' }]
const MODES = [{ id: 'online', label: 'Online' }, { id: 'offline', label: 'In person' }]

export default function Mentoring() {
  const [tab, setTab] = useState('find')
  const sessions = useApi(() => get('/mentoring/sessions', { limit: 50 }).then((r) => r.data))
  const upcoming = (sessions.data ?? []).filter((s) => ['requested', 'confirmed'].includes(s.status) && new Date(s.scheduledAt) >= new Date())

  return (
    <div>
      <PageHeader title="Mentoring" subtitle="Book 1:1 sessions with mentors who have done it before." />
      <Tabs
        tabs={[{ id: 'find', label: 'Find a mentor' }, { id: 'sessions', label: 'My sessions', count: upcoming.length }]}
        value={tab} onChange={setTab}
      />
      {tab === 'find'
        ? <FindMentor onBooked={() => { sessions.reload(); setTab('sessions') }} />
        : <Async state={sessions}>{(list) => <MySessions sessions={list} reload={sessions.reload} />}</Async>}
    </div>
  )
}

function FindMentor({ onBooked }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [expertise, setExpertise] = useState('all')
  const [mentor, setMentor] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const q = useDebounced(query.trim(), 300)

  // GET /api/mentors -> MentorProfile docs with user { _id, name, avatar }
  const state = useApi(() => get('/mentors', {
    limit: 50, q: q || undefined, expertise: expertise === 'all' ? undefined : expertise,
  }).then((r) => r.data.map((p) => ({ ...p, _id: p.user?._id, name: p.user?.name }))), [q, expertise])

  const open = (m) => { setMentor(m); setForm({ topic: '', agenda: '', date: '', time: '', durationMinutes: '30', mode: 'online' }); setError('') }

  const request = async () => {
    if (!form.topic.trim() || !form.date || !form.time) return setError('Topic, date and time are required')
    const scheduledAt = new Date(`${form.date}T${form.time}`)
    if (scheduledAt < new Date(Date.now() + 60 * 60 * 1000)) return setError('Book at least 1 hour in advance')
    setSaving(true)
    try {
      await post('/mentoring/sessions', {
        mentor: mentor._id, topic: form.topic.trim(), agenda: form.agenda.trim() || undefined,
        scheduledAt: scheduledAt.toISOString(), durationMinutes: +form.durationMinutes, mode: form.mode,
      })
      toast(`Request sent to ${mentor.name}`)
      setMentor(null)
      onBooked()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-5 grid gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search mentors" />
        <Chips options={EXPERTISE} value={expertise} onChange={setExpertise} />
      </div>

      <Async state={state}>{(list) => (list.length === 0 ? <Card><Empty>No mentors match these filters.</Empty></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((m) => (
            <Card key={m._id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{m.name}</p>
                  <p className="text-sm text-ink-soft">{[m.designation, m.organization].filter(Boolean).join(', ')}{m.yearsOfExperience != null && ` · ${m.yearsOfExperience} yrs`}</p>
                </div>
                {m.isVerified && <Badge tone="success">Verified</Badge>}
              </div>
              <p className="mt-3 flex-1 text-sm text-ink">{m.bio}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(m.expertise ?? []).map((e) => <Badge key={e} tone="brand">{humanize(e)}</Badge>)}
              </div>
              {m.availability?.length > 0 && (
                <p className="mt-3 text-xs text-ink-soft">Usually free: {m.availability.map((a) => `${humanize(a.day)} ${a.from}-${a.to}`).join(', ')}</p>
              )}
              <div className="mt-5 border-t border-line pt-4">
                <Button size="sm" onClick={() => open(m)}>Request session</Button>
              </div>
            </Card>
          ))}
        </div>
      ))}</Async>

      <Drawer
        open={Boolean(mentor)} title="Request a session" subtitle={mentor && `with ${mentor.name}`} onClose={() => setMentor(null)}
        footer={<><Button variant="ghost" onClick={() => setMentor(null)}>Cancel</Button><Button onClick={request} disabled={saving}>{saving ? 'Sending...' : 'Send request'}</Button></>}
      >
        {form && (
          <div className="grid gap-5">
            <Field label="Topic" htmlFor="stopic" required>
              <TextInput id="stopic" value={form.topic} placeholder="Seed round narrative" onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </Field>
            <Field label="Agenda" htmlFor="sagenda" optional hint="What do you want to walk away with?">
              <Textarea id="sagenda" rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" htmlFor="sdate" required>
                <TextInput id="sdate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Time" htmlFor="stime" required>
                <TextInput id="stime" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </Field>
            </div>
            <Field label="Duration" required>
              <Pills label="Duration" options={DURATIONS} value={form.durationMinutes} onChange={(durationMinutes) => setForm({ ...form, durationMinutes })} />
            </Field>
            <Field label="Mode" required>
              <Pills label="Mode" options={MODES} value={form.mode} onChange={(mode) => setForm({ ...form, mode })} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </>
  )
}

function MySessions({ sessions, reload }) {
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = new Date()
  const upcoming = sessions.filter((s) => ['requested', 'confirmed'].includes(s.status) && new Date(s.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const past = sessions.filter((s) => !upcoming.includes(s)).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

  const act = async (fn, msg) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      setSelected(null)
      toast(msg)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const row = (s) => (
    <li key={s._id}>
      <button type="button" onClick={() => { setSelected(s); setRating(s.feedback?.rating || 0); setComment(''); setError('') }}
        className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-brand-soft/60">
        <div>
          <p className="text-sm font-medium text-ink">{s.topic}</p>
          <p className="text-xs text-ink-soft">{s.mentor?.name} · {formatDateTime(s.scheduledAt)} · {s.durationMinutes} min · {humanize(s.mode)}</p>
        </div>
        <div className="flex items-center gap-2">
          {s.status === 'completed' && !s.feedback?.rating && <Badge tone="warning">Feedback due</Badge>}
          <StatusPill status={s.status} />
        </div>
      </button>
    </li>
  )

  const s = selected
  return (
    <div className="grid gap-6">
      <Card title="Upcoming">
        {upcoming.length ? <ul className="divide-y divide-line">{upcoming.map(row)}</ul> : <Empty>No upcoming sessions.</Empty>}
      </Card>
      <Card title="Past">
        {past.length ? <ul className="divide-y divide-line">{past.map(row)}</ul> : <Empty>No past sessions yet.</Empty>}
      </Card>

      <Drawer
        open={Boolean(s)} title={s?.topic} subtitle={s && `with ${s.mentor?.name}`} onClose={() => setSelected(null)}
        footer={s && (
          <>
            {error && <ErrorText>{error}</ErrorText>}
            {['requested', 'confirmed'].includes(s.status) && (
              <Button variant="danger" className="mr-auto" disabled={busy}
                onClick={() => act(() => patch(`/mentoring/sessions/${s._id}/cancel`, {}), 'Session cancelled')}>Cancel session</Button>
            )}
            {s.status === 'completed' && !s.feedback?.rating && (
              <Button disabled={!rating || busy}
                onClick={() => act(() => post(`/mentoring/sessions/${s._id}/feedback`, { rating, comment: comment.trim() || undefined }), 'Thanks for the feedback')}>Submit feedback</Button>
            )}
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </>
        )}
      >
        {s && (
          <div className="grid gap-5">
            <dl className="grid gap-2">
              <Detail label="Status"><StatusPill status={s.status} /></Detail>
              <Detail label="When">{formatDateTime(s.scheduledAt)} · {relativeDays(s.scheduledAt)}</Detail>
              <Detail label="Duration">{s.durationMinutes} min</Detail>
              <Detail label="Mode">{humanize(s.mode)}</Detail>
              {s.meetingLink && <Detail label="Meeting link"><a href={s.meetingLink} target="_blank" rel="noreferrer" className="text-brand hover:underline">{s.meetingLink}</a></Detail>}
            </dl>
            {s.status === 'requested' && <p className="text-sm text-ink-soft">Waiting for the mentor to confirm.</p>}
            {s.status === 'completed' && (
              s.feedback?.rating ? <p className="text-sm text-ink">You rated this session {s.feedback.rating} out of 5.</p> : (
                <div className="grid gap-4 border-t border-line pt-5">
                  <Field label="How useful was this session?" required>
                    <Pills label="Rating" options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} value={rating} onChange={setRating} />
                  </Field>
                  <Field label="Comment" htmlFor="fcomment" optional>
                    <Textarea id="fcomment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                  </Field>
                </div>
              )
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
