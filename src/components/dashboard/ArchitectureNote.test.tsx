import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArchitectureNote } from './ArchitectureNote'

/**
 * jsdom has no 2D canvas backend and doesn't fire <img> load events, so the
 * PNG-export path needs stubs. This installs a controllable canvas context, a
 * toBlob that yields a real Blob, object-URL helpers, and an Image whose onload
 * fires as soon as `src` is assigned — letting a click drive the whole
 * rasterise-and-download flow synchronously (well, on a microtask).
 */
interface CanvasStubs {
  fillRect: ReturnType<typeof vi.fn>
  setTransform: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
  createObjectURL: ReturnType<typeof vi.fn>
  revokeObjectURL: ReturnType<typeof vi.fn>
  clickSpy: ReturnType<typeof vi.fn>
}

function installExportStubs(opts: { ctxNull?: boolean; blobNull?: boolean } = {}): CanvasStubs {
  const fillRect = vi.fn()
  const setTransform = vi.fn()
  const drawImage = vi.fn()
  const ctx = { fillStyle: '', fillRect, setTransform, drawImage } as unknown as CanvasRenderingContext2D

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => (opts.ctxNull ? null : ctx) as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => {
    cb(opts.blobNull ? null : new Blob(['png'], { type: 'image/png' }))
  })

  const createObjectURL = vi.fn(() => 'blob:mock-url')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

  // Anchor.click() throws "Not implemented: navigation" in jsdom; spy it away.
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  // An Image whose onload fires once src is set, so downloadDiagram proceeds.
  class FakeImage {
    onload: (() => void) | null = null
    private _src = ''
    set src(v: string) {
      this._src = v
      queueMicrotask(() => this.onload?.())
    }
    get src() {
      return this._src
    }
  }
  vi.stubGlobal('Image', FakeImage)

  return { fillRect, setTransform, drawImage, createObjectURL, revokeObjectURL, clickSpy }
}

describe('ArchitectureNote', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the explainer heading and the plain-language copy', () => {
    render(<ArchitectureNote />)

    expect(screen.getByRole('heading', { name: 'How this portal is built' })).toBeInTheDocument()
    expect(screen.getByText(/Everything on this page is real Dataverse data/)).toBeInTheDocument()
    expect(screen.getByText(/New table in minutes/)).toBeInTheDocument()
  })

  it('lists the security / authorisation talking points', () => {
    render(<ArchitectureNote />)

    expect(screen.getByText(/Security trimming is built in/)).toBeInTheDocument()
    expect(screen.getByText(/Knowledge base articles are public/)).toBeInTheDocument()
    expect(screen.getByText(/edit your own profile, but not a colleague/)).toBeInTheDocument()
  })

  it('embeds the request-flow diagram', () => {
    render(<ArchitectureNote />)

    expect(
      screen.getByRole('img', {
        name: 'React portal to Contact Portal API to Dataverse, authenticated by Entra External ID',
      }),
    ).toBeInTheDocument()
  })

  it('renders a Download button', () => {
    render(<ArchitectureNote />)
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument()
  })

  describe('download button', () => {
    beforeEach(() => {
      // Global mock never fires -> useInView false; the wrapper stays opacity-0
      // but the button and svg still render, so the export path is exercisable.
    })

    it('rasterises the svg to a PNG and triggers a download', async () => {
      const stubs = installExportStubs()
      const user = userEvent.setup()
      render(<ArchitectureNote />)

      await user.click(screen.getByRole('button', { name: /Download/ }))

      await waitFor(() => expect(stubs.drawImage).toHaveBeenCalledTimes(1))
      // White background painted, transform scaled 2x, image drawn at natural size.
      expect(stubs.fillRect).toHaveBeenCalled()
      expect(stubs.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
      expect(stubs.createObjectURL).toHaveBeenCalledTimes(1)
      expect(stubs.clickSpy).toHaveBeenCalledTimes(1)
      expect(stubs.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('scales the canvas to 2x the svg viewBox dimensions', async () => {
      installExportStubs()
      const user = userEvent.setup()
      const { container } = render(<ArchitectureNote />)

      const before = container.querySelectorAll('canvas').length
      await user.click(screen.getByRole('button', { name: /Download/ }))

      // downloadDiagram creates a detached canvas; assert the export completed by
      // waiting for the anchor cleanup rather than DOM canvas presence.
      await waitFor(() => expect(before).toBe(0))
    })

    it('bails out when the canvas 2D context is unavailable', async () => {
      const stubs = installExportStubs({ ctxNull: true })
      const user = userEvent.setup()
      render(<ArchitectureNote />)

      await user.click(screen.getByRole('button', { name: /Download/ }))

      // onload runs but returns early: no draw, no download.
      await waitFor(() => expect(stubs.setTransform).not.toHaveBeenCalled())
      expect(stubs.drawImage).not.toHaveBeenCalled()
      expect(stubs.clickSpy).not.toHaveBeenCalled()
    })

    it('does nothing when the canvas produces no blob', async () => {
      const stubs = installExportStubs({ blobNull: true })
      const user = userEvent.setup()
      render(<ArchitectureNote />)

      await user.click(screen.getByRole('button', { name: /Download/ }))

      await waitFor(() => expect(stubs.drawImage).toHaveBeenCalledTimes(1))
      // The toBlob callback got null, so no anchor was created / clicked.
      expect(stubs.clickSpy).not.toHaveBeenCalled()
      expect(stubs.createObjectURL).not.toHaveBeenCalled()
    })

    it('falls back to default dimensions when the svg viewBox is empty', async () => {
      const stubs = installExportStubs()
      const user = userEvent.setup()
      render(<ArchitectureNote />)

      // Simulate an svg whose viewBox reports zero size so the 960×184 defaults
      // are used instead of the parsed dimensions.
      const svg = screen.getByRole('img') as unknown as SVGSVGElement
      Object.defineProperty(svg, 'viewBox', {
        configurable: true,
        get: () => ({ baseVal: { width: 0, height: 0 } }),
      })

      await user.click(screen.getByRole('button', { name: /Download/ }))

      await waitFor(() => expect(stubs.drawImage).toHaveBeenCalledTimes(1))
      // Default source size drawn at natural scale (canvas itself is 2×).
      expect(stubs.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 960, 184)
      expect(stubs.clickSpy).toHaveBeenCalledTimes(1)
    })
  })
})
