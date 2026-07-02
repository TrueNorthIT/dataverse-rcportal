import { useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import type { PaginatedResponse, QueryOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

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
  loadMore: () => void
  refresh: () => void
}

/**
 * Generic list loader for a `me`/`team`-scoped table, backed by React Query.
 *
 * Owns the tier toggle and cursor pagination (`useInfiniteQuery` following
 * `page.next`). The query key includes the tier and the selected company, so
 * toggling tier or switching company refetches automatically; `keepPreviousData`
 * keeps the current rows on screen (dimmed) until the new ones arrive.
 *
 * Because the shared query client sets `refetchOnWindowFocus`, tabbing back to
 * the portal re-pulls the list — so edits made in Dataverse show up without a
 * manual reload.
 */
export function useTierList<T>(
  table: string,
  options?: Pick<QueryOptions, 'select' | 'expand' | 'orderBy' | 'filter' | 'top'>,
  initialTier: Tier = 'me',
): UseTierListResult<T> {
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()
  const [tier, setTier] = useState<Tier>(initialTier)

  const query = useInfiniteQuery({
    queryKey: ['list', table, tier, selectedContactId ?? 'default', options ?? {}],
    queryFn: ({ pageParam }) =>
      pageParam
        ? client[tier].fetchPage<T>(pageParam)
        : client[tier].list<T>(table, options),
    initialPageParam: null as string | null,
    getNextPageParam: (last: PaginatedResponse<T>) => last.page.next ?? undefined,
    placeholderData: keepPreviousData,
  })

  const items = query.data?.pages.flatMap((p) => p.data) ?? []

  return {
    tier,
    setTier,
    items,
    // Full-list (re)fetch — drives skeleton (first load) / dim (refetch). A
    // "load more" is tracked separately so it doesn't dim the whole list.
    loading: query.isFetching && !query.isFetchingNextPage,
    loadingMore: query.isFetchingNextPage,
    error: query.error instanceof Error ? query.error.message : null,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    refresh: () => void query.refetch(),
  }
}
