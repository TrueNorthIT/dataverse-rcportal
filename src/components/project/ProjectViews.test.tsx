import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/render'
import type { Project } from '../../types/project'
import type { DiaryEntry, Milestone, Phase } from '../../services/projectApi'
import { ProjectPlanCard, ProjectPlanModal, ProjectDiary } from './ProjectViews'

// Fixed "now" so pct / today-line / status derivations are deterministic. All
// interactions use fireEvent (synchronous) so they cooperate with fake timers.
const NOW = new Date('2026-07-05T12:00:00Z')

// A project running Jun→Sep 2026, i.e. `now` sits inside the window.
const project: Project = {
  msdyn_projectid: 'p1',
  msdyn_subject: 'Cloud Migration',
  msdyn_scheduledstart: '2026-06-01',
  msdyn_finish: '2026-09-01',
}

const phases: Phase[] = [
  { key: 'ph-done', label: 'Discovery', start: '2026-06-01', end: '2026-06-20', status: 'done', pct: 1 },
  { key: 'ph-active', label: 'Build', start: '2026-06-21', end: '2026-08-01', status: 'active', pct: 0.4 },
  { key: 'ph-upcoming', label: 'Go live', start: '2026-08-02', end: '2026-09-01', status: 'upcoming', pct: 0 },
]

const milestones: Milestone[] = [
  { key: 'm-done', label: 'Kickoff', date: '2026-06-05', done: true },
  { key: 'm-next', label: 'UAT sign-off', date: '2026-08-15', done: false },
]

const diary: DiaryEntry[] = [
  { key: 'd1', date: '2026-06-05', title: 'Project kicked off', detail: 'Teams aligned.', author: 'Ada L.', kind: 'milestone' },
  { key: 'd2', date: '2026-06-20', title: 'Weekly status', detail: 'On schedule.', author: '', kind: 'update' },
  { key: 'd3', date: '2026-07-01', title: 'Risk raised', detail: 'Vendor delay possible.', author: 'Grace H.', kind: 'risk' },
  { key: 'd4', date: '2026-07-03', title: 'General note', detail: 'Docs updated.', author: '', kind: 'note' },
]

/** The phase bar (`.rounded-md`) inside the row whose label carries `title`. */
function barFor(label: string): HTMLElement {
  const bar = screen.getByTitle(label).closest('.flex')?.querySelector('.rounded-md')
  if (!bar) throw new Error(`No bar found for phase "${label}"`)
  return bar as HTMLElement
}

/** Normalised text content of the portalled hover tooltip (or null if absent). */
function tooltipText(): string | null {
  const tip = document.querySelector('.z-\\[80\\]') as HTMLElement | null
  return tip ? tip.textContent!.replace(/\s+/g, ' ').trim() : null
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProjectPlanCard', () => {
  it('shows the schedule range, elapsed progress and the next milestone', () => {
    renderWithProviders(
      <ProjectPlanCard project={project} milestones={milestones} onOpen={vi.fn()} />,
    )

    // Date range rendered via formatDate (start → finish).
    expect(screen.getByText(/1 Jun 2026 →/)).toBeInTheDocument()

    // now (5 Jul) is ~38% through a 1 Jun → 1 Sep window.
    expect(screen.getByText(/% elapsed/)).toHaveTextContent(/3[0-9]% elapsed/)

    // The first not-done milestone is highlighted as "Next".
    expect(screen.getByText('UAT sign-off')).toBeInTheDocument()
    expect(screen.getByText(/15 Aug 2026/)).toBeInTheDocument()
  })

  it('reports all milestones complete when none remain', () => {
    renderWithProviders(
      <ProjectPlanCard
        project={project}
        milestones={[{ key: 'm', label: 'Done', date: '2026-06-05', done: true }]}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('All milestones complete')).toBeInTheDocument()
  })

  it('falls back to "Schedule not set" and hides the bar when dates are invalid', () => {
    renderWithProviders(
      <ProjectPlanCard project={{ msdyn_subject: 'No dates' }} milestones={[]} onOpen={vi.fn()} />,
    )
    expect(screen.getByText('Schedule not set')).toBeInTheDocument()
    expect(screen.queryByText(/% elapsed/)).not.toBeInTheDocument()
  })

  it('treats a finish before start as an invalid schedule', () => {
    renderWithProviders(
      <ProjectPlanCard
        project={{ msdyn_scheduledstart: '2026-09-01', msdyn_finish: '2026-06-01' }}
        milestones={[]}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('Schedule not set')).toBeInTheDocument()
  })

  it('prefers the actual start date over the scheduled one for the range', () => {
    renderWithProviders(
      <ProjectPlanCard
        project={{ ...project, msdyn_actualstart: '2026-06-10' }}
        milestones={milestones}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText(/10 Jun 2026 →/)).toBeInTheDocument()
  })

  it('invokes onOpen when "View full plan" is clicked', () => {
    const onOpen = vi.fn()
    renderWithProviders(
      <ProjectPlanCard project={project} milestones={milestones} onOpen={onOpen} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /View full plan/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('ProjectPlanModal', () => {
  it('renders the project subject, the Gantt by default and its legend', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Project plan' })
    expect(within(dialog).getByRole('heading', { name: 'Cloud Migration' })).toBeInTheDocument()

    // Gantt tab is default → phase labels + legend visible; diary hidden.
    expect(screen.getByText('Discovery')).toBeInTheDocument()
    expect(screen.getByText('Go live')).toBeInTheDocument()
    expect(screen.getByText('Milestone')).toBeInTheDocument()
    expect(screen.queryByText('Project kicked off')).not.toBeInTheDocument()
  })

  it('falls back to "Project" when the subject is empty', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={{ ...project, msdyn_subject: '' }}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument()
  })

  it('switches to the Diary tab (driven by the location hash)', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
      { path: '/projects/:id', route: '/projects/p1' },
    )

    fireEvent.click(screen.getByRole('button', { name: /Diary/ }))

    expect(screen.getByText('Project kicked off')).toBeInTheDocument()
    expect(screen.queryByText('Discovery')).not.toBeInTheDocument()
  })

  it('opens on the Diary tab when the hash is #plan-diary and can switch back', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
      { path: '/projects/:id', route: '/projects/p1#plan-diary' },
    )

    expect(screen.getByText('Project kicked off')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Gantt/ }))
    expect(screen.getByText('Discovery')).toBeInTheDocument()
  })

  it('closes when the close button is clicked', () => {
    const onClose = vi.fn()
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={onClose}
      />,
    )
    // The backdrop is the aria-hidden overlay behind the dialog.
    const backdrop = document.querySelector('[aria-hidden="true"].absolute') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when Escape is pressed and unbinds the listener on unmount', () => {
    const onClose = vi.fn()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    // A non-Escape key is ignored.
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})

