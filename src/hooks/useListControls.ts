import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * List filter + sort state backed by the URL query (`?f=<filter>&s=<sort>`).
 *
 * Keeping it in the URL means the dashboard's "needs attention" links can deep
 * into a pre-filtered, pre-sorted list (e.g. `/projects?f=overdue`), and the
 * state survives back/forward and refresh. Falls back to the given defaults.
 */
export function useListControls(defaultFilter: string, defaultSort: string) {
  const [params, setParams] = useSearchParams()
  const filter = params.get('f') ?? defaultFilter
  const sort = params.get('s') ?? defaultSort

  // Memoised so the setters are stable identities — safe to list in effect deps
  // (e.g. the "reset a disabled pill to All" effects on the list pages).
  const update = useCallback(
    (key: 'f' | 's', value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(key, value)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const setFilter = useCallback((f: string) => update('f', f), [update])
  const setSort = useCallback((s: string) => update('s', s), [update])

  return { filter, sort, setFilter, setSort }
}
