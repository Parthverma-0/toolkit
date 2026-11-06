import { useState } from 'react'
import { Card, Empty, Progress } from '../../components/dashboard/Card.jsx'
import { Button, Detail, Drawer, PageHeader, StatusPill, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import { ErrorText, Field, Pills, Select, TextInput } from '../../components/ui/Field.jsx'
import { COMPLIANCE_DOC_TYPES, REPORT_TYPES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import { del, download, errorMessage, fileUrl, get, patch, post, toFormData } from '../../api/client.js'
import { formatDate, formatINRShort, humanize } from '../../utils/format.js'

const opts = (l) => l.map((x) => ({ id: x, label: humanize(x) }))
// Indian financial year runs April-March
const currentFY = () => {
  const d = new Date()
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String(start + 1).slice(2)}`
}
const FYS = (() => { const [s] = currentFY().split('-').map(Number); return [0, 1, 2].map((i) => `${s - i}-${String(s - i + 1).slice(2)}`) })()
// What each report type needs (mirrors GET /incubators/me/reports/types)
const NEEDS = {
  project_application: ['program'], project_completion: ['program'], year_end: ['financialYear'],
  cohort_end: ['cohort'], activity_report: ['from', 'to'], internal_compliance: ['financialYear'],
}
const GENERATED_DOCS = ['utilization_certificate', 'expenditure_report']

export default function Reports() {
  const [tab, setTab] = useState('reports')
  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate government and internal reports, and keep compliance documents in one place." />
      <Tabs tabs={[{ id: 'reports', label: 'Reports' }, { id: 'compliance', label: 'Compliance documents' }]} value={tab} onChange={setTab} />
      {tab === 'reports' ? <ReportList /> : <Compliance />}
    </div>
  )
}

function useBusy() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Runs fn; on success toasts and calls done, on failure shows the error inline (or as a toast)
  const run = async (fn, message, done, inline = true) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (message) toast(message)
      done?.()
    } catch (err) {
      const msg = errorMessage(err)
      if (inline) setError(msg)
      else toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function ReportList() {
  const state = useApi(() => get('/incubators/me/reports', { limit: 100 }).then((r) => r.data))
  const cohorts = useApi(() => get('/incubators/me/cohorts').then((r) => r.data))
  const programs = useApi(() => get('/incubators/me/programs').then((r) => r.data))
  const { busy, error, setError, run } = useBusy()
  const [draft, setDraft] = useState(null)
  const [submitting, setSubmitting] = useState(null)

  const needs = draft ? NEEDS[draft.type] ?? [] : []
  const generate = () => {
    const missing = needs.filter((n) => !draft[n])
    if (missing.length) return setError(`This report needs: ${missing.map(humanize).join(', ')}`)
    return run(() => post('/incubators/me/reports', {
      type: draft.type, format: draft.format,
      ...Object.fromEntries(needs.map((n) => [n, draft[n]])),
    }), 'Report generated', () => { setDraft(null); state.reload() })
  }

  const fileName = (r, ext) => `${r.title.replace(/[^\w-]+/g, '_')}.${ext}`
  const downloadAs = (r, ext) => run(() => download(`/incubators/me/reports/${r._id}/download`, fileName(r, ext), { fileType: ext }), null, null, false)

  return (
    <>
      <Card title="Generated reports" action={<Button size="sm" onClick={() => { setDraft({ type: 'activity_report', format: 'government', financialYear: currentFY(), cohort: '', program: '', from: '', to: '' }); setError('') }}>Generate report</Button>}>
        <Async state={state}>
          {(list) => (list.length === 0 ? <Empty>No reports yet.</Empty> : (
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-xs text-ink-soft">
                      {humanize(r.format)} format{r.financialYear && ` · FY ${r.financialYear}`}{r.cohort?.name && ` · ${r.cohort.name}`} · {formatDate(r.createdAt)}
                      {r.submittedTo && ` · submitted to ${r.submittedTo}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.status === 'generated' ? 'completed' : r.status} label={humanize(r.status)} />
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => downloadAs(r, 'pdf')}>PDF</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => downloadAs(r, 'xlsx')}>Excel</Button>
                    {r.status !== 'submitted' && (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => post(`/incubators/me/reports/${r._id}/regenerate`), 'Report refreshed with current numbers', state.reload, false)}>Refresh</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setSubmitting({ report: r, submittedTo: '' }); setError('') }}>Mark submitted</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => del(`/incubators/me/reports/${r._id}`), 'Report deleted', state.reload, false)}>Delete</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </Async>
      </Card>

      <Drawer open={Boolean(draft)} title="Generate report" subtitle="Pulls startups, funding, achievements and metrics for the period." onClose={() => setDraft(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={busy} onClick={generate}>{busy ? 'Generating...' : 'Generate'}</Button></>}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Report type" htmlFor="rpt" required>
              <Select id="rpt" value={draft.type} options={opts(REPORT_TYPES)} onChange={(e) => setDraft({ ...draft, type: e.target.value, format: e.target.value === 'internal_compliance' ? 'internal' : draft.format })} />
            </Field>
            <Field label="Format" required hint="Government format follows DST / DPIIT templates.">
              <Pills label="Format" options={opts(['government', 'internal'])} value={draft.format} onChange={(format) => setDraft({ ...draft, format })} />
            </Field>
            {needs.includes('financialYear') && (
              <Field label="Financial year" required><Pills label="Financial year" options={FYS.map((f) => ({ id: f, label: `FY ${f}` }))} value={draft.financialYear} onChange={(financialYear) => setDraft({ ...draft, financialYear })} /></Field>
            )}
            {needs.includes('cohort') && (
              <Field label="Cohort" htmlFor="rpc" required>
                <Select id="rpc" value={draft.cohort} placeholder="Choose a cohort" options={(cohorts.data ?? []).map((c) => ({ id: c._id, label: c.name }))} onChange={(e) => setDraft({ ...draft, cohort: e.target.value })} />
              </Field>
            )}
            {needs.includes('program') && (
              <Field label="Program" htmlFor="rpp" required hint={programs.data?.length === 0 ? 'You have no programs yet.' : undefined}>
                <Select id="rpp" value={draft.program} placeholder="Choose a program" options={(programs.data ?? []).map((p) => ({ id: p._id, label: p.name }))} onChange={(e) => setDraft({ ...draft, program: e.target.value })} />
              </Field>
            )}
            {needs.includes('from') && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From" htmlFor="rpf" required><TextInput id="rpf" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
                <Field label="To" htmlFor="rpto" required><TextInput id="rpto" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(submitting)} title="Mark report submitted" subtitle="A submitted report is locked and kept as a record." onClose={() => setSubmitting(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setSubmitting(null)}>Cancel</Button>
          <Button disabled={busy || !submitting?.submittedTo.trim()} onClick={() => run(() => patch(`/incubators/me/reports/${submitting.report._id}/submit`, { submittedTo: submitting.submittedTo.trim() }), 'Report marked submitted', () => { setSubmitting(null); state.reload() })}>Save</Button></>}>
        {submitting && (
          <Field label="Submitted to" htmlFor="rps" required hint="The agency or department, e.g. DST NIDHI.">
            <TextInput id="rps" maxLength={200} value={submitting.submittedTo} onChange={(e) => setSubmitting({ ...submitting, submittedTo: e.target.value })} />
          </Field>
        )}
      </Drawer>
    </>
  )
}

