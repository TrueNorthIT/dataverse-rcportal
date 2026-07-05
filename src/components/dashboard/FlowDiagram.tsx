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

const BOX_W = 284
const BOX_H = 58
const BOX_Y = 6
const MID_Y = BOX_Y + BOX_H / 2
const NODES = [
  { x: 6, icon: 'globe', title: 'React portal', sub: 'browser app' },
  { x: 338, icon: 'link', title: 'Contact Portal API', sub: 'authorises + security-trims' },
  { x: 670, icon: 'server', title: 'Dataverse', sub: 'your data' },
]
const GAPS = [290, 622] // left edge of each connector gap (48 wide)

const vars = (o: Record<string, string>) => o as CSSProperties

/**
 * The request-flow diagram as a single inline SVG: React portal → Contact
 * Portal API → Dataverse, with the generic/stateless/secure + Entra badges.
 * Builds in (staggered) when scrolled into view, then a packet streams along
 * each connector. Rendered as SVG so it can be exported (see ArchitectureNote's
 * download button). All colours are inline so an exported copy stays styled.
 */
export function FlowDiagram({ svgRef }: { svgRef: RefObject<SVGSVGElement | null> }) {
  const [wrapRef, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={wrapRef} className="w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 960 140"
        width="100%"
        role="img"
        aria-label="React portal to Contact Portal API to Dataverse, secured end to end by Entra External ID"
        style={{ fontFamily: FONT, maxWidth: '100%', height: 'auto' }}
      >
        {/* connectors + streaming packets */}
        {GAPS.map((gx, i) => (
          <g key={gx}>
            <line
              x1={gx + 4}
              y1={MID_Y}
              x2={gx + 44}
              y2={MID_Y}
              stroke={LINE}
              strokeWidth={2}
              className={inView ? 'rc-dashmove' : undefined}
            />
            <path
              d={`M${gx + 30} ${MID_Y - 5} l6 5 -6 5`}
              fill="none"
              stroke={BLUE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={gx + 6}
              cy={MID_Y}
              r={3.5}
              fill={BLUE}
              className={inView ? 'rc-flowdot' : undefined}
              style={vars({ '--rc-delay': `${0.6 + i * 0.3}s`, '--rc-flow-dist': '34px', opacity: '0' })}
            />
          </g>
        ))}

        {/* nodes */}
        {NODES.map((n, i) => (
          <g
            key={n.title}
            className={inView ? 'rc-flowin' : undefined}
            style={vars({ '--rc-delay': `${i * 0.18}s`, opacity: inView ? '1' : '0' })}
          >
            <rect x={n.x} y={BOX_Y} width={BOX_W} height={BOX_H} rx={12} fill={CANVAS} stroke={BLUELIGHT} />
            <rect x={n.x + 12} y={BOX_Y + 13} width={32} height={32} rx={9} fill="#fff" stroke={BLUELIGHT} />
            <g
              transform={`translate(${n.x + 19}, ${BOX_Y + 20}) scale(0.75)`}
              fill="none"
              stroke={BLUE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[n.icon]}
            </g>
            <text x={n.x + 56} y={BOX_Y + 26} fontSize={14} fontWeight={600} fill={NAVY}>
              {n.title}
            </text>
            <text x={n.x + 56} y={BOX_Y + 44} fontSize={11} fill={TEAL}>
              {n.sub}
            </text>
          </g>
        ))}

        {/* badges */}
        <g className={inView ? 'rc-flowin' : undefined} style={vars({ '--rc-delay': '0.7s', opacity: inView ? '1' : '0' })}>
          <rect x={358} y={78} width={244} height={22} rx={11} fill="#fff" stroke={BLUELIGHT} />
          <text x={480} y={93} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={1.2} fill={TEAL}>
            GENERIC · STATELESS · SECURE
          </text>
          <rect x={356} y={108} width={248} height={22} rx={11} fill={BLUELIGHT} />
          <g transform="translate(370, 113) scale(0.62)" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </g>
          <text x={394} y={123} fontSize={11} fontWeight={600} fill={NAVY}>
            Authenticated by Entra External ID
          </text>
        </g>
      </svg>
    </div>
  )
}
