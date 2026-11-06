import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ONBOARDING, landingFor } from '../constants/auth.js'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-page text-brand">
      <Loader2 size={32} className="animate-spin" aria-label="Loading" />
    </div>
  )
}

// Guards a role's area.
// onboarding=false (dashboard): must be signed in as `role` and have finished onboarding.
// onboarding=true: must be signed in as `role` and still need onboarding.
export default function RequireAuth({ role, onboarding = false, children }) {
  const auth = useAuth()
  const { pathname } = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner />
  if (!auth.user) return <Navigate to={`/login?role=${role}`} replace state={{ from: pathname }} />
  if (auth.user.role !== role) return <Navigate to={landingFor(auth)} replace />
  if (!onboarding && auth.needsOnboarding && ONBOARDING[role]) return <Navigate to={ONBOARDING[role]} replace />
  if (onboarding && !auth.needsOnboarding) return <Navigate to={landingFor(auth)} replace />

  return children ?? <Outlet />
}

// /login and /signup: already signed-in users go straight to their area
export function GuestOnly({ children }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <FullPageSpinner />
  if (auth.user && auth.user.role !== 'admin') return <Navigate to={landingFor(auth)} replace />
  return children ?? <Outlet />
}
