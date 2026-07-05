import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONNECTIVITY_COLORS,
  HEALTH_COLORS,
  PRIORITY_COLORS,
  QUOTE_COLORS,
  reducedMotion,
} from './palette'

describe('palette colour maps', () => {
  it('maps each project health key to a distinct brand hex', () => {
    expect(HEALTH_COLORS).toEqual({
      ontrack: '#1c6b4f',
      duesoon: '#f59e0b',
      overdue: '#ef4444',
      complete: '#005862',
    })
  })

  it('maps priority keys to hex colours', () => {
    expect(HEALTH_COLORS.overdue).toBe(PRIORITY_COLORS.high)
    expect(PRIORITY_COLORS.normal).toBe('#f59e0b')
    expect(PRIORITY_COLORS.low).toBe('#1c6b4f')
  })

  it('maps quote states to blue (active) and slate (draft)', () => {
    expect(QUOTE_COLORS.active).toBe('#0066b3')
    expect(QUOTE_COLORS.draft).toBe('#94a3b8')
  })

  it('exposes a five-colour connectivity sweep of real hex values', () => {
    expect(CONNECTIVITY_COLORS).toHaveLength(5)
    for (const c of CONNECTIVITY_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('reducedMotion', () => {
  const original = window.matchMedia
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: original, configurable: true })
  })

  it('is false when the OS does not request reduced motion', () => {
    // setup.ts stubs matchMedia to always return matches:false.
    expect(reducedMotion()).toBe(false)
  })

  it('is true when the OS prefers reduced motion', () => {
    const mql = vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
    Object.defineProperty(window, 'matchMedia', { value: mql, configurable: true })

    expect(reducedMotion()).toBe(true)
    expect(mql).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('is false when matchMedia is unavailable in the environment', () => {
    // window.matchMedia is the property reducedMotion guards on.
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true })
    expect(reducedMotion()).toBe(false)
  })
})
