// Where each role lands after sign-in
export const HOME = { startup: '/startup', incubator: '/incubator', mentor: '/mentor', admin: '/login' }
export const ONBOARDING = { startup: '/onboarding/startup', incubator: '/onboarding/incubator', mentor: '/onboarding/mentor' }

export const landingFor = ({ user, needsOnboarding }) =>
  (needsOnboarding && ONBOARDING[user.role]) || HOME[user.role] || '/login'
