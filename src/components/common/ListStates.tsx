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

/** "Load more" control for cursor pagination via `page.next`. */
export function LoadMore({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean
  loading: boolean
  onClick: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy hover:bg-rc-blue-light disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  )
}
