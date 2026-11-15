import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import Async, { LoadError } from '../../components/dashboard/Async.jsx'
import { Button, useToast } from '../../components/dashboard/ui.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import { reportBlob, reportFileName, saveBlob } from '../../reports/download.js'

// One saved report: PDF preview, download, run again with the same inputs, delete.
export default function ToolReport() {
  const { type, id } = useParams()
  const report = useApi(() => get(`/tools/reports/${id}`).then((r) => r.data), [id])
  const tool = useApi(() => get(`/tools/${type}`).then((r) => r.data), [type])

  return (
    <div>
      <Link to={`/startup/tools/${type}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-brand">
        <ArrowLeft size={16} aria-hidden="true" /> Back to {tool.data?.name ?? 'the tool'}
      </Link>
      <Async state={report} label="Loading report...">
        {(r) => <ReportView submission={r} type={type} fields={tool.data?.fields ?? []} />}
      </Async>
    </div>
  )
}

function ReportView({ submission, type, fields }) {
  const navigate = useNavigate()
  const toast = useToast()
  const report = { ...submission.output, generatedAt: submission.output?.generatedAt ?? submission.createdAt }
  const [pdf, setPdf] = useState({ blob: null, url: '', error: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let url = ''
    let cancelled = false
    reportBlob(report)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPdf({ blob, url, error: '' })
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setPdf({ blob: null, url: '', error: 'The PDF could not be prepared. Please reload the page.' })
      })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission._id])

  const remove = async () => {
    setDeleting(true)
    try {
      await del(`/tools/reports/${submission._id}`)
      toast?.('Report deleted')
      navigate(`/startup/tools/${type}`, { replace: true })
    } catch (err) {
      setDeleting(false)
      toast?.(errorMessage(err), 'error')
    }
  }

  const inputs = fields.filter((f) => submission.input?.[f.name])

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span aria-hidden="true" className="mb-4 block h-1 w-[47px] rounded-full bg-brand" />
          <h1 className="font-display text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">{report.title}</h1>
          {report.subtitle && <p className="mt-2.5 max-w-3xl text-base text-ink-soft sm:text-lg">{report.subtitle}</p>}
          <p className="mt-2 text-sm text-ink-soft">Generated {formatDateTime(submission.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button disabled={!pdf.blob} onClick={() => saveBlob(pdf.blob, reportFileName(report))}>
            <span className="flex items-center gap-2"><Download size={18} aria-hidden="true" /> Download PDF</span>
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/startup/tools/${type}`, { state: { input: submission.input } })}>
            <span className="flex items-center gap-2"><RotateCcw size={18} aria-hidden="true" /> Run again</span>
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="danger" disabled={deleting} onClick={remove}>{deleting ? 'Deleting...' : 'Confirm delete'}</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <span className="flex items-center gap-2"><Trash2 size={18} aria-hidden="true" /> Delete</span>
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Report preview" className="overflow-hidden rounded-xl border border-line bg-[#eef1f6]">
          {pdf.error && <div className="p-5"><LoadError message={pdf.error} /></div>}
          {!pdf.error && !pdf.url && (
            <div className="flex h-[60vh] items-center justify-center gap-3 text-base text-ink-soft">
              <Loader2 size={22} className="animate-spin text-brand" aria-hidden="true" /> Preparing the PDF...
            </div>
          )}
          {pdf.url && <iframe title={report.title} src={`${pdf.url}#view=FitH`} className="block h-[80vh] w-full bg-white" />}
          {pdf.url && (
            <p className="border-t border-line bg-white px-4 py-2.5 text-sm text-ink-soft">
              If the preview does not show on your device, use Download PDF.
            </p>
          )}
        </section>

        <aside className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Inputs used</h2>
          <p className="mt-1 text-sm text-ink-soft">Plus your startup profile, founders, metrics and achievements.</p>
          <dl className="mt-4 space-y-4">
            {inputs.map((f) => (
              <div key={f.name}>
                <dt className="text-sm font-semibold text-ink">{f.label}</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-line text-ink-soft">{submission.input[f.name]}</dd>
              </div>
            ))}
            {submission.attachments?.map((a) => (
              <div key={a.name}>
                <dt className="text-sm font-semibold text-ink">Attached file</dt>
                <dd className="mt-0.5 text-sm text-ink-soft">{a.name}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  )
}
