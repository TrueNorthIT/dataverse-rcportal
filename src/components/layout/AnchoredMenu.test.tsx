import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnchoredMenu } from './AnchoredMenu'

/** Minimal trigger + menu pairing, the way the header menus use it. */
function Harness({ onClose }: { onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
    onClose?.()
  }
  return (
    <div ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        trigger
      </button>
      {open && (
        <AnchoredMenu anchorRef={ref} onClose={close}>
          <button type="button" role="menuitem" onClick={close}>
            item
          </button>
        </AnchoredMenu>
      )}
    </div>
  )
}

describe('AnchoredMenu', () => {
  it('renders the panel into document.body (escapes the header stacking context)', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))

    const menu = screen.getByRole('menu')
    // The whole point: the panel must NOT be inside the anchor's subtree, so
    // the dashboard's z-50 sticky toggle can never paint over it.
    expect(container.contains(menu)).toBe(false)
    expect(document.body.contains(menu)).toBe(true)
    expect(menu.className).toContain('z-[60]')
  })

  it('keeps clicks on menu items working (press inside the portal is not "outside")', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))

    await user.click(screen.getByRole('menuitem', { name: 'item' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on an outside pointerdown', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'elsewhere' }) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('a press on the trigger is ignored so its own onClick can toggle the menu closed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'trigger' })

    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on page scroll (the sticky anchor moves or hides)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.scroll(window)
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
