import { useRef, useState } from 'react'
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react'
import { Button, useToast } from '../dashboard/ui.jsx'
import { ErrorText, Select } from '../ui/Field.jsx'
import { DOCUMENT_TYPES, labelOf } from '../../constants/investor.js'
import api, { del, errorMessage, post, toFormData } from '../../api/client.js'
import { formatDate } from '../../utils/format.js'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const MAX_MB = 10

// Absolute path the browser can open in a new tab (cookie auth). Documents are private,
// so this route checks that the signed-in user owns the file (or is an admin).
export const documentHref = (path) => `${api.defaults.baseURL}${path}`

// Verification documents: upload, list, open, remove. Files are stored privately and only
// the investor and our admins can open them.
export default function DocumentsManager({ documents, onChange, readOnly = false, hrefFor }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [type, setType] = useState('pan')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) return setError('Upload a PDF or an image (PNG, JPG, WebP)')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File must be under ${MAX_MB} MB`)
    setBusy(true)
    setError('')
    try {
      const { data } = await post('/investor-portal/me/documents', toFormData({ type, name: file.name, file }))
      onChange(data)
      toast('Document uploaded')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (doc) => {
    try {
      const { data } = await del(`/investor-portal/me/documents/${doc.id ?? doc._id}`)
      onChange(data)
      toast('Document removed')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div className="grid gap-5">
      {documents.length === 0 ? (
        <p className="text-base text-ink-soft">No documents uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {documents.map((d) => {
            const id = d.id ?? d._id
            return (
              <li key={id} className="flex items-center gap-4 px-4 py-3">
                <FileText size={20} className="shrink-0 text-brand" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-ink">{labelOf(DOCUMENT_TYPES, d.type)}</p>
                  <p className="truncate text-sm text-ink-soft">{d.name} · {formatDate(d.uploadedAt)}</p>
                </div>
                <a
                  href={hrefFor(d)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
                >
                  View <ExternalLink size={14} />
                </a>
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${d.name}`} onClick={() => remove(d)} className="rounded-lg p-2 text-ink-soft hover:bg-canvas hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly && (
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-sm">
              <label htmlFor="doctype" className="mb-1.5 block text-[15px] font-semibold text-ink">Document type</label>
              <Select id="doctype" value={type} options={DOCUMENT_TYPES} onChange={(e) => setType(e.target.value)} />
            </div>
            <Button variant="secondary" disabled={busy || documents.length >= 10} onClick={() => inputRef.current?.click()}>
              <span className="inline-flex items-center gap-2"><Upload size={18} /> {busy ? 'Uploading...' : 'Choose file'}</span>
            </Button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={upload} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">PDF or image, up to {MAX_MB} MB. Documents are private: only you and our verification team can open them.</p>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  )
}
