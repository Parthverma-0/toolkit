import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconTile } from '../../components/dashboard/Card.jsx'
import { PageHeader } from '../../components/dashboard/ui.jsx'
import { useStartupProfile } from '../../components/startup/StartupProfile.jsx'
import { TOOLS } from '../../constants/tools.js'

// Each tool opens its own page (form + earlier reports). Using a tool needs a complete
// profile: until then a click opens the "complete your profile" popup, then continues to the tool.
export default function Tools() {
  const navigate = useNavigate()
  const { complete, requireProfile } = useStartupProfile()

  return (
    <div>
      <PageHeader title="Tools" subtitle="Answer a few questions and get a formal report, written from your startup profile and your inputs." />
      {!complete && (
        <p className="-mt-6 mb-8 flex items-center gap-2 text-base text-ink-soft">
          <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
          Complete your startup profile to use the tools.
        </p>
      )}
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map(({ type, icon, name, description }) => (
          <article key={type}
            className="flex flex-col rounded-xl border border-line bg-white px-[26px] pt-5 pb-[27px] shadow-[0_4px_16px_-6px_rgba(15,23,42,0.08)]">
            <IconTile icon={icon} />
            <h2 className="mt-3.5 font-display text-2xl leading-8 font-extrabold tracking-[-0.02em] text-ink">{name}</h2>
            <p className="mt-2 flex-1 text-[17px] leading-6 text-ink-soft">{description}</p>
            <button type="button" onClick={() => requireProfile(() => navigate(`/startup/tools/${type}`), 'tool')}
              className="mt-6 flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-brand bg-white text-[17px] font-bold text-brand transition hover:bg-brand-soft">
              {!complete && <Lock size={16} strokeWidth={2} aria-hidden="true" />}
              Open
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
