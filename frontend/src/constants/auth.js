// Where each role lands after sign-in
export const HOME = { startup: '/startup', incubator: '/incubator', mentor: '/mentor', investor: '/investor', admin: '/admin' }
// Startups have no onboarding: they go straight to the dashboard (profile popup on first tool use)
export const ONBOARDING = { incubator: '/onboarding/incubator', mentor: '/onboarding/mentor' }

export const landingFor = ({ user, needsOnboarding }) =>
  (needsOnboarding && ONBOARDING[user.role]) || HOME[user.role] || '/login'
