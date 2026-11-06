import { CalendarDays, CalendarClock, Eye, Inbox, MessagesSquare, SquarePlay, Star, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { PageHeader, StatusPill } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import useApi from '../../hooks/useApi.js'
import { get } from '../../api/client.js'
import { formatDateTime, humanize, relativeDays } from '../../utils/format.js'

export default function MentorHome() {
  const state = useApi(async () => {
    const [profile, sessions, videos, events] = await Promise.all([
      get('/mentors/me/profile'), get('/mentoring/sessions', { limit: 50 }), get('/videos/mine', { limit: 50 }), get('/events/mine'),
    ])
    return { profile: profile.data ?? {}, sessions: sessions.data, videos: videos.data, events: events.data }
  })
  return <Async state={state}>{(data) => <HomeView {...data} />}</Async>
}

function HomeView({ profile, sessions: mentorSessions, videos: mentorVideos, events: mentorEvents }) {
  const { user } = useAuth()
  const now = new Date()
  const requests = mentorSessions.filter((s) => s.status === 'requested')
  const upcoming = mentorSessions.filter((s) => s.status === 'confirmed' && new Date(s.scheduledAt) >= now).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const completed = mentorSessions.filter((s) => s.status === 'completed')
  const rated = completed.filter((s) => s.feedback?.rating)
  const avg = rated.length ? (rated.reduce((s, x) => s + x.feedback.rating, 0) / rated.length).toFixed(1) : '-'
  const published = mentorVideos.filter((v) => v.status === 'published')
  const views = published.reduce((s, v) => s + (v.views ?? 0), 0)
  const nextEvent = [...mentorEvents].filter((e) => e.status === 'published' && new Date(e.startsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0]

  return (
    <div className="grid gap-6">
      <PageHeader title={`Welcome back, ${(user?.name ?? '').split(' ')[0]}`} subtitle={[profile.designation, profile.organization].filter(Boolean).join(', ')} />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card><Stat icon={MessagesSquare} value={requests.length} label="Requests waiting" /></Card>
        <Card><Stat icon={CircleCheck} value={completed.length} label="Sessions completed" /></Card>
        <Card><Stat icon={Star} value={avg} label={`Average rating · ${rated.length} reviews`} /></Card>
        <Card><Stat icon={Eye} value={views.toLocaleString('en-IN')} label={`Video views · ${published.length} published`} /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Session requests" icon={Inbox} to="/mentor/sessions" linkLabel="Review">
          {requests.length === 0 ? <Empty>No new requests.</Empty> : (
            <ul className="divide-y divide-line">
              {requests.map((s) => (
                <li key={s._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{s.topic}</p>
                    <p className="text-xs text-ink-soft">{s.startup?.name} · {formatDateTime(s.scheduledAt)} · {s.durationMinutes} min</p>
                  </div>
                  <StatusPill status="requested" />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming sessions" icon={CalendarClock} to="/mentor/sessions">
          {upcoming.length === 0 ? <Empty>Nothing confirmed yet.</Empty> : (
            <ul className="divide-y divide-line">
              {upcoming.map((s) => (
                <li key={s._id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-ink">{s.startup?.name} · {s.topic}</p>
                  <p className="text-xs text-ink-soft">{formatDateTime(s.scheduledAt)} · {relativeDays(s.scheduledAt)} · {humanize(s.mode)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your videos" icon={SquarePlay} to="/mentor/videos">
          {mentorVideos.length === 0 ? <Empty>Upload your first video to reach founders.</Empty> : <ul className="divide-y divide-line">
            {mentorVideos.slice(0, 5).map((v) => (
              <li key={v._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink">{v.title}</p>
                  <p className="text-xs text-ink-soft">{v.status === 'published' ? `${(v.views ?? 0).toLocaleString('en-IN')} views · ${v.likesCount ?? 0} likes` : 'Not published'}</p>
                </div>
                <StatusPill status={v.status === 'published' ? 'open' : 'draft'} label={humanize(v.status)} />
              </li>
            ))}
          </ul>}
        </Card>
        <Card title="Next event" icon={CalendarDays} to="/mentor/events">
          {nextEvent ? (
            <>
              <p className="text-lg font-semibold text-ink">{nextEvent.title}</p>
              <p className="text-sm text-ink-soft">{formatDateTime(nextEvent.startsAt)} · {relativeDays(nextEvent.startsAt)}</p>
              <p className="mt-3 text-sm text-ink">You are hosting this {humanize(nextEvent.type).toLowerCase()}.</p>
            </>
          ) : <Empty>No upcoming events.</Empty>}
          <Link to="/mentor/profile" className="mt-5 block border-t border-line pt-4 text-sm font-medium text-brand hover:text-brand-dark">Update your availability</Link>
        </Card>
      </div>
    </div>
  )
}
