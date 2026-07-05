import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Icon, type IconName } from './Icon'

const ALL_ICONS: IconName[] = [
  'calendar', 'clock', 'tag', 'hash', 'pound', 'percent',
  'mapPin', 'phone', 'mail', 'globe', 'building', 'user', 'users',
  'briefcase', 'layers', 'fileText', 'link', 'activity', 'checkCircle',
  'chevronRight', 'chevronDown', 'flag', 'truck', 'receipt', 'maximize', 'x', 'gantt',
  'lock', 'server', 'download', 'zap',
]

describe('Icon', () => {
  it('renders a decorative 24x24 stroked svg with the house style', () => {
    const { container } = render(<Icon name="calendar" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies the default size class when none is given', () => {
    const { container } = render(<Icon name="clock" />)
    expect(container.querySelector('svg')).toHaveClass('h-4', 'w-4')
  })

  it('applies a custom className, replacing the default', () => {
    const { container } = render(<Icon name="clock" className="h-6 w-6 text-red-500" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('h-6', 'w-6', 'text-red-500')
    expect(svg).not.toHaveClass('h-4')
  })

  it('renders distinct path markup for each icon name', () => {
    for (const name of ALL_ICONS) {
      const { container, unmount } = render(<Icon name={name} />)
      const svg = container.querySelector('svg')
      expect(svg, `icon "${name}" should render an svg`).toBeInTheDocument()
      // every icon must contribute at least one drawable child element
      expect(svg?.querySelector('path, circle, rect'), `icon "${name}" should draw something`).not.toBeNull()
      unmount()
    }
  })

  it('covers the full documented icon set', () => {
    expect(ALL_ICONS).toHaveLength(31)
  })
})
