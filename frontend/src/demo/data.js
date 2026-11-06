// Sample data for demo mode. Shapes mirror the real API responses.
// Dates are relative to "now" so the demo always looks current.
const DAY = 24 * 3600 * 1000
const at = (days, hour = 11) => {
  const d = new Date(Date.now() + days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const ymd = (days) => at(days).slice(0, 10)

export const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export const users = {
  startup: { id: 'u-startup', _id: 'u-startup', name: 'Ananya Rao', email: 'ananya@krishiflow.in', role: 'startup', phone: '+919876543210', isPhoneVerified: true, status: 'active' },
  incubator: { id: 'u-inc', _id: 'u-inc', name: 'Rohit Mehta', email: 'rohit@nexusincubator.org', role: 'incubator', incubatorRole: 'head', status: 'active' },
  mentor: { id: 'u-mentor', _id: 'u-mentor', name: 'Priya Natarajan', email: 'priya@mentor.in', role: 'mentor', status: 'active' },
}

const incubatorRef = { _id: 'inc1', name: 'Nexus Innovation Hub' }

export function createDb() {
  const startups = [
    { _id: 's1', name: 'KrishiFlow', logo: null, sector: 'agritech', stage: 'early_traction', tagline: 'Smart irrigation for small farms', startupEmail: 'hello@krishiflow.in', startupEmailVerified: true, website: 'https://krishiflow.in', teamSize: 8, foundedOn: '2023-04-12', problemStatement: 'Small farmers lose up to 40% of water to over-irrigation.', solution: 'Low-cost soil sensors with an SMS-based irrigation schedule.', address: { city: 'Pune', state: 'Maharashtra', country: 'India' }, cin: 'U01100MH2023PTC123456', dpiitNumber: 'DIPP123456', isVerified: true },
    { _id: 's2', name: 'MedLoop', logo: null, sector: 'healthtech', stage: 'mvp', tagline: 'Refill reminders for chronic care', startupEmail: 'team@medloop.health', website: 'https://medloop.health' },
    { _id: 's3', name: 'VoltCart', logo: null, sector: 'cleantech', stage: 'scaling', tagline: 'EV battery swapping for delivery fleets', startupEmail: 'ops@voltcart.in', website: 'https://voltcart.in' },
    { _id: 's4', name: 'LearnLeaf', logo: null, sector: 'edtech', stage: 'validation', tagline: 'Vernacular STEM lessons on WhatsApp', startupEmail: 'hi@learnleaf.app', website: 'https://learnleaf.app' },
    { _id: 's5', name: 'Ledgerly', logo: null, sector: 'fintech', stage: 'early_traction', tagline: 'GST-ready books for kirana stores', startupEmail: 'founders@ledgerly.in', website: 'https://ledgerly.in' },
  ]
  const S = Object.fromEntries(startups.map((s) => [s._id, s]))
  const ref = (s) => ({ _id: s._id, name: s.name, logo: s.logo, sector: s.sector, stage: s.stage, tagline: s.tagline, startupEmail: s.startupEmail, website: s.website })

  const founders = [
    { _id: 'f1', fullName: 'Ananya Rao', designation: 'CEO', email: 'ananya@krishiflow.in', phone: '+919876543210', equityPercent: 55, linkedin: 'https://linkedin.com/in/ananyarao', isPrimary: true, isEmailVerified: true, isPhoneVerified: true },
    { _id: 'f2', fullName: 'Karan Shah', designation: 'CTO', email: 'karan@krishiflow.in', phone: '+919812345678', equityPercent: 35, isPrimary: false },
  ]

  const regForm = {
    opensAt: at(-20), closesAt: at(12),
    fields: [
      { key: 'traction', label: 'What traction do you have so far?', type: 'textarea', required: true },
      { key: 'funding_raised', label: 'Funding raised to date (₹)', type: 'number', required: false },
      { key: 'why_us', label: 'Why this cohort?', type: 'text', required: true },
    ],
  }
  const cohorts = [
    { _id: 'c1', name: 'AgriTech Accelerator 2026', status: 'ongoing', objective: 'Take agri and climate startups from pilot to paying customers in 6 months.', startDate: at(-75), endDate: at(105), targetStartups: { count: 12, sectors: ['agritech', 'cleantech'], stages: ['mvp', 'early_traction'] }, eligibilityCriteria: [{ criterion: 'DPIIT recognised' }, { criterion: 'At least one paying pilot' }], milestoneChecklist: [{ _id: 'mc1', title: 'Pilot with 50 farmers', dueInWeeks: 6 }, { _id: 'mc2', title: 'Unit economics review', dueInWeeks: 10 }], marketing: { checklist: [{ _id: 'mk1', item: 'Founder story blog post' }] }, registrationForm: { ...regForm, opensAt: at(-120), closesAt: at(-80) }, incubator: incubatorRef, stats: { applications: { submitted: 3, under_review: 2, shortlisted: 4, accepted: 9, rejected: 14 }, enrollments: { active: 9, graduated: 0 } } },
    { _id: 'c2', name: 'HealthTech Cohort 3', status: 'registration_open', objective: 'A 16-week program for digital health startups with hospital pilots.', startDate: at(30), endDate: at(140), targetStartups: { count: 10, sectors: ['healthtech'], stages: ['validation', 'mvp'] }, eligibilityCriteria: [{ criterion: 'Incorporated in India' }], milestoneChecklist: [], marketing: { checklist: [] }, registrationForm: regForm, incubator: incubatorRef, isRegistrationOpen: true, stats: { applications: { submitted: 7, under_review: 3, shortlisted: 1 }, enrollments: {} } },
    { _id: 'c3', name: 'Fintech Sprint 2025', status: 'completed', objective: 'Compliance-first fintech products for Bharat.', startDate: at(-330), endDate: at(-150), targetStartups: { count: 8, sectors: ['fintech'], stages: [] }, eligibilityCriteria: [], milestoneChecklist: [], marketing: { checklist: [] }, registrationForm: { fields: [] }, incubator: incubatorRef, stats: { applications: { accepted: 6, rejected: 20 }, enrollments: { graduated: 5, exited: 1 } } },
    { _id: 'c4', name: 'Women Founders Fellowship', status: 'draft', objective: 'Fellowship for first-time women founders.', startDate: at(80), endDate: at(200), targetStartups: { count: 15, sectors: [], stages: ['ideation', 'validation'] }, eligibilityCriteria: [], milestoneChecklist: [], marketing: { checklist: [] }, registrationForm: { fields: [] }, incubator: incubatorRef, stats: { applications: {}, enrollments: {} } },
  ]
  const C = Object.fromEntries(cohorts.map((c) => [c._id, c]))

  const milestones = [
    { _id: 'm1', title: 'Pilot with 50 farmers', dueDate: at(-40), status: 'completed', evidenceUrl: 'https://krishiflow.in/pilot' },
    { _id: 'm2', title: 'Unit economics review', dueDate: at(-5), status: 'completed' },
    { _id: 'm3', title: 'First distribution partner', dueDate: at(20), status: 'in_progress' },
    { _id: 'm4', title: 'Demo day pitch', dueDate: at(100), status: 'pending' },
  ]
  const enrollment = (id, startup, cohort, extra = {}) => ({
    _id: id, startup, cohort: { _id: cohort._id, name: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate, status: cohort.status, incubator: incubatorRef },
    status: 'active', mode: 'hybrid', onboardedAt: at(-74),
    milestones: milestones.map((m) => ({ ...m, _id: `${id}-${m._id}` })),
    marketingChecklist: [{ _id: `${id}-k1`, item: 'Founder story blog post', isDone: true }, { _id: `${id}-k2`, item: 'Demo video for showcase', isDone: false }],
    agreement: { isSigned: true, signedAt: at(-70), equityPercent: 2, acceptedConditions: ['Monthly metrics reporting', 'Attend 80% of sessions'] },
    ...extra,
  })
  const enrollments = [
    enrollment('e1', 's1', C.c1),
    enrollment('e2', 's3', C.c1, { agreement: { isSigned: false } }),
    enrollment('e3', 's5', C.c3, { status: 'graduated', onboardedAt: at(-330) }),
  ]
  // Monthly metrics, oldest first
  const metrics = [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (6 - i))
    return { _id: `mt${i}`, period: { month: d.getMonth() + 1, year: d.getFullYear() }, revenue: [180000, 220000, 265000, 310000, 395000, 460000][i], expenses: [420000, 430000, 455000, 470000, 490000, 510000][i], customers: [140, 170, 210, 250, 320, 380][i], employees: [6, 6, 7, 7, 8, 8][i] }
  })

  const achievements = [
    { _id: 'a1', startup: { _id: 's1', name: 'KrishiFlow' }, type: 'award', title: 'Winner, AgriNext Challenge', date: at(-30), isVerified: true, proofUrl: 'https://example.com/agrinext' },
    { _id: 'a2', startup: { _id: 's1', name: 'KrishiFlow' }, type: 'partnership', title: 'MoU with Maharashtra FPO network', date: at(-8), isVerified: false, description: 'Distribution to 12 farmer producer organisations.' },
    { _id: 'a3', startup: { _id: 's3', name: 'VoltCart' }, type: 'funding', title: 'Raised ₹2 Cr seed round', date: at(-15), isVerified: false },
    { _id: 'a4', startup: { _id: 's5', name: 'Ledgerly' }, type: 'product_launch', title: 'Launched Ledgerly for Android', date: at(-200), isVerified: true },
  ]

  const funding = [
    { _id: 'fd1', type: 'ic_fund_raised', source: 'Startup India Seed Fund Scheme', instrument: 'seed_fund', round: 'na', amount: 50000000, date: at(-300), documents: [] },
    { _id: 'fd2', type: 'ic_fund_raised', source: 'Tata CSR', instrument: 'csr', round: 'na', amount: 15000000, date: at(-120), documents: [] },
    { _id: 'fd3', type: 'ic_fund_distributed', startup: { _id: 's1', name: 'KrishiFlow' }, instrument: 'grant', round: 'na', amount: 2000000, date: at(-60), documents: [] },
    { _id: 'fd4', type: 'ic_fund_distributed', startup: { _id: 's3', name: 'VoltCart' }, instrument: 'convertible_note', round: 'seed', amount: 5000000, date: at(-45), documents: [] },
    { _id: 'fd5', type: 'external_funding', startup: { _id: 's3', name: 'VoltCart' }, source: 'Seedfold Ventures', instrument: 'equity', round: 'seed', amount: 20000000, date: at(-15), documents: [] },
  ]

  const mentorProfile = {
    _id: 'mp1', user: { _id: 'u-mentor', name: 'Priya Natarajan' }, designation: 'Former VP Growth', organization: 'Swiggy', yearsOfExperience: 14,
    bio: 'I help early-stage founders find repeatable growth channels and price their product.', expertise: ['gtm', 'marketing', 'pitching'], sectors: ['consumer', 'agritech'],
    linkedin: 'https://linkedin.com/in/priyanatarajan', website: '', isVerified: true,
    availability: [{ day: 'tue', from: '17:00', to: '19:00' }, { day: 'sat', from: '10:00', to: '13:00' }],
  }
  const mentors = [
    mentorProfile,
    { _id: 'mp2', user: { _id: 'u-m2', name: 'Arjun Kapoor' }, designation: 'Partner', organization: 'Blume Ventures', yearsOfExperience: 11, bio: 'Fundraising strategy, term sheets and board building.', expertise: ['fundraising', 'finance'], isVerified: true, availability: [{ day: 'wed', from: '18:00', to: '20:00' }] },
    { _id: 'mp3', user: { _id: 'u-m3', name: 'Meera Iyer' }, designation: 'Head of Product', organization: 'Razorpay', yearsOfExperience: 9, bio: 'Product discovery, roadmaps and shipping fast with small teams.', expertise: ['product', 'operations'], isVerified: false, availability: [{ day: 'fri', from: '16:00', to: '18:00' }] },
  ]
  const startupRef = { _id: 's1', name: 'KrishiFlow' }
  const sessions = [
    { _id: 'ms1', mentor: { _id: 'u-mentor', name: 'Priya Natarajan' }, startup: startupRef, topic: 'Pricing for FPO contracts', agenda: 'Review our per-acre pricing.', scheduledAt: at(3, 17), durationMinutes: 45, mode: 'online', status: 'confirmed', meetingLink: 'https://meet.google.com/abc-defg-hij' },
    { _id: 'ms2', mentor: { _id: 'u-m2', name: 'Arjun Kapoor' }, startup: startupRef, topic: 'Seed round narrative', scheduledAt: at(8, 18), durationMinutes: 30, mode: 'online', status: 'requested' },
    { _id: 'ms3', mentor: { _id: 'u-mentor', name: 'Priya Natarajan' }, startup: { _id: 's3', name: 'VoltCart' }, topic: 'Fleet sales playbook', scheduledAt: at(-6, 17), durationMinutes: 60, mode: 'offline', location: 'Nexus Hub, Pune', status: 'completed', feedback: { rating: 5, comment: 'Super practical.' }, mentorNotes: 'Shared a sales script template.' },
    { _id: 'ms4', mentor: { _id: 'u-m3', name: 'Meera Iyer' }, startup: startupRef, topic: 'MVP scope', scheduledAt: at(-12, 16), durationMinutes: 30, mode: 'online', status: 'completed' },
    { _id: 'ms5', mentor: { _id: 'u-mentor', name: 'Priya Natarajan' }, startup: { _id: 's4', name: 'LearnLeaf' }, topic: 'WhatsApp growth loops', scheduledAt: at(5, 10), durationMinutes: 30, mode: 'online', status: 'requested' },
  ]

  const mentorRef = { _id: 'u-mentor', name: 'Priya Natarajan' }
  const videos = [
    { _id: 'v1', title: 'Finding your first 100 customers', category: 'gtm', durationSeconds: 1260, views: 1840, likesCount: 212, status: 'published', publishedAt: at(-40), description: 'A step-by-step way to find, reach and convert your first customers.', resources: [{ name: 'Outreach template', url: 'https://example.com/template' }] },
    { _id: 'v2', title: 'Pricing without guesswork', category: 'marketing', durationSeconds: 930, views: 960, likesCount: 104, status: 'published', publishedAt: at(-20), description: 'Value-based pricing for early-stage products.' },
    { _id: 'v3', title: 'Pitch deck teardown', category: 'pitching', durationSeconds: 1500, views: 0, likesCount: 0, status: 'draft', description: 'Teardown of three real seed decks.' },
  ].map((v) => ({ ...v, mentor: mentorRef, sourceType: 'upload', videoUrl: SAMPLE_VIDEO, thumbnailUrl: null, tags: [], likedByMe: false }))
  videos.push(
    { _id: 'v4', title: 'Term sheets explained', category: 'fundraising', durationSeconds: 1100, views: 2300, likesCount: 340, status: 'published', publishedAt: at(-60), mentor: { _id: 'u-m2', name: 'Arjun Kapoor' }, sourceType: 'upload', videoUrl: SAMPLE_VIDEO, thumbnailUrl: null, tags: [], likedByMe: true, description: 'Every clause in a seed term sheet, in plain English.' },
    { _id: 'v5', title: 'Shipping an MVP in 6 weeks', category: 'product', durationSeconds: 840, views: 1200, likesCount: 150, status: 'published', publishedAt: at(-10), mentor: { _id: 'u-m3', name: 'Meera Iyer' }, sourceType: 'upload', videoUrl: SAMPLE_VIDEO, thumbnailUrl: null, tags: [], likedByMe: false },
  )

  const investors = [
    { _id: 'i1', name: 'Seedfold Ventures', firm: 'Seedfold', type: 'vc', location: 'Bengaluru', ticketSize: { min: 5000000, max: 30000000 }, stages: ['mvp', 'early_traction'], sectors: ['agritech', 'cleantech'], about: 'Seed-stage fund for climate and rural tech.' },
    { _id: 'i2', name: 'Mumbai Angels', firm: 'Mumbai Angels Network', type: 'angel_network', location: 'Mumbai', ticketSize: { min: 2500000, max: 15000000 }, stages: ['validation', 'mvp'], sectors: [], about: 'One of India\'s oldest angel networks.' },
    { _id: 'i3', name: 'Rhea Sethi', firm: '', type: 'angel', location: 'Delhi', ticketSize: { min: 1000000, max: 5000000 }, stages: ['ideation', 'validation'], sectors: ['healthtech', 'edtech'], about: 'Operator angel, ex-Practo.' },
  ]
  const connections = [
    { _id: 'ic1', investor: { _id: 'i1', name: 'Seedfold Ventures', type: 'vc' }, status: 'meeting_scheduled', amountSought: 15000000, createdAt: at(-14) },
    { _id: 'ic2', investor: { _id: 'i2', name: 'Mumbai Angels', type: 'angel_network' }, status: 'requested', amountSought: 5000000, createdAt: at(-2) },
  ]

  const grants = [
    { _id: 'g1', title: 'BIRAC BIG Grant', provider: 'BIRAC', providerType: 'government', amount: { min: 1000000, max: 5000000 }, deadline: at(25), status: 'open', isAcceptingApplications: true, description: 'Biotechnology Ignition Grant for proof-of-concept.', eligibility: ['Indian startup under 5 years old', 'Biotech or allied sector'], sectors: ['agritech', 'healthtech'], stages: ['ideation', 'validation', 'mvp'] },
    { _id: 'g2', title: 'Nexus Seed Support', provider: 'Nexus Innovation Hub', providerType: 'incubator', incubator: incubatorRef, amount: { min: 500000, max: 2000000 }, deadline: at(10), status: 'open', isAcceptingApplications: true, description: 'Seed support for startups in Nexus cohorts.', eligibility: ['Enrolled in a Nexus cohort'], sectors: [], stages: [] },
    { _id: 'g3', title: 'Climate Innovation Challenge', provider: 'Tata Trusts', providerType: 'csr', amount: { min: 2500000, max: 2500000 }, deadline: at(-5), status: 'closed', isAcceptingApplications: false, description: 'Prize grant for climate-resilience solutions.', eligibility: [], sectors: ['cleantech', 'agritech'], stages: [] },
  ]
  const grantApplications = [
    { _id: 'ga1', grant: { _id: 'g2', title: 'Nexus Seed Support', provider: 'Nexus Innovation Hub' }, status: 'under_review', amountRequested: 1500000, purpose: 'Sensor manufacturing for 500 farms.', updatedAt: at(-3) },
  ]

  const events = [
    { _id: 'ev1', title: 'Fundraising 101 workshop', type: 'workshop', mode: 'offline', venue: 'Nexus Hub, Pune', startsAt: at(6, 15), endsAt: at(6, 17), status: 'published', visibility: 'public', capacity: 60, seatsLeft: 18, description: 'Hands-on session on building your first fundraising pipeline.', incubator: incubatorRef, organizer: { name: 'Nexus Innovation Hub' } },
    { _id: 'ev2', title: 'AgriTech Demo Day', type: 'demo_day', mode: 'hybrid', venue: 'Nexus Hub, Pune', meetingLink: 'https://meet.google.com/demo-day', startsAt: at(45, 10), endsAt: at(45, 16), status: 'published', visibility: 'cohort_only', cohort: 'c1', capacity: 200, seatsLeft: 150, description: 'Cohort startups pitch to 40+ investors.', incubator: incubatorRef, organizer: { name: 'Nexus Innovation Hub' } },
    { _id: 'ev3', title: 'Growth loops that work in India', type: 'webinar', mode: 'online', meetingLink: 'https://meet.google.com/growth', startsAt: at(10, 18), endsAt: at(10, 19), status: 'published', visibility: 'public', capacity: 300, seatsLeft: 210, description: 'Live webinar with Q&A.', organizer: { name: 'Priya Natarajan' }, host: 'mentor' },
    { _id: 'ev4', title: 'Founder networking night', type: 'networking', mode: 'offline', venue: 'Koregaon Park, Pune', startsAt: at(20, 19), endsAt: at(20, 22), status: 'draft', visibility: 'public', capacity: 80, description: 'Informal evening with founders and mentors.', incubator: incubatorRef, organizer: { name: 'Nexus Innovation Hub' } },
  ]
  const registrations = [
    { _id: 'er1', event: events[0], status: 'registered', user: { name: 'Ananya Rao', email: 'ananya@krishiflow.in' }, startup: startupRef },
    { _id: 'er2', event: events[2], status: 'registered', user: { name: 'Ananya Rao', email: 'ananya@krishiflow.in' }, startup: startupRef },
  ]

  const applications = [
    { _id: 'ap1', cohort: { _id: 'c2', name: 'HealthTech Cohort 3', incubator: incubatorRef }, startup: ref(S.s2), status: 'under_review', createdAt: at(-4), eligibility: { isEligible: true, criteriaMet: ['Incorporated in India'], criteriaFailed: [] }, responses: [{ key: 'traction', value: '3 clinics piloting, 1,200 patients' }, { key: 'why_us', value: 'Hospital network access' }] },
    { _id: 'ap2', cohort: { _id: 'c2', name: 'HealthTech Cohort 3', incubator: incubatorRef }, startup: ref(S.s4), status: 'submitted', createdAt: at(-1), eligibility: { isEligible: false, criteriaMet: [], criteriaFailed: ['Incorporated in India'] }, responses: [{ key: 'traction', value: '400 students in beta' }, { key: 'why_us', value: 'Mentorship' }] },
    { _id: 'ap3', cohort: { _id: 'c2', name: 'HealthTech Cohort 3', incubator: incubatorRef }, startup: ref(S.s5), status: 'shortlisted', createdAt: at(-6), remarks: 'Strong team', eligibility: { isEligible: true, criteriaMet: ['Incorporated in India'], criteriaFailed: [] }, responses: [] },
  ]
  const myApplications = [
    { _id: 'ap9', cohort: { _id: 'c1', name: 'AgriTech Accelerator 2026', incubator: incubatorRef }, status: 'accepted', createdAt: at(-90) },
  ]

  const members = [
    { _id: 'u-inc', name: 'Rohit Mehta', email: 'rohit@nexusincubator.org', incubatorRole: 'head', status: 'active', createdAt: at(-400), lastLoginAt: at(0) },
    { _id: 'u-mem1', name: 'Sneha Kulkarni', email: 'sneha@nexusincubator.org', incubatorRole: 'member', status: 'active', createdAt: at(-200), lastLoginAt: at(-2) },
    { _id: 'u-mem2', name: 'Vikram Joshi', email: 'vikram@nexusincubator.org', incubatorRole: 'member', status: 'invited', createdAt: at(-3) },
  ]

  const campaigns = [
    { _id: 'cp1', name: 'HealthTech Cohort 3 launch', subject: 'Applications are open: HealthTech Cohort 3', bodyHtml: '<p>Hi there,</p>\n<p>Applications for HealthTech Cohort 3 are now open.</p>', audience: { type: 'custom', startups: [], emails: Array.from({ length: 240 }, (_, i) => `founder${i}@example.com`) }, status: 'sent', sentAt: at(-18), stats: { recipients: 240, delivered: 236, opened: 118, failed: 4 } },
    { _id: 'cp2', name: 'Demo day reminder', subject: 'Demo day is in 6 weeks', bodyHtml: '<p>Start preparing your pitch.</p>', cohort: { _id: 'c1', name: 'AgriTech Accelerator 2026' }, audience: { type: 'cohort', startups: [], emails: [] }, status: 'scheduled', scheduledAt: at(4, 9), stats: { recipients: 18, delivered: 0, opened: 0, failed: 0 } },
    { _id: 'cp3', name: 'Monthly metrics nudge', subject: 'Please record your monthly metrics', bodyHtml: '<p>A quick reminder to add last month\'s numbers.</p>', audience: { type: 'startups', startups: ['s1', 's3'], emails: [] }, status: 'draft', stats: { recipients: 0, delivered: 0, opened: 0, failed: 0 } },
  ]

  const fy = (() => { const d = new Date(); const s = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${s}-${String(s + 1).slice(2)}` })()
  const reports = [
    { _id: 'rp1', title: 'Activity report - Q2', type: 'activity_report', format: 'government', status: 'submitted', submittedTo: 'DST NIDHI', createdAt: at(-50) },
    { _id: 'rp2', title: 'AgriTech Accelerator 2026 - Cohort end', type: 'cohort_end', format: 'government', cohort: { _id: 'c1', name: 'AgriTech Accelerator 2026' }, status: 'generated', createdAt: at(-5) },
  ]
  const compliance = [
    { _id: 'cd1', docType: 'utilization_certificate', title: `SISFS utilisation certificate ${fy}`, financialYear: fy, amountSanctioned: 50000000, amountUtilized: 7000000, status: 'final', fileUrl: '#' },
    { _id: 'cd2', docType: 'financial_record', title: 'Audited statements', financialYear: fy, status: 'draft', fileUrl: '#' },
  ]

  return {
    startups, S, ref, founders, cohorts, C, enrollments, metrics, achievements, funding, mentorProfile, mentors, sessions, videos,
    investors, connections, grants, grantApplications, events, registrations, applications, myApplications, members, campaigns,
    reports, compliance, ymd,
    incubator: { _id: 'inc1', name: 'Nexus Innovation Hub', type: 'academic', address: { city: 'Pune', state: 'Maharashtra', country: 'India' }, seats: { limit: 5 } },
    programs: [{ _id: 'pg1', name: 'NIDHI Seed Support Programme' }],
    tools: [{ type: 'pitch_deck_review', status: 'available', runs: 3 }, { type: 'idea_validation', status: 'available', runs: 1 }, { type: 'competitor_analysis', status: 'available', runs: 0 }],
  }
}
