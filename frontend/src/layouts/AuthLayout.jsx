import { Outlet } from 'react-router-dom'
import { Building2, GraduationCap, Rocket } from 'lucide-react'
import Wordmark from '../components/Wordmark.jsx'

const AUDIENCES = [
  { icon: Rocket, title: 'For startups', text: 'Guided tools, mentoring, videos, grants and investor discovery in one place.' },
  { icon: Building2, title: 'For incubators', text: 'Run cohorts, track milestones and funding, and generate reports.' },
  { icon: GraduationCap, title: 'For mentors', text: 'Share expertise through videos and 1:1 sessions with founders.' },
]

// Split screen on large screens: white intro panel on the left, auth card on the
// off-white page on the right. Smaller screens show just the centred card.
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <aside className="hidden flex-col border-r border-line bg-white px-12 py-10 lg:flex">
        <Wordmark size="md" />
        <div className="my-auto max-w-md py-12">
          <span aria-hidden="true" className="mb-5 block h-1 w-12 rounded-full bg-brand" />
          <h2 className="font-display text-4xl leading-tight font-extrabold tracking-tight text-ink">
            One workspace for the whole startup journey.
          </h2>
          <p className="mt-3 text-[15px] text-ink-soft">Startups, incubators and mentors working together on Toolkit.</p>
          <ul className="mt-10 grid gap-6">
            {AUDIENCES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display font-bold text-ink">{title}</span>
                  <span className="block text-sm leading-relaxed text-ink-soft">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-soft">© {new Date().getFullYear()} Toolkit</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
