import { useEffect, useState } from 'react'

// Returns `value` after it has stopped changing for `ms` (for search boxes that hit the API)
export default function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