describe('ProjectGantt (via the modal)', () => {
  it('renders month ticks, the Today line and a tooltip on hover', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )

    // "now" is inside the window → Today marker shown.
    expect(screen.getByText('Today')).toBeInTheDocument()
    // Month tick labels along the axis (Jul, Aug fall inside Jun→Sep).
    expect(screen.getByText('Jul')).toBeInTheDocument()
    expect(screen.getByText('Aug')).toBeInTheDocument()

    // Hover a phase bar → portalled tooltip with the phase label, dates + status.
    const bar = barFor('Build')
    fireEvent.mouseEnter(bar)
    expect(tooltipText()).toContain('Build')
    expect(tooltipText()).toContain('In progress · 40%')

    fireEvent.mouseLeave(bar)
    expect(tooltipText()).toBeNull()
  })

  it('labels statuses correctly in tooltips (Complete / Upcoming)', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )

    // Read the tooltip's "status · NN%" line, distinct from the legend text.
    const doneBar = barFor('Discovery')
    fireEvent.mouseEnter(doneBar)
    expect(tooltipText()).toContain('Complete · 100%')
    fireEvent.mouseLeave(doneBar)

    const upcomingBar = barFor('Go live')
    fireEvent.mouseEnter(upcomingBar)
    expect(tooltipText()).toContain('Upcoming · 0%')
  })

  it('shows a placeholder when the project has no schedule', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={{ msdyn_subject: 'Empty' }}
        phases={[]}
        milestones={[]}
        diary={[]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('This project has no schedule to plot yet.')).toBeInTheDocument()
  })

  it('shows the placeholder when dates are valid but there are no phases', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={[]}
        milestones={milestones}
        diary={[]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('This project has no schedule to plot yet.')).toBeInTheDocument()
  })

  it('omits the Today line when now sits outside the schedule window', () => {
    // Move the clock well after the project finish so now > e.
    vi.setSystemTime(new Date('2027-01-01T12:00:00Z'))
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    // But phases still render.
    expect(screen.getByText('Discovery')).toBeInTheDocument()
  })

  it('renders a January tick with a two-digit year across a year boundary', () => {
    const spanning: Project = {
      msdyn_subject: 'Long haul',
      msdyn_scheduledstart: '2026-11-01',
      msdyn_finish: '2027-03-01',
    }
    renderWithProviders(
      <ProjectPlanModal
        project={spanning}
        phases={[{ key: 'x', label: 'Phase X', start: '2026-11-05', end: '2027-02-20', status: 'active', pct: 0.5 }]}
        milestones={[]}
        diary={[]}
        onClose={vi.fn()}
      />,
    )
    // January shows the short year suffix, e.g. "Jan 27".
    expect(screen.getByText('Jan 27')).toBeInTheDocument()
  })

  it('renders a phase whose end date is missing (single-date short range)', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={[{ key: 'p', label: 'Open-ended', start: '2026-06-15', end: '', status: 'active', pct: 0.2 }]}
        milestones={[]}
        diary={[]}
        onClose={vi.fn()}
      />,
    )
    // The label still renders and the short range shows just the start day.
    const label = screen.getByText('Open-ended')
    expect(label).toBeInTheDocument()
    const row = label.closest('.truncate')?.parentElement
    expect(row?.textContent?.replace(/\s+/g, ' ')).toContain('15 Jun · 20%')
  })

  it('renders a milestone marker on the axis with a descriptive title', () => {
    renderWithProviders(
      <ProjectPlanModal
        project={project}
        phases={phases}
        milestones={milestones}
        diary={diary}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTitle(/UAT sign-off ·/)).toBeInTheDocument()
  })
})

describe('ProjectDiary', () => {
  it('renders an entry per kind with title, detail and author', () => {
    renderWithProviders(<ProjectDiary entries={diary} />)

    expect(screen.getByText('Project kicked off')).toBeInTheDocument()
    expect(screen.getByText('Teams aligned.')).toBeInTheDocument()
    expect(screen.getByText('Risk raised')).toBeInTheDocument()
    expect(screen.getByText('General note')).toBeInTheDocument()

    // Author shown when present.
    expect(screen.getByText('Ada L.')).toBeInTheDocument()
    expect(screen.getByText('Grace H.')).toBeInTheDocument()

    // Dates formatted.
    expect(screen.getByText('5 Jun 2026')).toBeInTheDocument()
  })

  it('renders every entry as a list item', () => {
    renderWithProviders(<ProjectDiary entries={diary} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(diary.length)
  })

  it('shows the empty state when there are no entries', () => {
    renderWithProviders(<ProjectDiary entries={[]} />)
    expect(
      screen.getByText("No diary entries yet — this project hasn't started."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
