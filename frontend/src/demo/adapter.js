// Axios adapter for demo mode: answers every API call from in-memory sample data,
// so the whole app can be explored without a backend. Changes last until the page reloads.
import { AxiosError } from 'axios'
import { TOOLS } from '../constants/tools.js'
import { createDb, users } from './data.js'
import { demoRole, endDemo } from './session.js'

let db = createDb()
let seq = 0
const newId = (p = 'x') => `${p}-demo-${++seq}`
const now = () => new Date().toISOString()

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => { throw new HttpError(status, message) }

const ok = (data, extra = {}) => ({ success: true, data, ...extra })
const find = (list, id) => list.find((x) => x._id === id) ?? fail(404, 'Not found in the demo data')
const update = (list, id, patch) => Object.assign(find(list, id), patch)
const remove = (list, id) => {
  const i = list.findIndex((x) => x._id === id)
  if (i >= 0) list.splice(i, 1)
  return ok(null, { message: 'Deleted' })
}
const count = (list, key = 'status') => list.reduce((m, x) => ({ ...m, [x[key]]: (m[x[key]] || 0) + 1 }), {})
const matches = (q, ...fields) => !q || fields.some((f) => String(f ?? '').toLowerCase().includes(String(q).toLowerCase()))
const upcoming = (iso) => new Date(iso) >= new Date()

// FormData / JSON body -> plain object ("address.city" keys become nested, JSON strings parsed)
function parseBody(data) {
  if (!data) return {}
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return {} }
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const out = {}
    for (const [key, raw] of data.entries()) {
      let value = raw
      if (typeof raw === 'string' && /^[[{]/.test(raw)) {
        try { value = JSON.parse(raw) } catch { /* keep string */ }
      }
      if (typeof File !== 'undefined' && raw instanceof File) value = { name: raw.name, url: '#' }
      const path = key.split('.')
      let node = out
      path.slice(0, -1).forEach((k) => { node = node[k] ??= {} })
      const last = path.at(-1)
      node[last] = last in node ? [].concat(node[last], value) : value
    }
    return out
  }
  return data
}

// ---------- derived views ----------
const myStartupId = 's1'
const enrollmentsOf = (startupId) => db.enrollments.filter((e) => e.startup === startupId)
const sessionsFor = (role) => db.sessions.filter((s) => (role === 'mentor' ? s.mentor._id === 'u-mentor' : s.startup._id === myStartupId))

function startupRow(s) {
  const ens = enrollmentsOf(s._id)
  const latest = ens[0]
  const fundingBy = db.funding.filter((f) => f.startup?._id === s._id)
    .reduce((m, f) => ({ ...m, [f.type]: (m[f.type] || 0) + f.amount }), {})
  return {
    startup: db.ref(s), latestEnrollment: latest && { _id: latest._id, status: latest.status, onboardedAt: latest.onboardedAt },
    cohort: latest && { name: latest.cohort.name }, cohortCount: ens.length, firstOnboardedAt: latest?.onboardedAt,
    funding: fundingBy, achievements: db.achievements.filter((a) => a.startup._id === s._id).length,
  }
}

function fundingTotals() {
  const sum = (t) => db.funding.filter((f) => f.type === t)
  const agg = (t) => ({ total: sum(t).reduce((n, f) => n + f.amount, 0), count: sum(t).length })
  return { fundRaised: agg('ic_fund_raised'), fundDistributed: agg('ic_fund_distributed'), externalFunding: agg('external_funding'), availableBalance: agg('ic_fund_raised').total - agg('ic_fund_distributed').total }
}

function incubatorDashboard() {
  const enrolled = db.startups.filter((s) => enrollmentsOf(s._id).length)
  const active = db.enrollments.filter((e) => e.status === 'active').length
  const revenueOf = (id) => (id === myStartupId ? db.metrics.reduce((n, m) => n + m.revenue, 0) : { s3: 3200000, s5: 1450000 }[id] || 0)
  const byStartup = enrolled.map((s) => ({ startup: { _id: s._id, name: s.name }, totalRevenue: revenueOf(s._id) })).sort((a, b) => b.totalRevenue - a.totalRevenue)
  return {
    cohorts: { total: db.cohorts.length, byStatus: count(db.cohorts) },
    startups: { total: enrolled.length, active },
    funding: fundingTotals(),
    seats: { used: db.members.length, limit: db.incubator.seats.limit },
    funnel: [
      { stage: 'Visited cohort page', count: 1840 }, { stage: 'Started application', count: 310, conversionFromPrevious: 16.8 },
      { stage: 'Submitted', count: 142, conversionFromPrevious: 45.8 }, { stage: 'Shortlisted', count: 31, conversionFromPrevious: 21.8 },
      { stage: 'Enrolled', count: 15, conversionFromPrevious: 48.4 },
    ],
    sectorBifurcation: Object.entries(count(enrolled, 'sector')).map(([sector, n]) => ({ sector, count: n })),
    revenue: { total: byStartup.reduce((n, r) => n + r.totalRevenue, 0), byStartup },
  }
}

