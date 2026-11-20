import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { Card, Empty } from '../dashboard/Card.jsx'
import { Button, useToast } from '../dashboard/ui.jsx'
import Async, { Loading } from '../dashboard/Async.jsx'
import { Person } from './People.jsx'
import useApi from '../../hooks/useApi.js'
import { errorMessage, get, post } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'

const POLL_MS = 10000

// One conversation: messages (refreshed every few seconds) and a composer
function Thread({ connection, onBack, onActivity }) {
  const toast = useToast()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)
  const id = connection.id

  useEffect(() => {
    let alive = true
    const load = () => get(`/network/connections/${id}/messages`)
      .then((r) => { if (alive) { setMessages(r.data); onActivity?.() } })
      .catch(() => {})
    setMessages(null)
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages?.length])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const { data } = await post(`/network/connections/${id}/messages`, { body })
      setMessages((m) => [...(m ?? []), data])
      setText('')
      onActivity?.()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <button type="button" aria-label="Back to conversations" onClick={onBack} className="rounded-lg p-1.5 text-ink-soft hover:bg-canvas lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <Person cp={connection.counterpart} />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: 280 }}>
        {messages === null && <Loading />}
        {messages?.length === 0 && (
          <Empty title="Say hello">Introduce yourself and what you would like to discuss.</Empty>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-base ${m.mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-canvas text-ink'}`}>
              <p className="break-words whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-xs ${m.mine ? 'text-white/70' : 'text-ink-soft'}`}>{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-3 border-t border-line px-5 py-4">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Write a message"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#d5dae3] px-4 py-2.5 text-base text-ink focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
        />
        <Button type="submit" disabled={!text.trim() || sending} aria-label="Send message"><Send size={18} /></Button>
      </form>
    </div>
  )
}

// Conversation list + thread for accepted connections (investor "Messages" page, founder "Messages" tab)
export default function Messenger({ initialId }) {
  const state = useApi(() => get('/network/connections', { status: 'accepted' }).then((r) => r.data))
  const [activeId, setActiveId] = useState(initialId ?? null)

  return (
    <Async state={state}>{(list) => {
      if (list.length === 0) {
        return <Card><Empty title="No conversations yet">Once a connection request is accepted you can message each other here.</Empty></Card>
      }
      const sorted = [...list].sort((a, b) => new Date(b.lastMessageAt ?? b.respondedAt ?? 0) - new Date(a.lastMessageAt ?? a.respondedAt ?? 0))
      const active = sorted.find((c) => c.id === activeId)
      return (
        <div className="grid overflow-hidden rounded-xl border border-line bg-white shadow-[0_4px_16px_-6px_rgba(15,23,42,0.08)] lg:grid-cols-[320px_1fr]">
          <ul className={`divide-y divide-line border-r border-line ${active ? 'hidden lg:block' : ''}`}>
            {sorted.map((c) => (
              <li key={c.id}>
                <button
                  type="button" onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-brand-soft/50 ${c.id === activeId ? 'bg-brand-soft/60' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <Person cp={c.counterpart} />
                    <p className="mt-1 truncate pl-[52px] text-sm text-ink-soft">{c.lastMessagePreview || 'No messages yet'}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">{c.unread}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className={active ? '' : 'hidden lg:block'}>
            {active
              ? <Thread key={active.id} connection={active} onBack={() => setActiveId(null)} onActivity={state.reload} />
              : <div className="grid h-full min-h-[360px] place-items-center text-ink-soft">Select a conversation</div>}
          </div>
        </div>
      )
    }}</Async>
  )
}
