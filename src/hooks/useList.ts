import { useEffect } from 'react'
import type { OrderBy } from '@truenorth-it/dataverse-client'
import { useTierList, type Tier } from './useTierList'
import { usePillCounts } from './usePillCounts'
import { useListControls } from './useListControls'
import type { Pill } from '../services/pills'

/** A sort option: a labelled key mapped to an OData order. */
export interface SortOption {
  key: string
  label: string
  order: OrderBy
}

export interface UseListConfig<T> {
  /** SDK route/table, e.g. 'project'. */
  table: string
  /** Columns to fetch. */
  select: string[]
  /** Filter pills (first is the no-filter "all"). */
  pills: Pill[]
  /** Sort options offered in the Sort control. */
  sorts: SortOption[]
  /** Default sort key when the URL has none. */
  defaultSort: string
  /** Default filter key when the URL has none. Defaults to 'all'. */
  defaultFilter?: string
  /** Tier to open on. Defaults to 'team' (company view). */
  defaultTier?: Tier
  /** Page size. Defaults to 25. */
  top?: number
  /**
   * Filter over already-loaded rows instead of via the server. Set this when a
   * pill maps to a value the API can't cheaply filter/count (e.g. a site's
   * connectivity label): filtering and pill-greying then happen client-side.
   */
  clientFilter?: (item: T, filterKey: string) => boolean
}

export interface UseListResult<T> {
  tier: Tier
  setTier: (tier: Tier) => void
  filter: string
  setFilter: (key: string) => void
  sort: string
  setSort: (key: string) => void
  activeSort: SortOption
  pills: Pill[]
  /** Pill keys with no matching rows — rendered greyed-out. */
  disabledKeys: Set<string>
  /** Rows to render (already client-filtered when `clientFilter` is set). */
  items: T[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
  refresh: () => void
}

/**
 * Everything a filtered/sorted, tier-toggled list screen needs, in one call.
 *
 * Wraps {@link useTierList} (data + My/Company toggle + pagination),
 * {@link useListControls} (filter/sort in the URL), and {@link usePillCounts}
 * (grey out empty pills). Server-side by default — the active pill's filter is
 * pushed to the API and counts come from aggregates. Pass `clientFilter` to
 * filter and grey pills over the loaded rows instead.
 *
 * A pill that becomes unavailable while selected resets to "all", so a stale
 * deep-link (e.g. `?f=overdue` with nothing overdue) never shows an empty list.
 */
export function useList<T>(config: UseListConfig<T>): UseListResult<T> {
  const {
    table,
    select,
    pills,
    sorts,
    defaultSort,
    defaultFilter = 'all',
    defaultTier = 'team',
    top = 25,
    clientFilter,
  } = config

  const { filter, setFilter, sort, setSort } = useListControls(defaultFilter, defaultSort)
  const activeSort = sorts.find((s) => s.key === sort) ?? sorts[0]
  // Server mode pushes the active pill's filter to the API; client mode fetches
  // unfiltered and narrows the rows in memory.
  const serverFilter = clientFilter ? undefined : pills.find((p) => p.key === filter)?.filter

  const list = useTierList<T>(
    table,
    { select, orderBy: activeSort.order, top, filter: serverFilter },
    defaultTier,
  )
  const { tier, items: loaded } = list

  // Counts only matter in server mode; pass no pills in client mode so nothing
  // is fetched (availability is derived from the loaded rows instead).
  const counts = usePillCounts(table, tier, clientFilter ? [] : pills)

  const items =
    clientFilter && filter !== defaultFilter
      ? loaded.filter((item) => clientFilter(item, filter))
      : loaded

  const disabledKeys = clientFilter
    ? clientDisabledKeys(loaded, pills, defaultFilter, clientFilter)
    : new Set(pills.filter((p) => counts[p.key] === 0).map((p) => p.key))

  const activeUnavailable = clientFilter
    ? loaded.length > 0 && filter !== defaultFilter && !loaded.some((i) => clientFilter(i, filter))
    : filter !== defaultFilter && counts[filter] === 0
  useEffect(() => {
    if (activeUnavailable) setFilter(defaultFilter)
  }, [activeUnavailable, setFilter, defaultFilter])

  return {
    tier,
    setTier: list.setTier,
    filter,
    setFilter,
    sort,
    setSort,
    activeSort,
    pills,
    disabledKeys,
    items,
    loading: list.loading,
    error: list.error,
    hasMore: list.hasMore,
    loadingMore: list.loadingMore,
    loadMore: list.loadMore,
    refresh: list.refresh,
  }
}

/** Client-mode pill greying: disable any pill with no matching loaded row. */
function clientDisabledKeys<T>(
  loaded: T[],
  pills: Pill[],
  defaultFilter: string,
  match: (item: T, key: string) => boolean,
): Set<string> {
  if (loaded.length === 0) return new Set()
  return new Set(
    pills
      .filter((p) => p.key !== defaultFilter && !loaded.some((i) => match(i, p.key)))
      .map((p) => p.key),
  )
}
