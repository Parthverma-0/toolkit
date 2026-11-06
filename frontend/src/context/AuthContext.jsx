import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { get, onSessionExpired, post } from '../api/client.js'


const AuthContext = createContext(null)

// Session lives in httpOnly cookies; this keeps the current user in memory.
// status: 'loading' (checking cookies) | 'ready'
export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, needsOnboarding: false })
  const [status, setStatus] = useState('loading')

  const refreshMe = useCallback(async () => {
    try {
      const res = await get('/auth/me')
      const next = { user: res.user, needsOnboarding: res.needsOnboarding }
      setSession(next)
      return next
    } catch {
      setSession({ user: null, needsOnboarding: false })
      return null
    } finally {
      setStatus('ready')
    }
  }, [])

  useEffect(() => { refreshMe() }, [refreshMe])
  useEffect(() => onSessionExpired(() => setSession({ user: null, needsOnboarding: false })), [])

  // credential = Google ID token. intent: 'login' | 'signup'. Throws API errors (with .response.data.code).
  const signIn = useCallback(async ({ credential, intent, role }) => {
    const res = await post('/auth/google', { credential, intent, role })
    if (res.requiresRole) return { requiresRole: true }
    const next = { user: res.user, needsOnboarding: res.needsOnboarding }
    setSession(next)
    return next
  }, [])

  const signOut = useCallback(async () => {
    try { await post('/auth/logout') } catch { /* cookies are cleared server-side when reachable */ }
    setSession({ user: null, needsOnboarding: false })
  }, [])

  // Patch the in-memory user after profile changes (e.g. phone verified)
  const updateUser = useCallback((user) => setSession((s) => ({ ...s, user: { ...s.user, ...user } })), [])

  const value = useMemo(() => ({
    ...session, status, signIn, signOut, refreshMe, updateUser,
  }), [session, status, signIn, signOut, refreshMe, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
