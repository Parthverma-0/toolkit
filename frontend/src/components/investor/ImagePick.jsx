import { useEffect, useMemo, useRef, useState } from 'react'
import { ErrorText } from '../ui/Field.jsx'
import { fileUrl } from '../../api/client.js'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

// Optional image (photo / logo): shows the saved image (`url`) or the newly picked `file`
export default function ImagePick({ label, file, url, onChange, error, round = false }) {
  const inputRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (!TYPES.includes(picked.type)) return setLocalError('Use a PNG, JPG or WebP image')
    if (picked.size > MAX_MB * 1024 * 1024) return setLocalError(`Image must be under ${MAX_MB} MB`)
    setLocalError('')
    onChange(picked)
  }
  const shown = preview || fileUrl(url)
  const shownError = localError || error

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button" onClick={() => inputRef.current?.click()} aria-label={`Upload ${label.toLowerCase()}`}
          className={`flex size-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed transition
            ${round ? 'rounded-full' : 'rounded-xl'} ${shownError ? 'border-red-300 bg-red-50/60' : 'border-line bg-canvas/70 hover:border-glow'}`}
        >
          {shown ? <img src={shown} alt={`${label} preview`} className="size-full object-cover" /> : <span className="text-xs font-medium text-ink-soft">{label}</span>}
        </button>
        <div>
          <button type="button" onClick={() => inputRef.current?.click()} className="text-base font-semibold text-brand hover:text-brand-dark">
            {shown ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </button>
          {file && <button type="button" onClick={() => onChange(null)} className="ml-3 text-base text-ink-soft hover:text-ink">Undo</button>}
          <p className="mt-0.5 text-sm text-ink-soft">PNG, JPG or WebP, up to {MAX_MB} MB.</p>
        </div>
      </div>
      <ErrorText>{shownError}</ErrorText>
      <input ref={inputRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={pick} />
    </div>
  )
}