function startupDashboard() {
  const startup = db.S[myStartupId]
  const enr = enrollmentsOf(myStartupId).find((e) => e.status === 'active')
  const mine = sessionsFor('startup').filter((s) => ['requested', 'confirmed'].includes(s.status) && upcoming(s.scheduledAt))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const regs = db.registrations.filter((r) => r.status === 'registered' && upcoming(r.event.startsAt))
  return {
    startup,
    incubation: enr && {
      cohort: enr.cohort,
      milestones: { done: enr.milestones.filter((m) => m.status === 'completed').length, total: enr.milestones.length },
      agreementSigned: Boolean(enr.agreement?.isSigned),
    },
    tools: TOOLS.map((t) => ({ type: t.type, name: t.name, ...(db.tools.find((x) => x.type === t.type) ?? { status: 'coming_soon', runs: 0 }) })),
    mentoring: { next: mine[0], upcoming: mine.length },
    videos: { latest: db.videos.filter((v) => v.status === 'published').slice(0, 4) },
    investors: { pipeline: count(db.connections) },
    grants: { openForYou: db.grants.filter((g) => g.isAcceptingApplications).length, myApplications: count(db.grantApplications) },
    events: { next: regs.map((r) => r.event).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0], upcomingRegistered: regs.length },
  }
}

const reportFile = (r, fileType) => new Blob(
  [`ToolKit demo report\n\n${r.title}\nType: ${r.type}\nGenerated: ${r.createdAt}\n\nThis is sample output. Real reports are generated by the backend as ${fileType.toUpperCase()}.`],
  { type: 'text/plain' },
)

