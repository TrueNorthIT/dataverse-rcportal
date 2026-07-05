/**
 * A single shimmer block. Compose a few (with Tailwind size classes) to sketch
 * whatever is loading — one brand-consistent placeholder instead of hand-rolled
 * `rc-skeleton` divs scattered across screens.
 *
 * ```tsx
 * <Skeleton className="h-4 w-40" />
 * ```
 */
export function Skeleton({
  className = '',
  rounded = 'rounded',
}: {
  className?: string
  /** Corner style — `rounded` (default), `rounded-full`, `rounded-xl`, etc. */
  rounded?: string
}) {
  return <div className={`rc-skeleton ${rounded} ${className}`} />
}
