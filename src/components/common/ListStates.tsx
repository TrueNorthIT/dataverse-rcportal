import { useEffect, useRef } from 'react'

/**
 * Loading / error / empty presentation shared by every list screen.
 *
 * "Keep previous data while revalidating": the skeleton only shows on the
 * FIRST load (no data yet). On a refetch that already has data on screen —
 * e.g. switching company — we keep the existing list mounted and just dim it
 * until the new rows arrive, so the layout doesn't collapse to a skeleton and
 * jump. (The hook keeps the prior items during an in-flight refresh.)
 */
export function ListStates({
  loading,
  error,
  isEmpty,
  emptyMessage = 'Nothing to show yet.',
  children,
}: {
  loading: boolean
  error: string | null
  isEmpty: boolean
  emptyMessage?: string
  children: React.ReactNode
}) {
  // First load — nothing to keep on screen yet, so show the skeleton. Each row
  // gets a staggered delay so the shimmer ripples down the list.
  if (loading && isEmpty) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ ['--rc-delay' as string]: `${i * 0.12}s` }}
            className="flex items-center justify-between gap-4 rounded-2xl border border-rc-blue-light bg-white p-4"
          >
            <div className="flex-1 space-y-2">
              <div className="rc-skeleton h-4 w-2/5 rounded" />
              <div className="rc-skeleton h-3 w-3/5 rounded" />
            </div>
            <div className="rc-skeleton h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error && isEmpty) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-rc-blue-light bg-white p-8 text-center text-sm text-rc-teal">
        {emptyMessage}
      </div>
    )
  }

  // Have content: keep it on screen during a refetch (e.g. company switch) —
  // a slim indeterminate progress bar zips across the top and the list dims
  // gently, rather than flashing a skeleton. The bar lives in a fixed-height
  // reserved slot so showing/hiding it never shifts the layout (no jump).
  return (
    <div aria-busy={loading}>
      <div className="mb-3 h-[3px]">
        {loading && <div className="rc-progress h-full" aria-hidden="true" />}
      </div>
      <div className={'transition-opacity duration-200 ' + (loading ? 'opacity-60' : 'opacity-100')}>
        {children}
      </div>
    </div>
  )
}

/**
 * Infinite scroll: an invisible sentinel at the end of the list. When it scrolls
 * into view (with a little lead via rootMargin) we pull the next page — no
 * "Load more" button. A compact branded equalizer shows while the next page
 * loads. Keeps the `onClick`/`hasMore`/`loading` prop shape so callers are
 * unchanged (onClick = the query's fetchNextPage). TanStack dedupes overlapping
 * fetches, so re-triggering while a page is in flight is a no-op.
 */
export function LoadMore({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean
  loading: boolean
  onClick: () => void
}) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) onClick()
      },
      { rootMargin: '240px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, onClick])

  if (!hasMore && !loading) return null
  return (
    <div ref={sentinel} className="mt-5 flex min-h-[2rem] items-center justify-center">
      {loading && (
        <div className="flex items-center gap-2 text-xs font-medium text-rc-teal" role="status">
          <span className="flex h-4 items-end gap-[3px]">
            {['0s', '0.12s', '0.24s', '0.36s'].map((delay) => (
              <span
                key={delay}
                className="rc-bar inline-block w-1 rounded-full bg-rc-blue"
                style={{ height: '100%', animationDelay: delay }}
              />
            ))}
          </span>
          Loading more…
        </div>
      )}
    </div>
  )
}
