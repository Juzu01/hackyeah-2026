import { useEffect, useState } from 'react'

/** How long a sheet's slide-out runs before it unmounts (matches ui.css). */
export const SHEET_EXIT_MS = 220

/**
 * Keeps showing the last value for SHEET_EXIT_MS after it turns null, so a sheet
 * can slide out with its content instead of vanishing.
 */
export function usePresence<T>(value: T | null): [T | null, boolean] {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  useEffect(() => {
    if (value !== null || last === null) return
    const timer = setTimeout(() => setLast(null), SHEET_EXIT_MS)
    return () => clearTimeout(timer)
  }, [value, last])
  return [value ?? last, value === null && last !== null]
}
