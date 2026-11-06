import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Wordmark from '../Wordmark.jsx'
import RoleSelector from './RoleSelector.jsx'
import GoogleButton from './GoogleButton.jsx'
import { DEFAULT_ROLE, ROLES, isRole } from '../../constants/roles.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { landingFor } from '../../constants/auth.js'
import { errorMessage } from '../../api/client.js'
import { DEMO_ENABLED, DEMO_ROLES, startDemo } from '../../demo/session.js'

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Choose how you sign in to Toolkit.',
    cta: 'Sign in with Google',
    switchText: "Don't have an account?",
    switchLink: 'Create one',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Pick your role to get started. One email can only hold one role.',
    cta: 'Sign up with Google',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
    switchTo: '/login',
  },
}

// Shared card for /login and /signup. The chosen role lives in ?role= so it
// survives switching between the two pages.
export default function AuthCard({ mode }) {
  const copy = COPY[mode]
  const [params, setParams] = useSearchParams()
  const role = isRole(params.get('role')) ? params.get('role') : DEFAULT_ROLE
  const selected = ROLES.find((r) => r.id === role)
  const hint = mode === 'signup' ? selected.signupHint : selected.loginHint

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null) // { text, switchTo? }

  const setRole = (id) => {
    setNotice(null)
    setParams({ role: id }, { replace: true })
  }

  const navigate = useNavigate()
  const { signIn, refreshMe } = useAuth()

  // Demo: no sign-in, sample data answered in the browser
  const tryDemo = async () => {
    startDemo(role)
    const session = await refreshMe()
    if (session?.user) navigate(landingFor(session), { replace: true })
  }

  // Google ID token -> POST /api/auth/google with intent. Backend error codes become friendly notices.
  const handleCredential = async (credential) => {
    setLoading(true)
    setNotice(null)
    try {
      const session = await signIn({ credential, intent: mode, role })
      if (session.user.role === 'admin') {
        setNotice({ text: 'Admin accounts use the admin console, which is not built yet.' })
        return
      }
      navigate(landingFor(session), { replace: true })
    } catch (err) {
      const code = err?.response?.data?.code
      const text = errorMessage(err)
      if (code === 'ACCOUNT_NOT_FOUND') setNotice({ text, switchTo: '/signup', switchLabel: 'Create an account' })
      else if (code === 'ACCOUNT_EXISTS') setNotice({ text, switchTo: '/login', switchLabel: 'Sign in' })
      else setNotice({ text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_12px_32px_-24px_rgba(30,64,175,0.35)] sm:p-8">
      <div className="mb-6">
        <p className="mb-6 text-center lg:hidden"><Wordmark size="md" /></p>
        <span aria-hidden="true" className="mb-4 block h-1 w-12 rounded-full bg-brand" />
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight text-ink">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-ink-soft">{copy.subtitle}</p>
      </div>

      <p className="mb-2.5 text-xs font-semibold tracking-wider text-brand uppercase">
        {mode === 'login' ? 'Sign in as' : 'I am a'}
      </p>
      <RoleSelector value={role} onChange={setRole} />

      {hint && (
        <p className="mt-3 rounded-lg border-l-2 border-brand bg-brand-soft/80 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          {hint}
        </p>
      )}

      <div className="mt-6">
        <GoogleButton loading={loading} onCredential={handleCredential} onError={(text) => setNotice({ text })}>
          {copy.cta}
        </GoogleButton>
      </div>

      {DEMO_ENABLED && DEMO_ROLES.includes(role) && (
        <>
          <button
            type="button"
            onClick={tryDemo}
            className="mt-3 h-12 w-full rounded-xl border border-line bg-white text-base font-semibold text-ink transition hover:border-glow hover:text-brand"
          >
            Explore the {selected.label.toLowerCase()} demo
          </button>
          <p className="mt-1.5 text-center text-[11px] text-ink-soft">No sign-in needed. Sample data, nothing is saved.</p>
        </>
      )}

      {notice && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">
          {notice.text}
          {notice.switchTo && (
            <>
              {' '}
              <Link to={`${notice.switchTo}?role=${role}`} className="font-semibold underline underline-offset-2">
                {notice.switchLabel}
              </Link>
            </>
          )}
        </p>
      )}

      {mode === 'signup' && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-soft">
          By continuing you agree to Toolkit&apos;s Terms of Service and Privacy Policy.
        </p>
      )}

      <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
        {copy.switchText}{' '}
        <Link
          to={`${copy.switchTo}?role=${role}`}
          className="font-semibold text-brand underline-offset-4 hover:text-brand-dark hover:underline"
        >
          {copy.switchLink}
        </Link>
      </div>
    </div>
  )
}
