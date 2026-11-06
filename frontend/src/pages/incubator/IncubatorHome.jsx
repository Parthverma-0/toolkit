import { BellRing, ChartColumn, Filter, Layers, PieChart, Rocket, Wallet, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty, Progress, Stat } from '../../components/dashboard/Card.jsx'
import Async from '../../components/dashboard/Async.jsx'
import HBarList from '../../components/dashboard/HBarList.jsx'
import { Chips, PageHeader, StatusPill } from '../../components/dashboard/ui.jsx'
import { SECTORS } from '../../constants/startup.js'
import useApi from '../../hooks/useApi.js'
import { get } from '../../api/client.js'
import { formatDate, formatINRShort, humanize, relativeDays } from '../../utils/format.js'

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? humanize(id)
const FUNNEL_LABELS = {
  ic_profile_viewed: 'Viewed your profile', founder_signed_up: 'Founder signed up', startup_profile_completed: 'Completed startup profile',
  cohort_applied: 'Applied to a cohort', shortlisted: 'Shortlisted', enrolled: 'Enrolled',
}
const SCOPES = [{ id: 'active', label: 'Active startups' }, { id: 'all', label: 'All time' }]

const sum = (obj = {}, keys) => keys.reduce((n, k) => n + (obj[k] || 0), 0)

export default function IncubatorHome() {
  const [scope, setScope] = useState('active')
  const dash = useApi(() => get('/incubators/me/dashboard', { scope }).then((r) => r.data), [scope])
  // Incubator profile, active cohorts (with application / enrollment counts) and unverified achievements
  const side = useApi(async () => {
    const [inc, cohortList, pending] = await Promise.all([
      get('/incubators/me'), get('/incubators/me/cohorts'), get('/incubators/me/achievements', { verified: false }),
    ])
    const active = cohortList.data.filter((c) => ['ongoing', 'registration_open'].includes(c.status))
    const detailed = await Promise.all(active.map((c) => get(`/incubators/me/cohorts/${c._id}`).then((r) => r.data)))
    return { incubator: inc.data, cohorts: detailed, pendingAchievements: pending.data.length }
  })

  return (
    <Async state={side}>
      {(extra) => (
        <div className="grid gap-6">
          <PageHeader title={extra.incubator.name}
            subtitle={[`${humanize(extra.incubator.type)} incubator`, extra.incubator.address?.city].filter(Boolean).join(' · ')}
            action={<Chips options={SCOPES} value={scope} onChange={setScope} />} />
          <Async state={dash}>{(d) => <Overview d={d} scope={scope} {...extra} />}</Async>
        </div>
      )}
    </Async>
  )
}

function Overview({ d, scope, cohorts, pendingAchievements }) {
  const openCohort = cohorts.find((c) => c.status === 'registration_open')
  const pendingApps = cohorts.reduce((n, c) => n + sum(c.stats?.applications, ['submitted', 'under_review']), 0)

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card><Stat icon={Rocket} value={scope === 'active' ? d.startups.active : d.startups.total} label={scope === 'active' ? 'Active startups' : 'Startups incubated'} /></Card>
        <Card><Stat icon={Layers} value={d.cohorts.total} label={`Cohorts · ${d.cohorts.byStatus.ongoing || 0} ongoing`} /></Card>
        <Card><Stat icon={Wallet} value={formatINRShort(d.funding.availableBalance)} label="IC fund balance" /></Card>
        <Card><Stat icon={TrendingUp} value={formatINRShort(d.funding.externalFunding.total)} label="External funding raised by startups" /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Needs your attention" icon={BellRing} className="lg:col-span-1">
          <ul className="divide-y divide-line">
            <AttentionRow to={openCohort ? `/incubator/cohorts/${openCohort._id}` : '/incubator/cohorts'} count={pendingApps} label="Applications to review" />
            <AttentionRow to="/incubator/achievements" count={pendingAchievements} label="Achievements to verify" />
            <AttentionRow to="/incubator/team" count={d.seats.limit - d.seats.used} label="Team seats free" muted />
          </ul>
        </Card>
        <Card title="Application funnel" icon={Filter} className="lg:col-span-2">
          <HBarList ariaLabel="Application funnel" rows={d.funnel.map((f) => ({
            label: FUNNEL_LABELS[f.stage], value: f.count, note: f.conversionFromPrevious == null ? undefined : `${f.conversionFromPrevious}% of previous`,
          }))} format={(v) => v.toLocaleString('en-IN')} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Revenue by startup" icon={ChartColumn} className="lg:col-span-2" to="/incubator/startups">
          <p className="mb-4 text-sm text-ink-soft">{formatINRShort(d.revenue.total)} total across incubated startups</p>
          {d.revenue.byStartup.length === 0 ? <Empty>Revenue appears once your startups record monthly metrics.</Empty> : <HBarList ariaLabel="Revenue by startup" rows={[...d.revenue.byStartup].sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map((r) => ({ label: r.startup?.name ?? 'Startup', value: r.totalRevenue }))} format={formatINRShort} />}
        </Card>
        <Card title="Sectors" icon={PieChart}>
          {d.sectorBifurcation.length === 0 ? <Empty>No startups yet.</Empty> : <HBarList ariaLabel="Startups by sector" rows={d.sectorBifurcation.map((s) => ({ label: labelOf(SECTORS, s.sector), value: s.count }))} />}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cohorts" icon={Layers} to="/incubator/cohorts">
          {cohorts.length === 0 ? <Empty>No open or ongoing cohorts.</Empty> : <ul className="divide-y divide-line">
            {cohorts.map((c) => (
              <li key={c._id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/incubator/cohorts/${c._id}`} className="text-sm font-medium text-ink hover:text-brand">{c.name}</Link>
                  <StatusPill status={c.status} />
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {c.status === 'registration_open'
                    ? `${sum(c.stats?.applications, Object.keys(c.stats?.applications ?? {}))} applications${c.registrationForm?.closesAt ? ` · closes ${formatDate(c.registrationForm.closesAt)} (${relativeDays(c.registrationForm.closesAt)})` : ''}`
                    : `${sum(c.stats?.enrollments, ['active'])} startups · ends ${formatDate(c.endDate)}`}
                </p>
              </li>
            ))}
          </ul>}
        </Card>
        <Card title="Fund flow" icon={ArrowLeftRight} to="/incubator/funding">
          <div className="grid gap-4">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-ink-soft">Distributed of raised</span>
                <span className="font-medium text-ink">{formatINRShort(d.funding.fundDistributed.total)} of {formatINRShort(d.funding.fundRaised.total)}</span>
              </div>
              <Progress value={d.funding.fundDistributed.total} total={d.funding.fundRaised.total} />
            </div>
            <p className="text-sm text-ink-soft">
              {d.funding.fundDistributed.count} disbursements to startups · {d.funding.fundRaised.count} funding sources
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}

function AttentionRow({ to, count, label, muted }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between gap-3 py-3 first:pt-0 hover:text-brand">
        <span className="text-sm text-ink">{label}</span>
        <span className={`font-display text-lg font-bold ${count && !muted ? 'text-brand' : 'text-ink-soft'}`}>{count}</span>
      </Link>
    </li>
  )
}
