import { useState } from 'react'
import { Card, Empty } from '../dashboard/Card.jsx'
import { Button, StatusPill, Tabs, useToast } from '../dashboard/ui.jsx'
import Async from '../dashboard/Async.jsx'
import { Person } from './People.jsx'
import useApi from '../../hooks/useApi.js'
import { errorMessage, get, patch } from '../../api/client.js'
import { formatDate, formatDateTime } from '../../utils/format.js'

// Spec wording: Request Sent / Pending / Accepted / Declined / Conversation Active
export const connectionLabel = (c) => {
  if (c.status === 'pending') return c.direction === 'sent' ? 'Request Sent' : 'Pending'
  if (c.status === 'accepted') return c.conversationActive ? 'Conversation Active' : 'Accepted'
  return c.status === 'declined' ? 'Declined' : 'Withdrawn'
}
const PILL = { pending: 'pending', accepted: 'accepted', declined: 'declined', withdrawn: 'withdrawn' }

// Requests the user sent and received, with accept / decline / withdraw.
// `onOpenMessages(connection)` opens the conversation of an accepted connection.
export default function ConnectionsPanel({ onOpenMessages, onChanged, emptyHint }) {
  const toast = useToast()
  const [tab, setTab] = useState('received')
  const state = useApi(() => get('/network/connections').then((r) => r.data))

  const act = async (c, action) => {
    try {
      await patch(`/network/connections/${c.id}`, { action })
      toast({ accept: 'Connection accepted', decline: 'Request declined', withdraw: 'Request withdrawn' }[action])
      state.reload()
      onChanged?.()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <Async state={state}>{(all) => {
      const received = all.filter((c) => c.direction === 'received' && c.status === 'pending')
      const sent = all.filter((c) => c.direction === 'sent' && c.status === 'pending')
      const rest = all.filter((c) => c.status !== 'pending')
      const lists = { received, sent, history: rest }
      const rows = lists[tab]
      return (
        <>
          <Tabs
            tabs={[
              { id: 'received', label: 'Requests received', count: received.length },
              { id: 'sent', label: 'Requests sent', count: sent.length },
              { id: 'history', label: 'Accepted and past', count: rest.length },
            ]}
            value={tab} onChange={setTab}
          />
          <Card>
            {rows.length === 0 ? (
              <Empty title="Nothing here">{tab === 'received' ? 'New requests from the other side appear here.' : emptyHint}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((c) => (
                  <li key={c.id} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Person cp={c.counterpart} />
                        <StatusPill status={PILL[c.status]} label={connectionLabel(c)} />
                      </div>
                      {c.message && <p className="mt-2 max-w-2xl rounded-lg bg-canvas px-4 py-2.5 text-base whitespace-pre-line text-ink">{c.message}</p>}
                      <p className="mt-2 text-xs text-ink-soft">
                        {c.direction === 'sent' ? 'Sent' : 'Received'} {formatDateTime(c.createdAt)}
                        {c.respondedAt && ` · Answered ${formatDate(c.respondedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'pending' && c.direction === 'received' && (
                        <>
                          <Button size="sm" onClick={() => act(c, 'accept')}>Accept</Button>
                          <Button size="sm" variant="secondary" onClick={() => act(c, 'decline')}>Decline</Button>
                        </>
                      )}
                      {c.status === 'pending' && c.direction === 'sent' && <Button size="sm" variant="ghost" onClick={() => act(c, 'withdraw')}>Withdraw</Button>}
                      {c.status === 'accepted' && <Button size="sm" variant="secondary" onClick={() => onOpenMessages(c)}>{c.unread ? `Messages (${c.unread})` : 'Messages'}</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )
    }}</Async>
  )
}
