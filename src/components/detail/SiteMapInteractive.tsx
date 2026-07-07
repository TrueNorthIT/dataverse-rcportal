import { lazy, Suspense } from 'react'
import { MAP_KEY } from '../../env'
import { Icon } from '../common/Icon'

// maplibre-gl is heavy and WebGL-based — load it (and the canvas) only when a
// map renders, in its own chunk. Same lazy pattern as the dashboard charts.
const SiteMapCanvas = lazy(() => import('./SiteMapCanvas'))

/**
 * Site location map — a live MapLibre GL vector map (dark brand style) centred
 * on the site, with a map-anchored pulsing pin and a navy scrim carrying the
 * name + address; "Open in Maps" links out to Google Maps.
 *
 * Renders nothing without coordinates or a key. The heavy maplibre-gl canvas is
 * lazy-loaded (see SiteMapCanvas), so it never lands in the main bundle.
 */
export function SiteMapInteractive({
  latitude,
  longitude,
  name,
  address,
  className = '',
}: {
  latitude?: number | null
  longitude?: number | null
  name: string
  address?: string
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

        {/* Top-left, so it clears MapLibre's zoom controls (top-right) and the
            attribution (bottom-right, which paints above our overlays). */}
        <a
          href={directions}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto absolute left-3 top-3 z-[2] inline-flex items-center gap-1 rounded-lg border border-white/25 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          <Icon name="mapPin" className="h-3.5 w-3.5" />
          Open in Maps
        </a>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-rc-navy via-rc-navy/70 to-transparent p-4 pt-10">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{name}</div>
            {address && <div className="truncate text-xs text-white/75">{address}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
