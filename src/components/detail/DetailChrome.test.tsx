import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/render'
import {
  DetailNav,
  DetailHeader,
  MetaGrid,
  MetaItem,
  SectionTitle,
  DetailSkeleton,
} from './DetailChrome'

describe('DetailNav', () => {
  it('calls onBack when the labelled back link is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderWithProviders(
      <DetailNav label="Projects" onPrev={vi.fn()} onNext={vi.fn()} onBack={onBack} />,
    )

    await user.click(screen.getByRole('button', { name: 'Projects' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('hides the prev/next stepper when neither id is present', () => {
    renderWithProviders(
      <DetailNav label="Projects" onPrev={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('renders the stepper and steps forward/back when both ids exist', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    renderWithProviders(
      <DetailNav
        label="Projects"
        prevId="p0"
        nextId="p2"
        onPrev={onPrev}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    )

    const prev = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(prev).toBeEnabled()
    expect(next).toBeEnabled()

    await user.click(prev)
    await user.click(next)
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('shows the stepper but disables the missing direction', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    renderWithProviders(
      <DetailNav
        label="Projects"
        nextId="p2"
        onPrev={onPrev}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    const prev = screen.getByRole('button', { name: 'Previous' })
    expect(prev).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    await user.click(prev)
    expect(onPrev).not.toHaveBeenCalled()
  })
})

describe('DetailHeader', () => {
  it('renders the title, trailing node and children', () => {
    renderWithProviders(
      <DetailHeader icon="layers" title="Migration Project" trailing={<span>Chip</span>}>
        <p>Body copy</p>
      </DetailHeader>,
    )

    expect(screen.getByRole('heading', { name: 'Migration Project' })).toBeInTheDocument()
    expect(screen.getByText('Chip')).toBeInTheDocument()
    expect(screen.getByText('Body copy')).toBeInTheDocument()
  })

  it('renders without a trailing node or children', () => {
    renderWithProviders(<DetailHeader icon="briefcase" title="Bare" />)
    expect(screen.getByRole('heading', { name: 'Bare' })).toBeInTheDocument()
  })
})

describe('MetaGrid + MetaItem', () => {
  it('renders each labelled value inside the grid', () => {
    renderWithProviders(
      <MetaGrid>
        <MetaItem icon="calendar" label="Start" value="5 Jul 2026" />
        <MetaItem icon="hash" label="Count" value={42} />
      </MetaGrid>,
    )

    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('5 Jul 2026')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders a zero value as the text "0" rather than hiding it', () => {
    renderWithProviders(<MetaItem icon="hash" label="Open cases" value={0} />)
    expect(screen.getByText('Open cases')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('renders nothing when the value is %s', (_desc, value) => {
    const { container } = renderWithProviders(
      <MetaItem icon="hash" label="Hidden" value={value} />,
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SectionTitle', () => {
  it('renders the heading text without a count by default', () => {
    renderWithProviders(<SectionTitle icon="gantt">Delivery plan</SectionTitle>)
    const heading = screen.getByRole('heading', { name: /Delivery plan/ })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).not.toContain('(')
  })

  it('appends the count in parentheses when provided (including zero)', () => {
    renderWithProviders(
      <SectionTitle icon="fileText" count={0}>
        Notes
      </SectionTitle>,
    )
    expect(screen.getByText('(0)')).toBeInTheDocument()
  })

  it('shows a non-zero count', () => {
    renderWithProviders(
      <SectionTitle icon="fileText" count={3}>
        Notes
      </SectionTitle>,
    )
    expect(screen.getByText('(3)')).toBeInTheDocument()
  })
})

describe('DetailSkeleton', () => {
  it('renders shimmer placeholders while loading', () => {
    const { container } = renderWithProviders(<DetailSkeleton />)
    // A grid of six meta placeholders (two shimmer bars each) plus the header
    // glyph + title bars — well over a handful of shimmer elements.
    const shimmer = container.querySelectorAll('.rc-skeleton')
    expect(shimmer.length).toBeGreaterThan(6)
  })
})
