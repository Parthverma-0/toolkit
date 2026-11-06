import { MailCheck, MailOpen, MailX, Send } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, useToast } from '../../components/dashboard/ui.jsx'
import Async, { Loading } from '../../components/dashboard/Async.jsx'
import { Field, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch, post } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'

const AUDIENCES = [{ id: 'cohort', label: 'A cohort' }, { id: 'startups', label: 'Chosen startups' }, { id: 'custom', label: 'Email list' }]
const EMPTY = { name: '', subject: '', body: '', audienceType: 'cohort', cohort: '', startupIds: [], emails: '', when: 'now', scheduledAt: '' }
const STATUS_LABEL = { sent: 'Sent', scheduled: 'Scheduled', draft: 'Draft', sending: 'Sending', failed: 'Failed' }
const pillStatus = (s) => ({ scheduled: 'upcoming', sent: 'completed', sending: 'in_progress' }[s] || s)
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-')
const parseEmails = (text) => [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]

// The editor is plain text; the API stores HTML
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text) => text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n')
const toText = (html = '') => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()

export default function Campaigns() {
  const state = useApi(() => get('/incubators/me/campaigns').then((r) => r.data))
  const cohorts = useApi(() => get('/incubators/me/cohorts').then((r) => r.data))
  const startups = useApi(() => get('/incubators/me/startups', { limit: 100, status: 'active' }).then((r) => r.data.map((s) => s.startup)))
  return (
    <Async state={state}>
      {(list) => <CampaignsView list={list} reload={state.reload} cohorts={cohorts.data ?? []} startups={startups.data ?? []} />}
    </Async>
  )
}

