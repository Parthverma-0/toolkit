import { IconTile } from '../../components/dashboard/Card.jsx'
import { PageHeader } from '../../components/dashboard/ui.jsx'
import { TOOLS } from '../../constants/tools.js'
import useApi from '../../hooks/useApi.js'
import { get } from '../../api/client.js'

// Icons and copy live in constants/tools.js; availability comes from GET /api/tools
export default function Tools() {
  const api = useApi(() => get('/tools').then((r) => r.data))
  const statusOf = (type, fallback) => api.data?.find((t) => t.type === type)?.status ?? fallback
  return (
    <div>
      <PageHeader title="Tools" subtitle="Guided tools that turn your inputs into investor-ready documents." />
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map(({ type, icon, name, description, status: fallback }) => {
          const status = statusOf(type, fallback)
          return (
          <article key={type}
            className="flex flex-col rounded-xl border border-line bg-white px-[26px] pt-5 pb-[27px] shadow-[0_4px_16px_-6px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <IconTile icon={icon} />
              {status === 'coming_soon' && (
                <span className="mt-[5px] rounded-[9px] bg-[#e9eef8] px-3.5 py-[3px] text-[15px] text-ink-soft">Soon</span>
              )}
            </div>
            <h2 className="mt-3.5 font-display text-2xl leading-8 font-extrabold tracking-[-0.02em] text-ink">{name}</h2>
            <p className="mt-2 flex-1 text-[17px] leading-6 text-ink-soft">{description}</p>
            <button type="button" disabled={status === 'coming_soon'}
              className="mt-6 h-[38px] w-full rounded-lg border-[1.5px] border-brand bg-white text-[17px] font-bold text-brand disabled:cursor-not-allowed">
              {status === 'coming_soon' ? 'Coming soon' : 'Open'}
            </button>
          </article>
          )
        })}
      </div>
    </div>
  )
}
