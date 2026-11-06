import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Building2, Check, GraduationCap, LogOut, Rocket } from 'lucide-react'
import Wordmark from '../Wordmark.jsx'
import StepRail from './StepRail.jsx'

// Shared button styles, same sizes as the dashboard (43px, 17px bold)
export const PRIMARY_BTN = 'inline-flex h-[43px] items-center justify-center rounded-lg bg-brand px-6 text-[17px] font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50'
export const GHOST_BTN = 'inline-flex h-[43px] items-center justify-center rounded-lg border-[1.5px] border-brand bg-white px-6 text-[17px] font-bold text-brand transition hover:bg-brand-soft'

const ROLE_ICON = { startup: Rocket, incubator: Building2, mentor: GraduationCap }

// Onboarding uses the same shell as the dashboard: 248px light sidebar (logo, steps as
// nav rows, account box) and a white main area with the bar + 44px title header.
export default function OnboardingFrame({ title, intro, role = 'startup', roleLabel, steps, current, onSelect, children }) {
  const RoleIcon = ROLE_ICON[role] ?? Rocket
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => {
    await signOut()
    navigate(`/login?role=${role}`, { replace: true })
  }
  return (
    <div className="min-h-screen bg-page">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex h-[88px] items-center pl-[34px]">
          <Wordmark size="md" />
        </div>
        <p className="px-[38px] pt-1.5 pb-2 text-sm text-ink-soft">Profile setup</p>
        <ol className="flex-1 space-y-2 px-[17px]">
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            return (
              <li key={s.title}>
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => onSelect(i)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex h-[43px] w-full items-center gap-3.5 rounded-lg pl-[17px] text-left text-[17px] whitespace-nowrap transition disabled:cursor-default
                    ${active ? 'bg-brand font-medium text-white' : done ? 'text-ink hover:bg-brand-soft' : 'text-ink-soft'}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-semibold
                    ${active ? 'border-white text-white' : done ? 'border-brand bg-brand text-white' : 'border-[#c9d0dc] text-ink-soft'}`}>
                    {done ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            )
          })}
        </ol>
        <div className="m-[17px] rounded-xl border border-line bg-white px-[17px] pt-4 pb-[17px]">
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <RoleIcon size={24} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink">{user?.name || 'Signed in'}</p>
              <p className="text-sm text-ink-soft">{roleLabel}</p>
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
      </aside>

      <div className="lg:pl-[248px]">
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <Wordmark size="sm" />
          <button type="button" onClick={handleSignOut} className="flex items-center gap-2 text-sm text-ink">
            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
            Sign out
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-12 lg:pt-12 lg:pb-14">
          <header className="mb-11">
            <span aria-hidden="true" className="mb-4 block h-1 w-[47px] rounded-full bg-brand" />
            <h1 className="font-display text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">{title}</h1>
            <p className="mt-2.5 max-w-3xl text-base text-ink-soft sm:text-lg">{intro}</p>
          </header>
          <div className="mb-8 lg:hidden">
            <StepRail steps={steps} current={current} onSelect={onSelect} />
          </div>
          <section className="rounded-xl border border-line bg-white p-5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.08)] sm:p-8">
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}

// Heading at the top of each step's card
export function StepHeading({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-2xl leading-8 font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      {children && <p className="mt-2 text-[17px] leading-6 text-ink-soft">{children}</p>}
    </div>
  )
}

export function StepNav({ step, total, onBack, onNext, nextLabel, disabled }) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
      {step > 0 ? <button type="button" onClick={onBack} className={GHOST_BTN}>Back</button> : <span />}
      <button type="button" onClick={onNext} disabled={disabled} className={PRIMARY_BTN}>
        {nextLabel || (step < total - 1 ? 'Continue' : 'Submit')}
      </button>
    </div>
  )
}

export function ReviewBlock({ title, onEdit, children }) {
  return (
    <div className="rounded-xl border border-line bg-white p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="text-base font-semibold text-brand hover:text-brand-dark">Edit</button>
      </div>
      <dl className="grid gap-3">{children}</dl>
    </div>
  )
}

// Reloads the session (so needsOnboarding turns false) before entering the dashboard
export function SuccessPanel({ title, children, to, cta, media }) {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    await refreshMe()
    navigate(to, { replace: true })
  }
  return (
    <div className="py-10 text-center">
      {media}
      <h2 className="mt-6 font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[17px] leading-6 text-ink-soft">{children}</p>
      <button type="button" onClick={go} disabled={busy} className={`mt-8 ${PRIMARY_BTN}`}>{busy ? 'Opening...' : cta}</button>
    </div>
  )
}