function CampaignsView({ list, reload, cohorts, startups }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sent = list.filter((c) => c.status === 'sent')
  const totals = sent.reduce((t, c) => ({ delivered: t.delivered + c.stats.delivered, opened: t.opened + c.stats.opened, failed: t.failed + c.stats.failed }), { delivered: 0, opened: 0, failed: 0 })

  const audienceReady = (d) => (d.audienceType === 'cohort' ? Boolean(d.cohort) : d.audienceType === 'startups' ? d.startupIds.length > 0 : parseEmails(d.emails).length > 0)

  const save = async (action) => {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) return setError('Name, subject and message are required')
    if (action !== 'draft' && !audienceReady(draft)) return setError('Choose who receives this campaign')
    if (action === 'schedule' && !draft.scheduledAt) return setError('Pick a date and time')
    const body = {
      name: draft.name.trim(), subject: draft.subject.trim(), bodyHtml: toHtml(draft.body.trim()),
      cohort: draft.audienceType === 'cohort' && draft.cohort ? draft.cohort : null,
      audience: {
        type: draft.audienceType,
        startups: draft.audienceType === 'startups' ? draft.startupIds : [],
        emails: draft.audienceType === 'custom' ? parseEmails(draft.emails) : [],
      },
    }
    setBusy(true)
    setError('')
    try {
      const saved = (draft._id ? await patch(`/incubators/me/campaigns/${draft._id}`, body) : await post('/incubators/me/campaigns', body)).data
      if (action === 'send') {
        const r = await post(`/incubators/me/campaigns/${saved._id}/send`)
        toast(`Sent to ${r.data?.stats?.recipients ?? 'all'} recipients`)
      } else if (action === 'schedule') {
        await post(`/incubators/me/campaigns/${saved._id}/schedule`, { scheduledAt: new Date(draft.scheduledAt).toISOString() })
        toast('Campaign scheduled')
      } else {
        toast('Draft saved')
      }
      setDraft(null)
      reload()
    } catch (err) {
      setError(errorMessage(err))
      // A draft that was created before send/schedule failed should be edited, not re-created
      reload()
    } finally {
      setBusy(false)
    }
  }

  const editDraft = (c) => {
    setViewingId(null)
    setError('')
    setDraft({
      ...EMPTY, _id: c._id, name: c.name, subject: c.subject, body: toText(c.bodyHtml), audienceType: c.audience.type,
      cohort: c.cohort?._id || c.cohort || '', startupIds: (c.audience.startups || []).map(String), emails: (c.audience.emails || []).join('\n'),
    })
  }

  const toggleStartup = (id) => setDraft((d) => ({ ...d, startupIds: d.startupIds.includes(id) ? d.startupIds.filter((x) => x !== id) : [...d.startupIds, id] }))
  const audienceLabel = (c) => (c.audience.type === 'cohort' ? c.cohort?.name || 'Cohort'
    : c.audience.type === 'startups' ? `${c.audience.startups?.length ?? 0} startups` : `${c.audience.emails?.length ?? 0} emails`)

  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Email your cohorts and prospective founders, and see who opened."
        action={<Button onClick={() => { setDraft({ ...EMPTY }); setError('') }}>New campaign</Button>} />

      <div className="mb-6 grid gap-6 sm:grid-cols-4">
        <Card><Stat icon={Send} value={sent.length} label="Campaigns sent" /></Card>
        <Card><Stat icon={MailCheck} value={totals.delivered.toLocaleString('en-IN')} label="Emails delivered" /></Card>
        <Card><Stat icon={MailOpen} value={pct(totals.opened, totals.delivered)} label="Open rate" /></Card>
        <Card><Stat icon={MailX} value={totals.failed.toLocaleString('en-IN')} label="Failed to deliver" /></Card>
      </div>

      <Card>
        {list.length === 0 ? <Empty>No campaigns yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="py-2 pr-4 font-medium">Campaign</th>
                  <th className="py-2 pr-4 font-medium">Audience</th>
                  <th className="py-2 pr-4 text-right font-medium">Recipients</th>
                  <th className="py-2 pr-4 text-right font-medium">Opened</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((c) => (
                  <tr key={c._id} onClick={() => setViewingId(c._id)} className="cursor-pointer hover:bg-brand-soft/60">
                    <td className="py-3 pr-4 font-medium text-ink">{c.name}<span className="block text-xs font-normal text-ink-soft">{c.subject}</span></td>
                    <td className="py-3 pr-4 text-ink-soft">{audienceLabel(c)}</td>
                    <td className="py-3 pr-4 text-right text-ink tabular-nums">{c.stats.recipients || '-'}</td>
                    <td className="py-3 pr-4 text-right text-ink tabular-nums">{c.status === 'sent' ? pct(c.stats.opened, c.stats.delivered) : '-'}</td>
                    <td className="py-3"><StatusPill status={pillStatus(c.status)}
                      label={c.status === 'scheduled' ? `Scheduled ${formatDateTime(c.scheduledAt)}` : STATUS_LABEL[c.status]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewingId && (
        <CampaignDrawer id={viewingId} audienceLabel={audienceLabel} onClose={() => setViewingId(null)} onEdit={editDraft}
          onChanged={(message) => { toast(message); setViewingId(null); reload() }} />
      )}

      <Drawer open={Boolean(draft)} title={draft?._id ? 'Edit campaign' : 'New campaign'} onClose={() => setDraft(null)}
        footer={draft && (
          <>
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => save('draft')}>Save draft</Button>
            <Button disabled={busy} onClick={() => save(draft.when === 'now' ? 'send' : 'schedule')}>{busy ? 'Working...' : draft.when === 'now' ? 'Send now' : 'Schedule'}</Button>
          </>
        )}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Campaign name" htmlFor="cpn" required hint="Only your team sees this.">
              <TextInput id="cpn" maxLength={150} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Subject line" htmlFor="cps" required>
              <TextInput id="cps" maxLength={200} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </Field>
            <Field label="Message" htmlFor="cpb" required hint="Blank lines start a new paragraph.">
              <Textarea id="cpb" rows={7} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Hi there," />
            </Field>
            <Field label="Send to" required>
              <Pills label="Audience" options={AUDIENCES} value={draft.audienceType} onChange={(audienceType) => setDraft({ ...draft, audienceType })} />
            </Field>
            {draft.audienceType === 'cohort' && (
              <Select aria-label="Cohort" value={draft.cohort} placeholder="Choose a cohort" options={cohorts.filter((c) => c.status !== 'draft').map((c) => ({ id: c._id, label: c.name }))} onChange={(e) => setDraft({ ...draft, cohort: e.target.value })} />
            )}
            {draft.audienceType === 'startups' && (startups.length === 0 ? <p className="text-sm text-ink-soft">You have no active startups yet.</p> : (
              <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-line p-3">
                {startups.map((s) => (
                  <label key={s._id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                    <input type="checkbox" checked={draft.startupIds.includes(s._id)} onChange={() => toggleStartup(s._id)} className="size-4 accent-brand" />{s.name}
                  </label>
                ))}
              </div>
            ))}
            {draft.audienceType === 'custom' && (
              <>
                <Textarea aria-label="Email addresses" rows={3} value={draft.emails} placeholder="Paste emails separated by commas or new lines" onChange={(e) => setDraft({ ...draft, emails: e.target.value })} />
                <p className="-mt-2 text-xs text-ink-soft">{parseEmails(draft.emails).length} valid emails</p>
              </>
            )}
            <Field label="When" required>
              <Pills label="When" options={[{ id: 'now', label: 'Send now' }, { id: 'later', label: 'Schedule' }]} value={draft.when} onChange={(when) => setDraft({ ...draft, when })} />
            </Field>
            {draft.when === 'later' && <TextInput aria-label="Send at" type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} />}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  )
}

