import { useEffect, useMemo, useRef, useState } from 'react'
import { ErrorText } from '../ui/Field.jsx'
import { LOGO_MAX_MB, LOGO_TYPES } from '../../constants/startup.js'

export default function LogoUpload({ file, onChange, error }) {
  const inputRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const open = () => inputRef.current?.click()

  const pick = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (!LOGO_TYPES.includes(picked.type)) return setLocalError('Use a PNG, JPG or WebP image')
    if (picked.size > LOGO_MAX_MB * 1024 * 1024) return setLocalError(`Logo must be under ${LOGO_MAX_MB} MB`)
    setLocalError('')
    onChange(picked)
  }

  const shownError = localError || error

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={open}
          aria-label="Upload startup logo"
          className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition
            ${shownError ? 'border-red-300 bg-red-50/60' : 'border-line bg-canvas/70 hover:border-glow'}`}
        >
          {preview
            ? <img src={preview} alt="Startup logo preview" className="size-full object-cover" />
            : <span className="text-xs font-medium text-ink-soft">Logo</span>}
        </button>
        <div>
          <div className="flex items-center gap-2 text-base">
            <button type="button" onClick={open} className="font-semibold text-brand hover:text-brand-dark">
              {file ? 'Replace logo' : 'Upload logo'}
            </button>
            {file && (
              <>
                <span className="text-line">|</span>
                <button type="button" onClick={() => onChange(null)} className="text-ink-soft hover:text-ink">Remove</button>
              </>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">PNG, JPG or WebP, up to {LOGO_MAX_MB} MB. Square works best.</p>
        </div>
      </div>
      <ErrorText>{shownError}</ErrorText>
      <input ref={inputRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={pick} />
    </div>
  )
}
