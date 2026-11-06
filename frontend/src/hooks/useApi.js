import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client.js'

// Loads data on mount (and when `deps` change).
// `load` returns a promise of the value to store, e.g. () => get('/startups/me').then((r) => r.data)
// Returns { data, setData, loading, error, reload }.
export default function useApi(load, deps = []) {
  const [data, setData] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadRef = useRef(load)
  loadRef.current = load
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    setError('')
    try {
      const value = await loadRef.current()
      if (id === seq.current) setData(value)
    } catch (err) {
      if (id === seq.current) setError(errorMessage(err))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, deps)

  return { data, setData, loading, error, reload }
}
