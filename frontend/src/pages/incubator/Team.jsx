import { useState } from 'react'
import { Badge, Card, Progress } from '../../components/dashboard/Card.jsx'
import { Button, Drawer, PageHeader, StatusPill, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, TextInput } from '../../components/ui/Field.jsx'
import { EMAIL_REGEX } from '../../constants/startup.js'
import { useAuth } from '../../context/AuthContext.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, post } from '../../api/client.js'
import { formatDate } from '../../utils/format.js'

export default function Team() {
  const state = useApi(() => get('/incubators/me/members').then((r) => ({ members: r.data, seats: r.seats })))
  return <Async state={state}>{(data) => <TeamView {...data} reload={state.reload} />}</Async>
}

function TeamView({ members, seats, reload }) {
  const toast = useToast()
  const { user } = useAuth()
  const isHead = user?.incubatorRole === 'head'
  const [inviting, setInviting] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const full = seats.available <= 0

  const invite = async () => {
    const email = inviting.email.trim().toLowerCase()
    if (!inviting.name.trim()) return setError('Enter their name')
    if (!EMAIL_REGEX.test(email)) return setError('Enter a valid email')
    if (members.some((m) => m.email === email)) return setError('This person is already on your team')
    setBusy(true)
    try {
      await post('/incubators/me/members', { name: inviting.name.trim(), email })
      setInviting(null)
      setError('')
      toast(`Invite sent to ${email}`)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn, message) => {
    try {
      await fn()
      toast(message)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Team" subtitle="Your incubator head and up to 4 members share this dashboard. Members sign in with Google using the invited email."
        action={isHead && <Button disabled={full} onClick={() => { setInviting({ name: '', email: '' }); setError('') }}>{full ? 'All seats used' : 'Invite member'}</Button>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card title="Members">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{m.name}{m._id === user?.id && <span className="text-ink-soft"> (you)</span>}</p>
                  <p className="text-xs text-ink-soft">
                    {m.email} · {m.status === 'invited' ? `invited ${formatDate(m.createdAt)}` : m.lastLoginAt ? `last active ${formatDate(m.lastLoginAt)}` : `joined ${formatDate(m.createdAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.incubatorRole === 'head'
                    ? <Badge tone="brand">Head</Badge>
                    : <StatusPill status={m.status === 'invited' ? 'pending' : 'active'} label={m.status === 'invited' ? 'Invite pending' : 'Member'} />}
                  {isHead && m.incubatorRole !== 'head' && (
                    <>
                      {m.status === 'invited' && (
                        <Button size="sm" variant="ghost" onClick={() => act(() => post(`/incubators/me/members/${m._id}/resend-invite`), `Invite resent to ${m.email}`)}>Resend</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => act(() => del(`/incubators/me/members/${m._id}`), `${m.name} removed`)}>Remove</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Seats">
          <p className="font-display text-3xl font-bold text-ink">{seats.used}<span className="text-lg text-ink-soft"> / {seats.limit}</span></p>
          <p className="mt-0.5 mb-4 text-sm text-ink-soft">{seats.available} seats free</p>
          <Progress value={seats.used} total={seats.limit} />
          <p className="mt-4 text-xs text-ink-soft">Need more seats? Each additional unit adds 5 seats. Contact the ToolKit team to add a unit.</p>
        </Card>
      </div>

      <Drawer open={Boolean(inviting)} title="Invite a team member" subtitle="They get an email and can sign in with Google using this address." onClose={() => setInviting(null)}
        footer={(
          <>
            {error && <ErrorText>{error}</ErrorText>}
            <Button variant="ghost" onClick={() => setInviting(null)}>Cancel</Button>
            <Button onClick={invite} disabled={busy}>{busy ? 'Sending...' : 'Send invite'}</Button>
          </>
        )}>
        {inviting && (
          <div className="grid gap-5">
            <Field label="Name" htmlFor="tn" required><TextInput id="tn" value={inviting.name} onChange={(e) => setInviting({ ...inviting, name: e.target.value })} /></Field>
            <Field label="Email" htmlFor="te" required hint="Must be a Google account. One email can only hold one role on ToolKit.">
              <TextInput id="te" type="email" value={inviting.email} onChange={(e) => setInviting({ ...inviting, email: e.target.value })} />
            </Field>
          </div>
        )}
      </Drawer>
    </div>
  )
}
