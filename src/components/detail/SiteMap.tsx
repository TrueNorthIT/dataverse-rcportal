import { useState } from 'react'
import { MAP_KEY } from '../../env'
import { Icon } from '../common/Icon'

/** Static map style — dark + low-chrome so our pin and address stand out. */
const MAP_STYLE = 'dataviz-dark'

/**
 * Styled location panel for a site. Renders a MapTiler *static* map centred on
 * the site's coordinates, dressed in brand chrome — a navy scrim, a pulsing
 * pin, the address overlaid, and an "Open in Maps" link.
 *
 * Deliberately a plain `<img>` (no map library, no JS bundle): one request,
 * instant paint, nothing to hydrate. The map is centred on the point, so the
 * visual centre *is* the site — we drop our own animated pin there rather than
 * baking the API marker, to keep it on-brand.
 *
 * Renders nothing when the record has no coordinates (not yet backfilled — see
 * `scripts/backfill-site-geo.mjs`) or when `VITE_MAPTILER_KEY` is unset (a
 * minimal deployment). The full address still shows in the detail grid either
 * way, so nothing ever looks broken.
 */
export function SiteMap({
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
  const [failed, setFailed] = useState(false)

  if (latitude == null || longitude == null || !MAP_KEY) return null

  // MapTiler static map: /static/{lon},{lat},{zoom}/{w}x{h}@2x.webp — note lon
  // comes before lat. @2x for retina; the panel crops it to a wide banner.
  const src =
    `https://api.maptiler.com/maps/${MAP_STYLE}/static/` +
    `${longitude},${latitude},14/800x450@2x.webp?key=${MAP_KEY}`
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
        {failed ? (
          // Bad key / network — keep the panel intentional with a brand wash
          // instead of a broken-image icon.
          <div className="absolute inset-0 bg-gradient-to-br from-rc-navy to-rc-blue" />
        ) : (
          <img
            src={src}
            alt={`Map showing the location of ${name}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Pulsing pin, dead centre — the map is centred on the site. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rc-blue opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-rc-blue shadow" />
          </span>
        </div>

        {caption && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {caption}
          </span>
        )}

        {/* Bottom scrim carrying the address + a jump-to-maps link. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-rc-navy via-rc-navy/70 to-transparent p-4 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{name}</div>
              {address && <div className="truncate text-xs text-white/75">{address}</div>}
            </div>
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
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
