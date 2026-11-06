import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, GraduationCap, LogOut, Menu, X } from 'lucide-react'
import Wordmark from '../components/Wordmark.jsx'
import { ToastProvider } from '../components/dashboard/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { get } from '../api/client.js'
import useApi from '../hooks/useApi.js'

// Shared shell for every role's dashboard: 248px light sidebar with icon nav on desktop,
// slide-over drawer on mobile. `nav` is [{ to, label, icon, end? }].
// `orgUrl` (e.g. /startups/me) loads the organisation name shown in the account box.
export default function DashboardLayout({ nav, roleLabel, orgUrl }) {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const org = useApi(() => (orgUrl ? get(orgUrl).then((r) => r.data) : Promise.resolve(null)), [orgUrl])
  const accountName = org.data?.name || user?.name
  const roleText = user?.role === 'incubator' ? `Incubator ${user.incubatorRole === 'head' ? 'head' : 'member'}` : roleLabel

  const handleSignOut = async () => {
    await signOut()
    navigate(`/login?role=${user?.role ?? ''}`, { replace: true })
  }
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)

  // Close the drawer whenever the route changes
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  const AccountIcon = roleLabel === 'Mentor' ? GraduationCap : Building2

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex h-[88px] items-center pl-[34px]">
        <Wordmark size="md" />
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto px-[17px] pt-1.5">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-[43px] items-center gap-[25px] rounded-lg pl-[21px] text-[17px] transition ${isActive
                  ? 'bg-brand font-medium text-white'
                  : 'text-ink hover:bg-brand-soft'}`}
            >
              {Icon && <Icon size={24} strokeWidth={1.5} aria-hidden="true" />}
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="m-[17px] rounded-xl border border-line bg-white px-[17px] pt-4 pb-[17px]">
        <div className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <AccountIcon size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">{accountName}</p>
            <p className="text-sm text-ink-soft">{roleText}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 flex h-[41px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#d5dae3] bg-white text-base text-ink transition hover:border-glow hover:text-brand"
        >
          <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-page">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-line bg-sidebar lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/25" />
          <aside className="relative h-full w-[272px] bg-sidebar shadow-xl">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
              className="absolute top-7 right-3 rounded-lg p-1.5 text-ink-soft hover:bg-brand-soft">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <Wordmark size="sm" />
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-ink hover:bg-brand-soft">
            <Menu size={22} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-12 lg:pt-12 lg:pb-12">
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </main>
      </div>
    </div>
  )
}
