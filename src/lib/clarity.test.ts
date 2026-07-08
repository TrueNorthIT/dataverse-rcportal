import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clarityConsent,
  clarityEvent,
  clarityIdentify,
  claritySetTag,
  clarityTrackPage,
  clarityUpgrade,
  getStoredClarityConsent,
  initClarity,
} from './clarity'
import type { AppUser } from '../config/entra'

/** Reset the Clarity global, injected scripts and stored consent between tests. */
function reset() {
  delete window.clarity
  localStorage.clear()
  document
    .querySelectorAll('script[src*="clarity.ms"], script[data-seed]')
    .forEach((s) => s.remove())
}

beforeEach(reset)
afterEach(reset)

describe('initClarity', () => {
  it('is a no-op without a project id', () => {
    expect(initClarity(undefined)).toBe(false)
    expect(window.clarity).toBeUndefined()
    expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull()
  })

  it('defaults to the (unset in tests) env id → no-op', () => {
    expect(initClarity()).toBe(false)
  })

  it('injects the loader and installs the queue shim', () => {
    expect(initClarity('abc123')).toBe(true)
    const script = document.querySelector<HTMLScriptElement>('script[src*="clarity.ms"]')
    expect(script).not.toBeNull()
    expect(script!.src).toContain('/tag/abc123')
    expect(script!.async).toBe(true)
    expect(typeof window.clarity).toBe('function')
  })

  it('buffers commands on the queue before the script loads', () => {
    initClarity('abc123')
    window.clarity!('identify', 'u1')
    expect(window.clarity!.q).toEqual([['identify', 'u1']])
  })

  it('is idempotent — a second call adds no second script', () => {
    initClarity('abc123')
    const shim = window.clarity
    expect(initClarity('abc123')).toBe(true)
    expect(window.clarity).toBe(shim)
    expect(document.querySelectorAll('script[src*="clarity.ms"]')).toHaveLength(1)
  })

  it('inserts before an existing script when the DOM already has one', () => {
    const seed = document.createElement('script')
    seed.dataset.seed = 'true'
    document.body.appendChild(seed)
    initClarity('abc123')
    const scripts = Array.from(document.getElementsByTagName('script'))
    const clarityIdx = scripts.findIndex((s) => s.src.includes('clarity.ms'))
    expect(clarityIdx).toBeGreaterThanOrEqual(0)
    expect(clarityIdx).toBeLessThan(scripts.indexOf(seed))
  })
})

describe('clarityIdentify', () => {
  const user: AppUser = { id: 'home-1', email: 'ada@example.com', name: 'Ada Lovelace' }

  it('identifies with the user id and email friendly name', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityIdentify(user)
    expect(spy).toHaveBeenCalledWith('identify', 'home-1', undefined, undefined, 'ada@example.com')
  })

  it('falls back to the name when there is no email', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityIdentify({ id: 'home-2', name: 'Grace' })
    expect(spy).toHaveBeenCalledWith('identify', 'home-2', undefined, undefined, 'Grace')
  })

  it('no-ops without a user', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityIdentify(undefined)
    expect(spy).not.toHaveBeenCalled()
  })

  it('no-ops (does not throw) when Clarity is not active', () => {
    expect(() => clarityIdentify(user)).not.toThrow()
  })
})

describe('clarityTrackPage', () => {
  it('sets the page custom tag', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityTrackPage('/cases/123')
    expect(spy).toHaveBeenCalledWith('set', 'page', '/cases/123')
  })

  it('no-ops (does not throw) when Clarity is not active', () => {
    expect(() => clarityTrackPage('/x')).not.toThrow()
  })
})

describe('claritySetTag', () => {
  it('sets a session custom tag', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    claritySetTag('company', 'Chevin Print')
    expect(spy).toHaveBeenCalledWith('set', 'company', 'Chevin Print')
  })

  it('no-ops (does not throw) when Clarity is not active', () => {
    expect(() => claritySetTag('env', 'production')).not.toThrow()
  })
})

describe('clarityEvent', () => {
  it('fires a custom event', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityEvent('case-raised')
    expect(spy).toHaveBeenCalledWith('event', 'case-raised')
  })

  it('no-ops (does not throw) when Clarity is not active', () => {
    expect(() => clarityEvent('x')).not.toThrow()
  })
})

describe('consent', () => {
  it('has no stored choice by default', () => {
    expect(getStoredClarityConsent()).toBeNull()
  })

  it('clarityConsent(true) stores the choice and signals consentv2 granted', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityConsent(true)
    expect(getStoredClarityConsent()).toBe('granted')
    expect(spy).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    })
  })

  it('clarityConsent(false) stores the choice and signals consentv2 denied', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityConsent(false)
    expect(getStoredClarityConsent()).toBe('denied')
    expect(spy).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    })
  })

  it('initClarity refuses to load once consent is declined', () => {
    clarityConsent(false)
    expect(initClarity('abc123')).toBe(false)
    expect(window.clarity).toBeUndefined()
    expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull()
  })

  it('initClarity re-signals a previously granted consent on the queue', () => {
    clarityConsent(true) // no window.clarity yet → only persists the choice
    initClarity('abc123')
    expect(window.clarity!.q).toEqual([
      ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }],
    ])
  })

  it('initClarity queues nothing when no choice is stored yet', () => {
    initClarity('abc123')
    expect(window.clarity!.q).toBeUndefined()
  })
})

describe('clarityUpgrade', () => {
  it('upgrades the session with a reason', () => {
    const spy = vi.fn()
    window.clarity = spy as unknown as Window['clarity']
    clarityUpgrade('case-raised')
    expect(spy).toHaveBeenCalledWith('upgrade', 'case-raised')
  })

  it('no-ops (does not throw) when Clarity is not active', () => {
    expect(() => clarityUpgrade('x')).not.toThrow()
  })
})
