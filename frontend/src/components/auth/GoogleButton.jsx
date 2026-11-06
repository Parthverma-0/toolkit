import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { Loader2 } from 'lucide-react'
import { GOOGLE_CLIENT_ID } from '../../constants/config.js'

const GoogleLogo = () => (
  <span className="flex size-7 items-center justify-center rounded-md bg-white">
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  </span>
)

// Our styled button with Google's real (invisible) Sign-In button laid over it.
// Google only hands out an ID token from its own button, so clicks land on that one
// and onCredential(idToken) fires on success.
export default function GoogleButton({ children, loading, onCredential, onError }) {
  const boxRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(400, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const missing = !GOOGLE_CLIENT_ID

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        tabIndex={-1}
        disabled={loading}
        onClick={() => missing && onError?.('Google sign-in is not configured. Add GOOGLE_CLIENT_ID to backend/.env and restart the frontend.')}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white
          shadow-[0_10px_25px_-12px_rgba(37,99,235,0.8)] transition hover:bg-brand-dark
          disabled:cursor-wait disabled:opacity-80"
      >
        {loading
          ? <span className="flex size-7 items-center justify-center"><Loader2 size={18} className="animate-spin" /></span>
          : <GoogleLogo />}
        {children}
      </button>

      {!missing && !loading && width > 0 && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl opacity-[0.01]">
          <GoogleLogin
            onSuccess={(res) => (res.credential ? onCredential(res.credential) : onError?.('Google did not return a credential'))}
            onError={() => onError?.('Google sign-in was cancelled or failed. Try again.')}
            size="large"
            width={String(width)}
            text="continue_with"
            useOneTap={false}
          />
        </div>
      )}
      {missing && (
        <p className="mt-2 text-center text-xs text-red-600">Google sign-in is not configured yet (GOOGLE_CLIENT_ID missing).</p>
      )}
    </div>
  )
}