function Compliance() {
  const state = useApi(() => get('/incubators/me/compliance', { limit: 100 }).then((r) => r.data))
  const { busy, error, setError, run } = useBusy()
  const [draft, setDraft] = useState(null)

  const save = () => {
    if (draft.mode === 'upload' && (!draft.title.trim() || !draft.file)) return setError('Title and file are required')
    const done = () => { setDraft(null); state.reload() }
    if (draft.mode === 'generate') {
      return run(() => post('/incubators/me/compliance/generate', {
        docType: draft.docType, financialYear: draft.financialYear, title: draft.title.trim() || undefined,
        amountSanctioned: draft.amountSanctioned === '' ? undefined : +draft.amountSanctioned,
      }), 'Document generated', done)
    }
    return run(() => post('/incubators/me/compliance', toFormData({
      docType: draft.docType, title: draft.title.trim(), financialYear: draft.financialYear,
      amountSanctioned: draft.amountSanctioned, amountUtilized: draft.amountUtilized, file: draft.file,
    })), 'Document uploaded', done)
  }

  const canGenerate = draft && GENERATED_DOCS.includes(draft.docType)

  return (
    <>
      <Card title="Compliance documents" action={<Button size="sm" onClick={() => { setDraft({ mode: 'upload', docType: 'utilization_certificate', title: '', financialYear: currentFY(), amountSanctioned: '', amountUtilized: '', file: null }); setError('') }}>Add document</Button>}>
        <Async state={state}>
          {(list) => (list.length === 0 ? <Empty>No documents yet.</Empty> : (
            <ul className="divide-y divide-line">
              {list.map((d) => (
                <li key={d._id} className="grid gap-3 py-4 sm:grid-cols-[1fr_220px_auto] sm:items-center">
                  <div>
                    <a href={fileUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink hover:text-brand">{d.title}</a>
                    <p className="text-xs text-ink-soft">{humanize(d.docType)} · FY {d.financialYear}{d.submittedTo && ` · ${d.submittedTo}`}</p>
                  </div>
                  {d.amountSanctioned ? (
                    <div>
                      <p className="mb-1 text-xs text-ink-soft">{formatINRShort(d.amountUtilized ?? 0)} of {formatINRShort(d.amountSanctioned)} utilised</p>
                      <Progress value={d.amountUtilized || 0} total={d.amountSanctioned} />
                    </div>
                  ) : <span />}
                  <div className="flex items-center gap-2">
                    <StatusPill status={d.status === 'final' ? 'completed' : d.status} label={humanize(d.status)} />
                    {d.status === 'draft' && (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => patch(`/incubators/me/compliance/${d._id}`, toFormData({ status: 'final' })), 'Marked final', state.reload, false)}>Finalise</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => del(`/incubators/me/compliance/${d._id}`), 'Document deleted', state.reload, false)}>Delete</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </Async>
      </Card>

      <Drawer open={Boolean(draft)} title="Add compliance document" onClose={() => setDraft(null)}
        footer={<>{error && <ErrorText>{error}</ErrorText>}<Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? 'Working...' : draft?.mode === 'generate' ? 'Generate' : 'Upload'}</Button></>}>
        {draft && (
          <div className="grid gap-5">
            <Field label="Document type" htmlFor="cdt" required>
              <Select id="cdt" value={draft.docType} options={opts(COMPLIANCE_DOC_TYPES)}
                onChange={(e) => setDraft({ ...draft, docType: e.target.value, mode: GENERATED_DOCS.includes(e.target.value) ? draft.mode : 'upload' })} />
            </Field>
            {canGenerate && (
              <Field label="Source" required hint="Generate builds the PDF from your funding and financial records.">
                <Pills label="Source" options={[{ id: 'upload', label: 'Upload a file' }, { id: 'generate', label: 'Generate from records' }]} value={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />
              </Field>
            )}
            <Field label="Title" htmlFor="cdti" required={draft.mode === 'upload'} optional={draft.mode === 'generate'}>
              <TextInput id="cdti" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Financial year" required><Pills label="Financial year" options={FYS.map((f) => ({ id: f, label: `FY ${f}` }))} value={draft.financialYear} onChange={(financialYear) => setDraft({ ...draft, financialYear })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sanctioned (₹)" htmlFor="cds" optional><TextInput id="cds" type="number" min={0} value={draft.amountSanctioned} onChange={(e) => setDraft({ ...draft, amountSanctioned: e.target.value })} /></Field>
              {draft.mode === 'upload' && (
                <Field label="Utilised (₹)" htmlFor="cdu" optional><TextInput id="cdu" type="number" min={0} value={draft.amountUtilized} onChange={(e) => setDraft({ ...draft, amountUtilized: e.target.value })} /></Field>
              )}
            </div>
            {draft.mode === 'upload' && (
              <>
                <Field label="File (PDF)" htmlFor="cdf" required hint="Up to 20 MB.">
                  <input id="cdf" type="file" accept="application/pdf" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] || null })}
                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:border-glow" />
                </Field>
                {draft.file && <dl><Detail label="Selected">{draft.file.name}</Detail></dl>}
              </>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
