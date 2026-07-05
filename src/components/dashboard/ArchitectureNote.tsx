import { useRef, type ReactNode } from 'react'
import { Card } from '../common/Card'
import { Icon } from '../common/Icon'
import { useInView } from '../../hooks/useInView'
import { FlowDiagram } from './FlowDiagram'

function Point({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-rc-green" />
      <span>{children}</span>
    </div>
  )
}

/** Rasterise the live SVG diagram to a PNG and download it. Pure-shape SVG, so
 * it draws to a canvas without tainting; colours are inline on the SVG so the
 * export stays styled without the app's stylesheet. */
function downloadDiagram(svg: SVGSVGElement | null) {
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // Freeze to a clean static frame: drop animation classes + reveal everything.
  clone.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('class')
    if (el instanceof SVGElement) el.style.opacity = ''
  })
  const vb = svg.viewBox.baseVal
  const w = vb && vb.width ? vb.width : 960
  const h = vb && vb.height ? vb.height : 140
  const xml = new XMLSerializer().serializeToString(clone)
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  const img = new Image()
  img.onload = () => {
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'contact-portal-architecture.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }
  img.src = src
}

/**
 * Bottom-of-dashboard explainer: how the portal is wired and secured, with an
 * animated request-flow diagram that builds in on scroll and a download button.
 * Copy is plain and direct (no marketing framing); doubles as a demo talking point.
 */
export function ArchitectureNote() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div ref={ref} className={inView ? 'rc-unfold' : 'opacity-0'}>
      <Card className="overflow-hidden">
        <div className="rc-gradient h-1 w-full" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-medium tracking-tight text-rc-navy">How this portal is built</h2>
            <button
              type="button"
              onClick={() => downloadDiagram(svgRef.current)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rc-blue-light px-2.5 py-1 text-xs font-medium text-rc-teal transition-colors hover:border-rc-blue hover:text-rc-navy"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Download
            </button>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-rc-teal">
            Everything on this page is real Dataverse data. Entra External ID handles sign-in. The
            TrueNorth Contact Portal API does the rest: it authorises each request and trims the data to
            what you are allowed to see, so you never write permission code. To expose a new table you
            point the API at it and set how it is scoped.
          </p>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rc-blue-light bg-rc-blue-light/40 px-4 py-2.5 text-sm text-rc-navy">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-rc-blue">
              <Icon name="zap" className="h-3.5 w-3.5" />
            </span>
            <span>
              <span className="font-semibold">New table in minutes.</span> Expose it, set the scope, done.
            </span>
          </div>

          <div className="mt-4">
            <FlowDiagram svgRef={svgRef} />
          </div>

          <div className="mt-5 grid gap-2 text-sm text-rc-navy sm:grid-cols-2">
            <Point>Entra External ID authenticates the user. The Contact Portal API authorises the request and filters the data.</Point>
            <Point>Security trimming is built in, so you don&rsquo;t write it yourself.</Point>
            <Point>Expose quotes, orders or tickets through configuration, not a new backend.</Point>
            <Point>Anything linked to an account or contact is scoped to the signed-in person or their company.</Point>
            <Point>Knowledge base articles are public, so no permission check runs.</Point>
            <Point>You can edit your own profile, but not a colleague&rsquo;s.</Point>
          </div>
          <p className="mt-4 text-xs text-rc-teal">
            You build the client. Entra handles identity, and the API handles authorisation and trimming.
          </p>
        </div>
      </Card>
    </div>
  )
}
