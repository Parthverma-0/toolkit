import { Bookmark, BookmarkCheck, Building2, MapPin, User } from 'lucide-react'
import { Badge, Card } from '../dashboard/Card.jsx'
import { Button, StatusPill } from '../dashboard/ui.jsx'
import { Avatar } from '../network/People.jsx'
import { SECTORS, STAGES } from '../../constants/startup.js'
import { BUSINESS_MODELS, REVENUE_PREFERENCES, ageLabel, labelOf, matchTier } from '../../constants/investor.js'
import { formatINRShort } from '../../utils/format.js'

export function MatchBadge({ match }) {
  if (!match) return null
  const tier = matchTier(match.score)
  return <Badge tone={tier.tone}>{match.score}% · {tier.label}</Badge>
}

// What the connection button should say for this startup
export const connectionState = (c) => {
  if (!c) return { label: 'Connect with Founder', action: 'connect' }
  if (c.status === 'accepted') return { label: 'Connected', action: 'message' }
  if (c.status === 'pending') {
    return c.initiatedBy === 'investor'
      ? { label: 'Request sent', action: 'none' }
      : { label: 'Respond to request', action: 'respond' }
  }
  return { label: 'Connect again', action: 'connect' }
}

function Fact({ label, children }) {
  if (!children) return null
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="truncate text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}

// One startup in Discover / Recommended / Shortlist
export default function StartupCard({ startup: s, onOpen, onToggleShortlist, onConnect, children }) {
  const conn = connectionState(s.connection)
  const place = [s.address?.city, s.address?.state].filter(Boolean).join(', ')
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4">
        <Avatar name={s.name} src={s.logo} size={52} square />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpen(s)} className="block max-w-full truncate text-left text-lg font-semibold text-ink hover:text-brand">{s.name}</button>
          <p className="truncate text-sm text-ink-soft">{labelOf(SECTORS, s.sector)} · {labelOf(STAGES, s.stage)}</p>
        </div>
        <button
          type="button" onClick={() => onToggleShortlist(s)} aria-pressed={s.shortlisted}
          aria-label={s.shortlisted ? `Remove ${s.name} from shortlist` : `Shortlist ${s.name}`}
          className={`rounded-lg p-2 transition ${s.shortlisted ? 'text-brand' : 'text-ink-soft hover:bg-canvas hover:text-ink'}`}
        >
          {s.shortlisted ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
        </button>
      </div>

      {s.match && <div className="mt-3"><MatchBadge match={s.match} /></div>}
      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-[15px] text-ink">{s.description || s.tagline || 'No description added yet.'}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        <Fact label="Funding needed">{s.fundingAsk ? formatINRShort(s.fundingAsk) : ''}</Fact>
        <Fact label="Business model">{s.businessModel && labelOf(BUSINESS_MODELS, s.businessModel)}</Fact>
        <Fact label="Revenue">{s.revenueStatus && labelOf(REVENUE_PREFERENCES, s.revenueStatus)}</Fact>
        <Fact label="Age">{ageLabel(s.foundedOn)}</Fact>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        {place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{place}</span>}
        {s.founderName && <span className="inline-flex items-center gap-1.5"><User size={14} />{s.founderName}</span>}
        {s.incubator && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{s.incubator.name}</span>}
      </div>

      <div className="mt-5 flex flex-1 items-end gap-2 border-t border-line pt-4">
        <Button size="sm" variant="secondary" onClick={() => onOpen(s)}>View profile</Button>
        {conn.action === 'connect' && <Button size="sm" onClick={() => onConnect(s)}>{conn.label}</Button>}
        {conn.action === 'none' && <StatusPill status="requested" label={conn.label} />}
        {conn.action === 'respond' && <Button size="sm" onClick={() => onOpen(s)}>{conn.label}</Button>}
        {conn.action === 'message' && <StatusPill status="accepted" label={conn.label} />}
        {children}
      </div>
    </Card>
  )
}