function CampaignDrawer({ id, audienceLabel, onClose, onEdit, onChanged }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const state = useApi(async () => {
    const c = (await get(`/incubators/me/campaigns/${id}`)).data
    const count = ['draft', 'scheduled'].includes(c.status)
      ? await get(`/incubators/me/campaigns/${id}/recipients`).then((r) => r.data.count).catch(() => null)
      : c.stats.recipients
    return { ...c, recipientCount: count }
  }, [id])
  const c = state.data

  const act = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      onChanged(message)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open title={c?.name ?? 'Campaign'} subtitle={c?.subject} onClose={onClose}
      footer={c && (
        <>
          {c.status === 'draft' && <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => act(() => del(`/incubators/me/campaigns/${id}`), 'Draft deleted')}>Delete</Button>}
          {c.status === 'draft' && <Button variant="secondary" disabled={busy} onClick={() => onEdit(c)}>Edit</Button>}
          {c.status === 'scheduled' && <Button variant="secondary" disabled={busy} onClick={() => act(() => post(`/incubators/me/campaigns/${id}/unschedule`), 'Moved back to drafts')}>Unschedule</Button>}
          {['draft', 'scheduled'].includes(c.status) && (
            <Button disabled={busy || !c.recipientCount} onClick={() => act(() => post(`/incubators/me/campaigns/${id}/send`), 'Campaign sent')}>Send now</Button>
          )}
        </>
      )}>
      {state.loading ? <Loading /> : state.error ? <p className="text-sm text-red-600">{state.error}</p> : (
        <div className="grid gap-5">
          <dl className="grid gap-2">
            <Detail label="Status"><StatusPill status={pillStatus(c.status)} label={STATUS_LABEL[c.status]} /></Detail>
            <Detail label="Audience">{audienceLabel(c)}</Detail>
            <Detail label="Recipients">{c.recipientCount ?? '-'}</Detail>
            {c.sentAt && <Detail label="Sent">{formatDateTime(c.sentAt)}</Detail>}
            {c.scheduledAt && <Detail label="Scheduled for">{formatDateTime(c.scheduledAt)}</Detail>}
            {['sent', 'failed'].includes(c.status) && (
              <>
                <Detail label="Delivered">{c.stats.delivered}</Detail>
                <Detail label="Opened">{c.stats.opened} ({pct(c.stats.opened, c.stats.delivered)})</Detail>
                <Detail label="Failed">{c.stats.failed}</Detail>
              </>
            )}
          </dl>
          <div className="rounded-xl border border-line p-4 text-sm whitespace-pre-line text-ink">{toText(c.bodyHtml)}</div>
        </div>
      )}
    </Drawer>
  )
}
