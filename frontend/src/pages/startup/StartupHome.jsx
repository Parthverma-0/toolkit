import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, GraduationCap, HandCoins, Layers, LayoutGrid, SquarePlay, Users } from 'lucide-react'
import { Badge, Card, Empty, IconTile, Progress, Stat } from '../../components/dashboard/Card.jsx'
import { Button } from '../../components/dashboard/ui.jsx'
import { TOOL_ICONS } from '../../constants/tools.js'
import { SECTORS, STAGES } from '../../constants/startup.js'
import Async from '../../components/dashboard/Async.jsx'
import { useStartupProfile } from '../../components/startup/StartupProfile.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import useApi from '../../hooks/useApi.js'
import { fileUrl, get } from '../../api/client.js'
import { formatDate, formatDateTime, formatDuration, humanize, relativeDays, sumValues } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)

// Investor pipeline order, left to right
const PIPELINE = ['requested', 'in_review', 'meeting_scheduled', 'in_discussion', 'invested']

export default function StartupHome() {
  const { version } = useStartupProfile()
  // Reloads after the profile popup creates the startup
  const state = useApi(() => get('/startups/me/dashboard').then((r) => r.data), [version])
  return <Async state={state}>{(data) => <HomeView data={data} />}</Async>
}

function HomeView({ data }) {
  const { startup, incubation, tools, mentoring, videos, investors, grants, events } = data
  const { user } = useAuth()
  const { requireProfile, openProfileForm } = useStartupProfile()
  const navigate = useNavigate()
  const toolsUsed = tools.filter((t) => t.runs > 0).length
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="grid gap-6">
      {startup ? (
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-5">
            {startup.logo
              ? <img src={fileUrl(startup.logo)} alt="" className="size-16 rounded-xl border border-line object-cover" />
              : <span className="flex size-16 items-center justify-center rounded-xl bg-brand font-display text-2xl font-bold text-white">{startup.name[0]?.toUpperCase()}</span>}
            <div>
              <h1 className="font-display text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">{startup.name}</h1>
              <p className="mt-1.5 text-lg text-ink-soft">{labelOf(SECTORS, startup.sector)} · {labelOf(STAGES, startup.stage)}</p>
            </div>
          </div>
          <Link to="/startup/profile" className="rounded-xl border border-line bg-surface px-5 py-2.5 text-base font-semibold text-ink hover:border-glow">
            Edit profile
          </Link>
        </header>
      ) : (
        <>
          <header className="mb-5">
            <span aria-hidden="true" className="mb-4 block h-1 w-[47px] rounded-full bg-brand" />
            <h1 className="font-display text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">
              Welcome{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2.5 text-lg text-ink-soft">Explore ToolKit. Add your startup details when you are ready to use the tools.</p>
          </header>
          <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-brand/30 bg-brand-soft px-6 py-5">
            <div className="max-w-2xl">
              <h2 className="font-display text-xl font-bold text-ink">Complete your startup profile</h2>
              <p className="mt-1 text-base text-ink-soft">
                Just your startup name, email, sector and stage. It unlocks the tools, mentoring sessions, investor connections and applications.
              </p>
            </div>
            <Button onClick={() => openProfileForm('action')}>Complete profile</Button>
          </section>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Incubation" icon={Layers} to="/startup/incubation" linkLabel="Open" className="lg:col-span-2">
          {incubation ? (
            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-lg font-semibold text-ink">{incubation.cohort.name}</p>
                <p className="text-sm text-ink-soft">
                  {incubation.cohort.incubator.name} · ends {formatDate(incubation.cohort.endDate)}
                </p>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-ink-soft">Milestones</span>
                    <span className="font-medium text-ink">{incubation.milestones.done} of {incubation.milestones.total}</span>
                  </div>
                  <Progress value={incubation.milestones.done} total={incubation.milestones.total} />
                </div>
              </div>
              <Badge tone={incubation.agreementSigned ? 'success' : 'neutral'}>
                {incubation.agreementSigned ? 'Agreement signed' : 'Agreement pending'}
              </Badge>
            </div>
          ) : (
            <Empty>You are not part of a cohort yet. Apply to an incubator program to get started.</Empty>
          )}
        </Card>

        <Card title="Next session" icon={GraduationCap} to="/startup/mentoring">
          {mentoring.next ? (
            <>
              <p className="text-lg font-semibold text-ink">{mentoring.next.mentor.name}</p>
              <p className="text-sm text-ink-soft">
                {formatDateTime(mentoring.next.scheduledAt)} · {relativeDays(mentoring.next.scheduledAt)}
              </p>
              <p className="mt-4 text-sm text-ink-soft">{mentoring.upcoming} upcoming in total</p>
            </>
          ) : (
            <Empty>No sessions booked. Browse mentors to request one.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card title="Grants" icon={HandCoins} to="/startup/grants">
          <div className="flex gap-8">
            <Stat value={grants.openForYou} label="Open for you" />
            <Stat value={sumValues(grants.myApplications)} label="Applications" />
          </div>
        </Card>
        <Card title="Investors" icon={Users} to="/startup/investors">
          <Stat value={sumValues(investors.pipeline)} label="Active connections" />
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {PIPELINE.filter((s) => investors.pipeline[s]).map((s) => (
              <li key={s}><Badge>{humanize(s)} · {investors.pipeline[s]}</Badge></li>
            ))}
          </ul>
        </Card>
        <Card title="Events" icon={CalendarDays} to="/startup/events">
          {events.next ? (
            <>
              <p className="font-semibold text-ink">{events.next.title}</p>
              <p className="text-sm text-ink-soft">{formatDateTime(events.next.startsAt)} · {humanize(events.next.mode)}</p>
              <p className="mt-4 text-sm text-ink-soft">{events.upcomingRegistered} registered</p>
            </>
          ) : (
            <Empty>You have not registered for any upcoming events.</Empty>
          )}
        </Card>
      </div>

      <Card title="Tools" icon={LayoutGrid} to="/startup/tools">
        <p className="mb-4 text-sm text-ink-soft">
          {toolsUsed ? `${toolsUsed} of ${tools.length} tools used` : 'Turn your inputs into formal reports: plans, analyses and projections.'}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
          {tools.map((t) => (
            <li key={t.type}>
              <button type="button" onClick={() => requireProfile(() => navigate(`/startup/tools/${t.type}`), 'tool')}
                className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition hover:border-glow">
                {TOOL_ICONS[t.type] && <IconTile icon={TOOL_ICONS[t.type]} size="sm" />}
                <span className="flex-1 text-base font-medium text-ink">{t.name}</span>
                {t.status === 'available'
                  ? <span className="text-xs text-ink-soft">{t.runs ? `${t.runs} runs` : 'Try it'}</span>
                  : <Badge>Soon</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Latest videos" icon={SquarePlay} to="/startup/videos">
        <ul className="divide-y divide-line">
          {videos.latest.map((v) => (
            <li key={v._id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">{v.title}</p>
                <p className="text-xs text-ink-soft">{v.mentor.name} · {humanize(v.category)}</p>
              </div>
              <span className="text-xs text-ink-soft">{formatDuration(v.durationSeconds)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
