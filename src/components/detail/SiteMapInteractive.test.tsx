import { render, screen } from '@testing-library/react'
import { SiteMapInteractive } from './SiteMapInteractive'

// Mock env's MAP_KEY via a mutable holder (same trick as SiteMap.test) so each
// case can flip the key without resetModules. Mock the canvas too: maplibre-gl
// needs WebGL, which jsdom lacks — we only test the chrome + guards here.
const { mapKey } = vi.hoisted(() => ({ mapKey: { value: undefined as string | undefined } }))
vi.mock('../../env', () => ({
  get MAP_KEY() {
    return mapKey.value
  },
}))
vi.mock('./SiteMapCanvas', () => ({ default: () => <div data-testid="site-map-canvas" /> }))

afterEach(() => {
  mapKey.value = undefined
})

describe('SiteMapInteractive', () => {
  const leeds = { latitude: 53.7965, longitude: -1.5478, name: 'Leeds Head Office' }

  it('renders nothing without a map key', () => {
    const { container } = render(<SiteMapInteractive {...leeds} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without coordinates, even with a key', () => {
    mapKey.value = 'test-key'
    const { container } = render(<SiteMapInteractive name="Leeds Head Office" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the map canvas, caption, address and maps link when key + coords are present', async () => {
    mapKey.value = 'test-key'
    render(<SiteMapInteractive {...leeds} address="Unit 7, Leeds, LS10 1AB" caption="Interactive" />)

    expect(await screen.findByTestId('site-map-canvas')).toBeInTheDocument()
    expect(screen.getByText('Interactive')).toBeInTheDocument()
    expect(screen.getByText('Unit 7, Leeds, LS10 1AB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open in maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=53.7965,-1.5478',
    )
  })
})