// ---------- routes: [METHOD, path, handler({ params, query, body, role })] ----------
const routes = [
  // auth
  ['GET', '/auth/me', ({ role }) => (users[role] ? { success: true, user: users[role], needsOnboarding: false } : fail(401, 'Not signed in'))],
  ['POST', '/auth/logout', () => { endDemo(); db = createDb(); return ok(null) }],
  ['POST', '/auth/refresh', () => fail(401, 'Demo session')],
  ['POST', '/auth/google', () => fail(400, 'Google sign-in is off in the demo. Sign out of the demo first.')],
  ['POST', '/auth/otp/send', () => ok({ sent: true }, { message: 'Demo: use any 6-digit code' })],
  ['POST', '/auth/otp/verify', ({ body }) => ok({ verified: true, phone: body.target, email: body.target })],

  // startup self
  ['GET', '/startups/me', () => ok({ ...db.S[myStartupId], founders: db.founders })],
  ['PATCH', '/startups/me', ({ body }) => ok(Object.assign(db.S[myStartupId], body, { logo: db.S[myStartupId].logo }))],
  ['GET', '/startups/me/dashboard', () => ok(startupDashboard())],
  ['PUT', '/startups/me/founders/primary', ({ body }) => ok(Object.assign(db.founders.find((f) => f.isPrimary), body))],
  ['POST', '/startups/me/founders', ({ body }) => { const f = { _id: newId('f'), isPrimary: false, ...body }; db.founders.push(f); return ok(f) }],
  ['PATCH', '/startups/me/founders/:id', ({ params, body }) => ok(update(db.founders, params.id, body))],
  ['DELETE', '/startups/me/founders/:id', ({ params }) => remove(db.founders, params.id)],
  ['GET', '/startups/me/enrollments', () => ok(enrollmentsOf(myStartupId))],
  ['GET', '/startups/me/enrollments/:id', ({ params }) => ok(find(db.enrollments, params.id))],
  ['PATCH', '/startups/me/enrollments/:id/milestones/:mid', ({ params, body }) => ok(update(find(db.enrollments, params.id).milestones, params.mid, body))],
  ['PATCH', '/startups/me/enrollments/:id/checklist/:cid', ({ params, body }) => ok(update(find(db.enrollments, params.id).marketingChecklist, params.cid, body))],
  ['GET', '/startups/me/metrics', () => ok(db.metrics)],
  ['POST', '/startups/me/metrics', ({ body }) => {
    const period = { month: body.month, year: body.year }
    const row = { _id: newId('mt'), period, revenue: body.revenue, expenses: body.expenses, customers: body.customers ?? 0, employees: body.employees ?? 0 }
    db.metrics = db.metrics.filter((m) => m.period.month !== period.month || m.period.year !== period.year)
    db.metrics.push(row)
    db.metrics.sort((a, b) => a.period.year - b.period.year || a.period.month - b.period.month)
    return ok(row)
  }],
  ['GET', '/startups/me/achievements', () => ok(db.achievements.filter((a) => a.startup._id === myStartupId))],
  ['POST', '/startups/me/achievements', ({ body }) => { const a = { _id: newId('a'), ...body, startup: { _id: myStartupId, name: db.S[myStartupId].name }, isVerified: false }; db.achievements.unshift(a); return ok(a) }],
  ['DELETE', '/startups/me/achievements/:id', ({ params }) => remove(db.achievements, params.id)],
  ['GET', '/startups/me/applications', () => ok(db.myApplications)],
  ['POST', '/startups/me/applications/:id/withdraw', ({ params }) => ok(update(db.myApplications, params.id, { status: 'withdrawn' }))],

  // public cohorts
  ['GET', '/cohorts', () => ok(db.cohorts.filter((c) => c.status === 'registration_open'))],
  ['GET', '/cohorts/:id', ({ params }) => {
    const c = find(db.cohorts, params.id)
    return ok({ ...c, myApplication: db.myApplications.find((a) => a.cohort._id === c._id) })
  }],
  ['POST', '/cohorts/:id/apply', ({ params }) => {
    const c = find(db.cohorts, params.id)
    const a = { _id: newId('ap'), cohort: { _id: c._id, name: c.name, incubator: c.incubator }, status: 'submitted', createdAt: now() }
    db.myApplications.unshift(a)
    return ok(a)
  }],

  // mentoring
  ['GET', '/mentors', ({ query }) => ok(db.mentors.filter((m) => matches(query.q, m.user.name, m.bio, m.organization) && (!query.expertise || m.expertise.includes(query.expertise))))],
  ['GET', '/mentors/me/profile', () => ok(db.mentorProfile)],
  ['PUT', '/mentors/me/profile', ({ body }) => ok(Object.assign(db.mentorProfile, body))],
  ['GET', '/mentoring/sessions', ({ role }) => ok(sessionsFor(role))],
  ['POST', '/mentoring/sessions', ({ body }) => {
    const m = db.mentors.find((x) => x.user._id === body.mentor)
    const s = { _id: newId('ms'), ...body, mentor: { _id: body.mentor, name: m?.user.name }, startup: { _id: myStartupId, name: db.S[myStartupId].name }, status: 'requested' }
    db.sessions.push(s)
    return ok(s)
  }],
  ['PATCH', '/mentoring/sessions/:id/:action', ({ params, body }) => {
    const status = { confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled', complete: 'completed' }[params.action] ?? fail(400, 'Unknown action')
    return ok(update(db.sessions, params.id, { ...body, status }))
  }],
  ['POST', '/mentoring/sessions/:id/feedback', ({ params, body }) => ok(update(db.sessions, params.id, { feedback: body }))],

  // videos
  ['GET', '/videos', ({ query }) => ok(db.videos.filter((v) => v.status === 'published' && matches(query.q, v.title, v.description) && (!query.category || v.category === query.category)).slice(0, query.limit || 50))],
  ['GET', '/videos/mine', () => ok(db.videos.filter((v) => v.mentor._id === 'u-mentor'))],
  ['GET', '/videos/:id', ({ params }) => ok(find(db.videos, params.id))],
  ['POST', '/videos/:id/like', ({ params }) => {
    const v = find(db.videos, params.id)
    v.likedByMe = !v.likedByMe
    v.likesCount += v.likedByMe ? 1 : -1
    return ok({ likedByMe: v.likedByMe, likesCount: v.likesCount })
  }],
  ['POST', '/videos', ({ body }) => {
    const v = { _id: newId('v'), views: 0, likesCount: 0, tags: [], status: 'draft', mentor: { _id: 'u-mentor', name: users.mentor.name }, sourceType: body.externalUrl ? 'external' : 'upload', videoUrl: body.externalUrl || db.videos[0].videoUrl, ...body, durationSeconds: +body.durationSeconds || 0 }
    db.videos.unshift(v)
    return ok(v)
  }],
  ['PATCH', '/videos/:id', ({ params, body }) => ok(update(db.videos, params.id, { ...body, ...(body.status === 'published' && { publishedAt: now() }) }))],
  ['DELETE', '/videos/:id', ({ params }) => remove(db.videos, params.id)],

  // investors
  ['GET', '/investors', ({ query }) => ok(db.investors.filter((i) => matches(query.q, i.name, i.firm, i.about) && (!query.type || i.type === query.type)))],
  ['GET', '/investors/connections', () => ok(db.connections)],
  ['POST', '/investors/:id/connect', ({ params, body }) => {
    const i = find(db.investors, params.id)
    const c = { _id: newId('ic'), investor: { _id: i._id, name: i.name, type: i.type }, status: 'requested', createdAt: now(), ...body }
    db.connections.unshift(c)
    return ok(c)
  }],
  ['DELETE', '/investors/connections/:id', ({ params }) => remove(db.connections, params.id)],

  // grants
  ['GET', '/grants', ({ query }) => ok(db.grants.filter((g) => !query.providerType || g.providerType === query.providerType))],
  ['GET', '/grants/applications/mine', () => ok(db.grantApplications)],
  ['GET', '/grants/:id', ({ params }) => {
    const g = find(db.grants, params.id)
    return ok({ ...g, myApplication: db.grantApplications.find((a) => a.grant._id === g._id) })
  }],
  ['POST', '/grants/:id/applications', ({ params, body }) => {
    const g = find(db.grants, params.id)
    const a = { _id: newId('ga'), grant: { _id: g._id, title: g.title, provider: g.provider }, status: body.status === 'draft' ? 'draft' : 'submitted', updatedAt: now(), ...body, amountRequested: +body.amountRequested || undefined }
    db.grantApplications.unshift(a)
    return ok(a)
  }],
  ['PATCH', '/grants/applications/:id', ({ params, body }) => ok(update(db.grantApplications, params.id, { ...body, updatedAt: now(), amountRequested: +body.amountRequested || undefined }))],
  ['DELETE', '/grants/applications/:id', ({ params }) => remove(db.grantApplications, params.id)],

  // events
  ['GET', '/events', ({ query }) => ok(db.events.filter((e) => e.status === 'published' && upcoming(e.endsAt) && (!query.type || e.type === query.type)))],
  ['GET', '/events/mine', ({ role }) => ok(db.events.filter((e) => (role === 'mentor' ? e.host === 'mentor' : e.host !== 'mentor')))],
  ['GET', '/events/registrations/mine', () => ok(db.registrations)],
  ['GET', '/events/:id', ({ params }) => {
    const e = find(db.events, params.id)
    return ok({ ...e, myRegistration: db.registrations.find((r) => r.event._id === e._id && r.status === 'registered') })
  }],
  ['POST', '/events/:id/register', ({ params }) => {
    const e = find(db.events, params.id)
    const r = { _id: newId('er'), event: e, status: 'registered', user: { name: users.startup.name, email: users.startup.email }, startup: { name: db.S[myStartupId].name } }
    db.registrations.push(r)
    e.seatsLeft = Math.max(0, (e.seatsLeft ?? 1) - 1)
    return ok(r)
  }],
  ['DELETE', '/events/:id/register', ({ params }) => {
    db.registrations = db.registrations.filter((r) => r.event._id !== params.id)
    return ok(null)
  }],
  ['GET', '/events/:id/registrations', ({ params }) => ok(db.registrations.filter((r) => r.event._id === params.id))],
  ['PATCH', '/events/:id/registrations/:rid', ({ params, body }) => ok(update(db.registrations, params.rid, body))],
  ['POST', '/events', ({ body, role }) => {
    const e = { _id: newId('ev'), status: 'draft', seatsLeft: +body.capacity || undefined, organizer: { name: role === 'mentor' ? users.mentor.name : db.incubator.name }, host: role === 'mentor' ? 'mentor' : undefined, ...body }
    db.events.push(e)
    return ok(e)
  }],
  ['PATCH', '/events/:id/status', ({ params, body }) => ok(update(db.events, params.id, { status: body.status }))],
  ['PATCH', '/events/:id', ({ params, body }) => ok(update(db.events, params.id, body))],
  ['DELETE', '/events/:id', ({ params }) => remove(db.events, params.id)],

  ['GET', '/tools', () => ok(db.tools)],

  // incubator
  ['GET', '/incubators/me', () => ok(db.incubator)],
  ['GET', '/incubators/me/dashboard', () => ok(incubatorDashboard())],
  ['GET', '/incubators/me/programs', () => ok(db.programs)],
  ['GET', '/incubators/me/members', () => ok(db.members, { seats: { used: db.members.length, limit: db.incubator.seats.limit, available: db.incubator.seats.limit - db.members.length } })],
  ['POST', '/incubators/me/members', ({ body }) => {
    if (db.members.length >= db.incubator.seats.limit) fail(400, 'All seats are used')
    const m = { _id: newId('u'), ...body, incubatorRole: 'member', status: 'invited', createdAt: now() }
    db.members.push(m)
    return ok(m)
  }],
  ['POST', '/incubators/me/members/:id/resend-invite', () => ok(null)],
  ['DELETE', '/incubators/me/members/:id', ({ params }) => remove(db.members, params.id)],

  ['GET', '/incubators/me/cohorts', ({ query }) => ok(db.cohorts.filter((c) => !query.status || c.status === query.status))],
  ['POST', '/incubators/me/cohorts', ({ body }) => {
    const c = { _id: newId('c'), status: 'draft', incubator: { _id: 'inc1', name: db.incubator.name }, stats: { applications: {}, enrollments: {} }, eligibilityCriteria: [], milestoneChecklist: [], marketing: { checklist: [] }, registrationForm: { fields: [] }, ...body }
    db.cohorts.unshift(c)
    return ok(c)
  }],
  ['GET', '/incubators/me/cohorts/:id', ({ params }) => ok(find(db.cohorts, params.id))],
  ['PATCH', '/incubators/me/cohorts/:id/status', ({ params, body }) => ok(update(db.cohorts, params.id, { status: body.status, isRegistrationOpen: body.status === 'registration_open' }))],
  ['PATCH', '/incubators/me/cohorts/:id', ({ params, body }) => ok(update(db.cohorts, params.id, body))],
  ['DELETE', '/incubators/me/cohorts/:id', ({ params }) => remove(db.cohorts, params.id)],
  ['GET', '/incubators/me/cohorts/:id/applications', ({ params }) => ok(db.applications.filter((a) => a.cohort._id === params.id))],
  ['GET', '/incubators/me/applications/:id', ({ params }) => ok(find(db.applications, params.id))],
  ['PATCH', '/incubators/me/applications/:id/review', ({ params, body }) => ok(update(db.applications, params.id, body))],
  ['POST', '/incubators/me/cohorts/:id/enrollments', ({ params, body }) => {
    const a = update(db.applications, body.applicationId, { status: 'accepted' })
    const c = find(db.cohorts, params.id)
    const e = { _id: newId('e'), startup: a.startup._id, cohort: { _id: c._id, name: c.name, startDate: c.startDate, endDate: c.endDate, incubator: c.incubator }, status: 'active', onboardedAt: now(), milestones: [], marketingChecklist: [], agreement: { isSigned: false } }
    db.enrollments.push(e)
    return ok(e)
  }],

  ['GET', '/incubators/me/startups', ({ query }) => ok(db.startups.filter((s) => enrollmentsOf(s._id).length).map(startupRow)
    .filter((r) => matches(query.q, r.startup.name, r.startup.tagline) && (!query.status || r.latestEnrollment?.status === query.status) && (!query.sector || r.startup.sector === query.sector)))],
  ['GET', '/incubators/me/startups/:id', ({ params }) => {
    const startup = find(db.startups, params.id)
    return ok({
      startup, founders: params.id === myStartupId ? db.founders : [{ _id: `${params.id}-f`, fullName: 'Founder', designation: 'CEO', email: startup.startupEmail, isPrimary: true }],
      enrollments: enrollmentsOf(params.id), funding: db.funding.filter((f) => f.startup?._id === params.id),
      achievements: db.achievements.filter((a) => a.startup._id === params.id), metrics: params.id === myStartupId ? [...db.metrics].reverse() : [],
    })
  }],
  ['POST', '/incubators/me/enrollments/:id/milestones', ({ params, body }) => {
    const m = { _id: newId('m'), status: 'pending', ...body }
    find(db.enrollments, params.id).milestones.push(m)
    return ok(m)
  }],
  ['PATCH', '/incubators/me/enrollments/:id/milestones/:mid', ({ params, body }) => ok(update(find(db.enrollments, params.id).milestones, params.mid, body))],
  ['PATCH', '/incubators/me/enrollments/:id/checklist/:cid', ({ params, body }) => ok(update(find(db.enrollments, params.id).marketingChecklist, params.cid, body))],
  ['POST', '/incubators/me/enrollments/:id/exit', ({ params, body }) => ok(update(db.enrollments, params.id, { status: body.type === 'graduation' ? 'graduated' : 'exited', exit: body }))],
  ['POST', '/incubators/me/enrollments/:id/agreement', ({ params, body }) => ok(update(db.enrollments, params.id, {
    agreement: { isSigned: true, signedAt: now(), documentUrl: '#', equityPercent: body.equityPercent === undefined ? undefined : +body.equityPercent, acceptedConditions: [].concat(body.acceptedConditions ?? []) },
  }))],

  ['GET', '/incubators/me/funding', ({ query }) => ok(db.funding.filter((f) => !query.type || f.type === query.type).sort((a, b) => new Date(b.date) - new Date(a.date)), { totals: fundingTotals() })],
  ['POST', '/incubators/me/funding', ({ body }) => {
    const s = db.startups.find((x) => x._id === body.startup)
    const f = { _id: newId('fd'), round: 'na', ...body, amount: +body.amount, startup: s && { _id: s._id, name: s.name }, documents: [].concat(body.documents ?? []) }
    db.funding.push(f)
    return ok(f)
  }],
  ['PATCH', '/incubators/me/funding/:id', ({ params, body }) => {
    const s = db.startups.find((x) => x._id === body.startup)
    const f = find(db.funding, params.id)
    return ok(Object.assign(f, body, { amount: +body.amount || f.amount, startup: s ? { _id: s._id, name: s.name } : f.startup, documents: [...f.documents, ...[].concat(body.documents ?? [])] }))
  }],
  ['DELETE', '/incubators/me/funding/:id', ({ params }) => remove(db.funding, params.id)],

  ['GET', '/incubators/me/achievements', ({ query }) => ok(db.achievements.filter((a) => query.verified === undefined || String(a.isVerified) === String(query.verified)))],
  ['PATCH', '/incubators/me/achievements/:id', ({ params, body }) => ok(update(db.achievements, params.id, body))],
  ['DELETE', '/incubators/me/achievements/:id', ({ params }) => remove(db.achievements, params.id)],

  ['GET', '/incubators/me/campaigns', () => ok(db.campaigns)],
  ['POST', '/incubators/me/campaigns', ({ body }) => {
    const c = { _id: newId('cp'), status: 'draft', stats: { recipients: 0, delivered: 0, opened: 0, failed: 0 }, ...body, cohort: db.cohorts.find((x) => x._id === body.cohort) }
    db.campaigns.unshift(c)
    return ok(c)
  }],
  ['GET', '/incubators/me/campaigns/:id/recipients', ({ params }) => {
    const c = find(db.campaigns, params.id)
    const n = c.audience.type === 'custom' ? c.audience.emails.length : c.audience.type === 'startups' ? c.audience.startups.length * 2 : 18
    return ok({ count: n, recipients: [] })
  }],
  ['POST', '/incubators/me/campaigns/:id/send', ({ params }) => {
    const c = find(db.campaigns, params.id)
    const n = c.audience.type === 'custom' ? c.audience.emails.length : c.audience.type === 'startups' ? c.audience.startups.length * 2 : 18
    return ok(Object.assign(c, { status: 'sent', sentAt: now(), scheduledAt: undefined, stats: { recipients: n, delivered: n, opened: 0, failed: 0 } }))
  }],
  ['POST', '/incubators/me/campaigns/:id/schedule', ({ params, body }) => ok(update(db.campaigns, params.id, { status: 'scheduled', scheduledAt: body.scheduledAt }))],
  ['POST', '/incubators/me/campaigns/:id/unschedule', ({ params }) => ok(update(db.campaigns, params.id, { status: 'draft', scheduledAt: undefined }))],
  ['GET', '/incubators/me/campaigns/:id', ({ params }) => ok(find(db.campaigns, params.id))],
  ['PATCH', '/incubators/me/campaigns/:id', ({ params, body }) => ok(update(db.campaigns, params.id, { ...body, cohort: db.cohorts.find((x) => x._id === body.cohort) }))],
  ['DELETE', '/incubators/me/campaigns/:id', ({ params }) => remove(db.campaigns, params.id)],

  ['GET', '/incubators/me/reports', () => ok(db.reports)],
  ['POST', '/incubators/me/reports', ({ body }) => {
    const cohort = db.cohorts.find((c) => c._id === body.cohort)
    const label = body.type.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase())
    const r = { _id: newId('rp'), ...body, cohort: cohort && { _id: cohort._id, name: cohort.name }, title: [cohort?.name, label, body.financialYear && `FY ${body.financialYear}`].filter(Boolean).join(' - '), status: 'generated', createdAt: now() }
    db.reports.unshift(r)
    return ok(r)
  }],
  ['POST', '/incubators/me/reports/:id/regenerate', ({ params }) => ok(update(db.reports, params.id, { createdAt: now() }))],
  ['PATCH', '/incubators/me/reports/:id/submit', ({ params, body }) => ok(update(db.reports, params.id, { status: 'submitted', submittedTo: body.submittedTo, submittedAt: now() }))],
  ['DELETE', '/incubators/me/reports/:id', ({ params }) => remove(db.reports, params.id)],
  ['GET', '/incubators/me/reports/:id/download', ({ params, query }) => ({ __file: reportFile(find(db.reports, params.id), query.fileType || 'pdf'), name: `${find(db.reports, params.id).title.replace(/[^\w-]+/g, '_')}-demo.txt` })],

  ['GET', '/incubators/me/compliance', () => ok(db.compliance)],
  ['POST', '/incubators/me/compliance/generate', ({ body }) => {
    const d = { _id: newId('cd'), ...body, title: body.title || `${body.docType.replace(/_/g, ' ')} ${body.financialYear}`, amountUtilized: fundingTotals().fundDistributed.total, status: 'draft', fileUrl: '#' }
    db.compliance.unshift(d)
    return ok(d)
  }],
  ['POST', '/incubators/me/compliance', ({ body }) => {
    const d = { _id: newId('cd'), ...body, amountSanctioned: +body.amountSanctioned || undefined, amountUtilized: +body.amountUtilized || undefined, status: 'draft', fileUrl: '#' }
    delete d.file
    db.compliance.unshift(d)
    return ok(d)
  }],
  ['PATCH', '/incubators/me/compliance/:id', ({ params, body }) => ok(update(db.compliance, params.id, body))],
  ['DELETE', '/incubators/me/compliance/:id', ({ params }) => remove(db.compliance, params.id)],

  // onboarding (demo users are already onboarded, but keep the forms from erroring)
  ['POST', '/startups/me', () => ok(db.S[myStartupId])],
  ['POST', '/incubators/me', () => ok(db.incubator)],
]

const compiled = routes.map(([method, path, handler]) => ({
  method,
  handler,
  keys: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]),
  regex: new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`),
}))

export default async function demoAdapter(config) {
  const method = (config.method || 'get').toUpperCase()
  const path = (config.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0]
  const respond = (status, data, headers = {}) => ({ data, status, statusText: String(status), headers, config, request: {} })

  await new Promise((r) => setTimeout(r, 150)) // feel like a network call
  const route = compiled.find((r) => r.method === method && r.regex.test(path))
  try {
    if (!route) {
      // Anything not modelled: reads come back empty, writes "succeed"
      return respond(200, method === 'GET' ? ok([]) : ok({ _id: newId(), ...parseBody(config.data) }))
    }
    const values = path.match(route.regex).slice(1)
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(values[i])]))
    const result = route.handler({ params, query: config.params || {}, body: parseBody(config.data), role: demoRole() })
    if (result?.__file) return respond(200, result.__file, { 'content-disposition': `attachment; filename="${result.name}"` })
    return respond(200, structuredClone(result))
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const response = respond(status, { success: false, message: err.message })
    throw new AxiosError(err.message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, null, response)
  }
}
