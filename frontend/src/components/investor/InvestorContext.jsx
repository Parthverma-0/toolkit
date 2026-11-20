import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadError, Loading } from '../dashboard/Async.jsx'
import InvestorProfileDialog from './InvestorProfileDialog.jsx'
import useApi from '../../hooks/useApi.js'
import { get, onProfileRequired } from '../../api/client.js'

// The signed-in investor's own profile, loaded once for the whole /investor area.
// Investors reach the dashboard right after signing up with no profile (profile = null).
// Actions that need one call requireProfile(action), or the API answers 403 PROFILE_INCOMPLETE;
// either way the "complete your profile" popup opens and the action runs once it is saved.
const InvestorContext = createContext(null)

// null outside the investor area
// eslint-disable-next-line react-refresh/only-export-components
export const useInvestor = () => useContext(InvestorContext)

export function InvestorProvider({ children }) {
  const state = useApi(() => get('/investor-portal/me/profile').then((r) => r.data))
  const [prompt, setPrompt] = useState(null) // null = closed, otherwise { reason, then }
  const [version, setVersion] = useState(0) // bumps after saving so pages reload their data
  const profile = state.data ?? null
  const complete = Boolean(profile?.submittedAt)

  const openProfileForm = useCallback((reason, then) => setPrompt({ reason, then }), [])
  const requireProfile = useCallback((action, reason = 'action') => {
    if (complete) return action?.()
    setPrompt({ reason, then: action })
    return undefined
  }, [complete])

  useEffect(() => onProfileRequired(() => setPrompt((p) => p ?? { reason: 'action' })), [])

  const handleSaved = async () => {
    const then = prompt?.then
    setPrompt(null)
    await state.reload()
    setVersion((v) => v + 1)
    then?.()
  }

  const value = useMemo(() => ({
    profile,
    complete,
    version,
    verified: profile?.verification?.status === 'verified',
    reload: state.reload,
    setProfile: state.setData,
    requireProfile,
    openProfileForm,
  }), [profile, complete, version, state.reload, state.setData, requireProfile, openProfileForm])

  if (state.error && state.data === undefined) return <div className="p-8"><LoadError message={state.error} onRetry={state.reload} /></div>
  if (state.data === undefined) return <Loading />
  return (
    <InvestorContext.Provider value={value}>
      {/* key = version: pages remount and refetch (e.g. match scores) once the profile is saved */}
      <div key={version}>{children}</div>
      {prompt && <InvestorProfileDialog profile={profile} reason={prompt.reason} onClose={() => setPrompt(null)} onSaved={handleSaved} />}
    </InvestorContext.Provider>
  )
}
