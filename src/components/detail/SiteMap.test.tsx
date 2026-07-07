import { render, screen, fireEvent } from '@testing-library/react'
import { SiteMap } from './SiteMap'

// SiteMap reads MAP_KEY from env at module load. Mock env with a getter backed
// by a mutable holder so each test can flip the key without resetModules —
// which would pull in a second React copy and break the component's hooks.
const { mapKey } = vi.hoisted(() => ({ mapKey: { value: undefined as string | undefined } }))
vi.mock('../../env', () => ({
  get MAP_KEY() {
    return mapKey.value
  },
}))

afterEach(() => {
  mapKey.value = undefined
})

describe('SiteMap', () => {
  const leeds = { latitude: 53.7965, longitude: -1.5478, name: 'Leeds Head Office' }

  it('renders nothing without a map key', () => {
    const { container } = render(<SiteMap {...leeds} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without coordinates, even with a key', () => {
    mapKey.value = 'test-key'
    const { container } = render(<SiteMap name="Leeds Head Office" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a MapTiler static image, address and maps link when key + coords are present', () => {
    mapKey.value = 'test-key'
    render(<SiteMap {...leeds} address="Unit 7, Leeds, LS10 1AB" />)

    const src = screen.getByRole('img', { name: /Leeds Head Office/i }).getAttribute('src') ?? ''
    expect(src).toContain('api.maptiler.com')
    // MapTiler static maps take lon before lat — guard against a coordinate swap.
    expect(src).toContain('-1.5478,53.7965')
    expect(src).toContain('key=test-key')

    expect(screen.getByText('Unit 7, Leeds, LS10 1AB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open in maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=53.7965,-1.5478',
    )
  })

  it('falls back to a brand panel when the map image fails to load', () => {
    mapKey.value = 'test-key'
    render(<SiteMap {...leeds} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).toBeNull()
    // The pin + maps link still render, so the panel never looks broken.
    expect(screen.getByRole('link', { name: /open in maps/i })).toBeInTheDocument()
  })
})
