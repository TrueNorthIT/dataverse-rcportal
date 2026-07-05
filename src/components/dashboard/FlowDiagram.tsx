import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useInView } from '../../hooks/useInView'

const NAVY = '#142d46'
const BLUE = '#0066b3'
const TEAL = '#005862'
const BLUELIGHT = '#d9e8f4'
const CANVAS = '#eef4fa'
const LINE = '#9cc3e6'
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif"

/** 24×24 icon path data, drawn stroked (no external CSS, so it survives export). */
const ICONS: Record<string, ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </>
  ),
  link: <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />,
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
}

const NODES = [
  { icon: 'globe', title: 'React portal', sub: 'browser app' },
  { icon: 'link', title: 'Contact Portal API', sub: 'authorises + security-trims' },
  { icon: 'server', title: 'Dataverse', sub: 'your data' },
]

const vars = (o: Record<string, string>) => o as CSSProperties
const flowStyle = (inView: boolean, delay: number) =>
  vars({ '--rc-delay': `${delay}s`, opacity: inView ? '1' : '0' })

/** Icon (stroked) + title + subtitle, shared by both orientations. */
function NodeBody({ icon, title, sub, iconT, textX, titleY, subY, titleSize, subSize }: {
  icon: string; title: string; sub: string
  iconT: string; textX: number; titleY: number; subY: number; titleSize: number; subSize: number
}) {
  return (
    <>
      <g transform={iconT} fill="none" stroke={BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </g>
      <text x={textX} y={titleY} fontSize={titleSize} fontWeight={600} fill={NAVY}>{title}</text>
      <text x={textX} y={subY} fontSize={subSize} fill={TEAL}>{sub}</text>
    </>
  )
}

/**
 * The request-flow diagram: React portal → Contact Portal API → Dataverse, with
 * the generic/stateless/secure + Entra badges. Builds in (staggered) on scroll,
 * then a packet streams along each connector.
 *
 * Two SVG layouts: a wide three-across for tablet/desktop (also the export
 * source, via svgRef) and a stacked, full-width version for phones so the cards
 * and text stay legible instead of being squeezed across the screen.
 */
export function FlowDiagram({ svgRef }: { svgRef: RefObject<SVGSVGElement | null> }) {
  const [wrapRef, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={wrapRef} className="w-full">
      {/* ── Tablet / desktop: horizontal (and the export source) ───────────── */}
      <svg
        ref={svgRef}
        viewBox="0 0 960 184"
        width="100%"
        role="img"
        aria-label="React portal to Contact Portal API to Dataverse, authenticated by Entra External ID"
        className="hidden sm:block"
        style={{ fontFamily: FONT, maxWidth: '100%', height: 'auto' }}
      >
        {[288, 622].map((gx, i) => (
          <g key={gx}>
            <line x1={gx + 5} y1={54} x2={gx + 45} y2={54} stroke={LINE} strokeWidth={2} className={inView ? 'rc-dashmove' : undefined} />
            <path d={`M${gx + 31} 48 l7 6 -7 6`} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={gx + 7} cy={54} r={4.5} fill={BLUE} className={inView ? 'rc-flowdot' : undefined} style={vars({ '--rc-delay': `${0.6 + i * 0.3}s`, '--rc-flow-dist': '34px', opacity: '0' })} />
          </g>
        ))}
        {NODES.map((n, i) => {
          const x = 4 + i * 334
          return (
            <g key={n.title} className={inView ? 'rc-flowin' : undefined} style={flowStyle(inView, i * 0.18)}>
              <rect x={x} y={8} width={284} height={92} rx={16} fill={CANVAS} stroke={BLUELIGHT} />
              <rect x={x + 16} y={29} width={50} height={50} rx={13} fill="#fff" stroke={BLUELIGHT} />
              <NodeBody {...n} iconT={`translate(${x + 27}, 40) scale(1.15)`} textX={x + 82} titleY={46} subY={70} titleSize={19} subSize={13.5} />
            </g>
          )
        })}
        <g className={inView ? 'rc-flowin' : undefined} style={flowStyle(inView, 0.7)}>
          <rect x={335} y={116} width={290} height={28} rx={14} fill="#fff" stroke={BLUELIGHT} />
          <text x={480} y={135} textAnchor="middle" fontSize={13} fontWeight={700} letterSpacing={1.3} fill={TEAL}>GENERIC · STATELESS · SECURE</text>
          <rect x={336} y={150} width={288} height={28} rx={14} fill={BLUELIGHT} />
          <g transform="translate(356, 157) scale(0.75)" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </g>
          <text x={386} y={169} fontSize={13} fontWeight={600} fill={NAVY}>Authenticated by Entra External ID</text>
        </g>
      </svg>

      {/* ── Phone: stacked, full-width ─────────────────────────────────────── */}
      <svg
        viewBox="0 0 360 380"
        width="100%"
        aria-hidden="true"
        className="block sm:hidden"
        style={{ fontFamily: FONT, maxWidth: '100%', height: 'auto' }}
      >
        {[0, 1].map((i) => {
          const cy = 98 + i * 106
          return (
            <path key={i} d={`M174 ${cy - 5} l6 6 6 -6`} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )
        })}
        {NODES.map((n, i) => {
          const y = 8 + i * 106
          return (
            <g key={n.title} className={inView ? 'rc-flowin' : undefined} style={flowStyle(inView, i * 0.16)}>
              <rect x={6} y={y} width={348} height={74} rx={16} fill={CANVAS} stroke={BLUELIGHT} />
              <rect x={18} y={y + 16} width={42} height={42} rx={11} fill="#fff" stroke={BLUELIGHT} />
              <NodeBody {...n} iconT={`translate(27, ${y + 25})`} textX={74} titleY={y + 32} subY={y + 53} titleSize={16} subSize={12.5} />
            </g>
          )
        })}
        <g className={inView ? 'rc-flowin' : undefined} style={flowStyle(inView, 0.6)}>
          <rect x={55} y={308} width={250} height={28} rx={14} fill="#fff" stroke={BLUELIGHT} />
          <text x={180} y={327} textAnchor="middle" fontSize={12} fontWeight={700} letterSpacing={1} fill={TEAL}>GENERIC · STATELESS · SECURE</text>
          <rect x={55} y={342} width={250} height={28} rx={14} fill={BLUELIGHT} />
          <g transform="translate(74, 349) scale(0.72)" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </g>
          <text x={99} y={361} fontSize={11.5} fontWeight={600} fill={NAVY}>Authenticated by Entra External ID</text>
        </g>
      </svg>
    </div>
  )
}
