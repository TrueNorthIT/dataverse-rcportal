/**
 * Loading / error / empty presentation shared by every list screen (spec §6:
 * "Every list: loading, error, and empty states"). Renders `children` only
 * once there's data.
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
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
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

  if (error) {
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

  return <div className="rc-fade-up">{children}</div>
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
