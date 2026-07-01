import { useCallback, useEffect, useState } from 'react'
import type { QueryOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'

/** Which access tier a list is showing: the user's own rows, or the company's. */
export type Tier = 'me' | 'team'

interface UseTierListResult<T> {
  /** Current tier; drives the My / Company toggle. */
  tier: Tier
  setTier: (tier: Tier) => void
  items: T[]
  loading: boolean
  /** True while a `loadMore` (next page) request is in flight. */
  loadingMore: boolean
  error: string | null
  /** True when another page is available via `page.next`. */
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Generic list loader for a `me`/`team`-scoped table.
 *
 * Owns the tier toggle, first-page load, cursor pagination (via `page.next`),
 * and loading/error state — so list screens stay presentational. Reloads from
 * the first page whenever the tier changes. `team` is only requested when the
 * table supports it (all five rcportal tables do, per the spec).
 *
 * `options` is serialised for the effect dependency, so callers can pass an
 * inline object literal without triggering a reload every render.
 */
export function useTierList<T>(
  table: string,
  options?: Pick<QueryOptions, 'select' | 'expand' | 'orderBy' | 'filter' | 'top'>,
  initialTier: Tier = 'me',
): UseTierListResult<T> {
  const client = useDataverseClient()
  const [tier, setTier] = useState<Tier>(initialTier)
  const [items, setItems] = useState<T[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const optionsKey = JSON.stringify(options ?? {})

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await client[tier].list<T>(table, options)
      setItems(res.data)
      setNext(res.page.next)
    } catch (err) {
      setItems([])
      setNext(null)
      setError(err instanceof Error ? err.message : 'Failed to load records')
    } finally {
      setLoading(false)
    }
    // optionsKey stands in for `options`; client/table/tier are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, table, tier, optionsKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!next) return
    setLoadingMore(true)
    setError(null)
    try {
      const res = await client[tier].fetchPage<T>(next)
      setItems((prev) => [...prev, ...res.data])
      setNext(res.page.next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more records')
    } finally {
      setLoadingMore(false)
    }
  }, [client, tier, next])

  return {
    tier,
    setTier,
    items,
    loading,
    loadingMore,
    error,
    hasMore: next !== null,
    loadMore,
    refresh,
  }
}
