import { lazy, Suspense } from 'react'
import { MAP_KEY } from '../../env'
import { Icon } from '../common/Icon'

// maplibre-gl is heavy and WebGL-based — load it (and the canvas) only when a
// map renders, in its own chunk. Same lazy pattern as the dashboard charts.
const SiteMapCanvas = lazy(() => import('./SiteMapCanvas'))

/**
 * Interactive (MapLibre GL) variant of the site location map. Same brand chrome
 * as <SiteMap> — navy card, scrim, address, "Open in Maps" — but the backdrop
 * is a live pan/zoom vector map instead of a static image, and the pin is a map
 * marker so it tracks the location as you move.
 *
 * Shown side-by-side with the static <SiteMap> for now (each takes a `caption`)
 * so we can compare and keep whichever reads best. Renders nothing without
 * coordinates or a key, exactly like <SiteMap>.
 */
export function SiteMapInteractive({
  latitude,
  longitude,
  name,
  address,
  caption,
  className = '',
}: {
  latitude?: number | null
  longitude?: number | null
  name: string
  address?: string
  /** Small corner label — used while both map variants are shown together. */
  caption?: string
  className?: string
}) {
  if (latitude == null || longitude == null || !MAP_KEY) return null

  const directions = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`

  return (
    <div
      className={
        'relative overflow-hidden rounded-2xl border border-rc-blue-light bg-rc-navy shadow-sm ' +
        className
      }
    >
      <div className="rc-gradient h-1 w-full" />
      <div className="relative aspect-[16/7]">
        <Suspense fallback={<div className="absolute inset-0 rc-skeleton" aria-label="Loading map" />}>
          <SiteMapCanvas latitude={latitude} longitude={longitude} label={name} />
        </Suspense>

        {caption && (
          <span className="pointer-events-none absolute left-3 top-3 z-[1] rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {caption}
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-rc-navy via-rc-navy/70 to-transparent p-4 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{name}</div>
              {address && <div className="truncate text-xs text-white/75">{address}</div>}
            </div>
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Icon name="mapPin" className="h-3.5 w-3.5" />
              Open in Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
