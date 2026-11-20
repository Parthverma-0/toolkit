import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, Link2, MessageSquare, Megaphone, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { Empty } from '../dashboard/Card.jsx'
import { formatDateTime } from '../../utils/format.js'

const ICONS = {
  connection_request: Link2,
  connection_accepted: CheckCircle2,
  connection_declined: XCircle,
  message: MessageSquare,
  verification: ShieldCheck,
  match: Sparkles,
  announcement: Megaphone,
}

// Rows of notifications; unread ones are tinted. Clicking one opens its link.
export default function NotificationList({ items, onOpen, emptyText = 'You are all caught up.' }) {
  if (!items.length) return <Empty title="No notifications">{emptyText}</Empty>
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const Icon = ICONS[n.type] ?? Bell
        const row = (
          <div className={`flex items-start gap-4 px-1 py-4 ${n.readAt ? '' : 'bg-brand-soft/40'}`}>
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-base text-ink ${n.readAt ? '' : 'font-semibold'}`}>{n.title}</p>
              {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{n.body}</p>}
              <p className="mt-1 text-xs text-ink-soft">{formatDateTime(n.createdAt)}</p>
            </div>
            {!n.readAt && <span aria-label="Unread" className="mt-2 size-2.5 shrink-0 rounded-full bg-brand" />}
          </div>
        )
        return (
          <li key={n._id}>
            {n.link
              ? <Link to={n.link} onClick={() => onOpen?.(n)} className="block rounded-lg transition hover:bg-canvas">{row}</Link>
              : <button type="button" onClick={() => onOpen?.(n)} className="block w-full text-left">{row}</button>}
          </li>
        )
      })}
    </ul>
  )
}
