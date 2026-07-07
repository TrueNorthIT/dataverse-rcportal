import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_KEY } from '../../env'

/** Dark, low-chrome vector style so our pin and the scrim text stand out. */
const MAP_STYLE = 'dataviz-dark'

/**
 * The MapLibre GL canvas for the interactive site map, split into its own chunk
 * so maplibre-gl (~200KB gzip, needs WebGL) loads only when a map actually
 * renders — never in the main bundle or in tests (where it's mocked).
 *
 * A calm presentation map: drag to pan, buttons / double-tap to zoom. Scroll
 * zoom is off so hovering the map never hijacks page scroll, and tilt/rotate
 * are disabled. Uses MapTiler *vector tiles* (the standard key covers these,
 * unlike the gated Static Maps API).
 */
export default function SiteMapCanvas({
  latitude,
  longitude,
  label,
}: {
  latitude: number
  longitude: number
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !MAP_KEY) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: `https://api.maptiler.com/maps/${MAP_STYLE}/style.json?key=${MAP_KEY}`,
      center: [longitude, latitude],
      zoom: 14,
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Brand pulsing pin, anchored to the point so it tracks pan/zoom. The
    // Tailwind utility classes below are picked up by the JIT scanner from this
    // file (and they also live in SiteMap.tsx's overlay pin).
    const el = document.createElement('div')
    el.setAttribute('aria-label', label)
    el.innerHTML =
      '<span class="relative flex h-4 w-4">' +
      '<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rc-blue opacity-75"></span>' +
      '<span class="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-rc-blue shadow"></span>' +
      '</span>'
    const marker = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map)

    return () => {
      marker.remove()
      map.remove()
    }
  }, [latitude, longitude, label])

  return <div ref={ref} className="absolute inset-0 h-full w-full" />
}
