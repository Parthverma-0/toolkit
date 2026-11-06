import { Loader2 } from 'lucide-react'

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-base text-ink-soft">
      <Loader2 size={22} className="animate-spin text-brand" aria-hidden="true" />
      {label}
    </div>
  )
}

export function LoadError({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 font-semibold underline underline-offset-2">Try again</button>
      )}
    </div>
  )
}

// Renders loading / error states for a useApi() result, otherwise children(data).
// Keeps showing stale data while a reload is in flight.
export default function Async({ state, children, label }) {
  if (state.error && state.data === undefined) return <LoadError message={state.error} onRetry={state.reload} />
  if (state.data === undefined) return <Loading label={label} />
  return children(state.data)
}
