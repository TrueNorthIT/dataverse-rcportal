import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanDescription,
  formatCurrency,
  formatDate,
  humanDuration,
  relativeFromNow,
} from './format'

describe('formatCurrency', () => {
  it('formats whole pounds with no decimals', () => {
    expect(formatCurrency(125000)).toBe('£125,000')
  })

  it('renders a dash for null, undefined, and NaN', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
    expect(formatCurrency(Number.NaN)).toBe('—')
  })

  it('formats zero as £0', () => {
    expect(formatCurrency(0)).toBe('£0')
  })
})

describe('formatDate', () => {
  it('formats an ISO date as "d Mon yyyy"', () => {
    expect(formatDate('2026-07-05')).toBe('5 Jul 2026')
  })

  it('renders a dash for empty and invalid input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })
})

describe('cleanDescription', () => {
  it('strips the demo marker and legacy boilerplate', () => {
    const raw = '[DEMO-RCPORTAL] Real copy. Fictional demo data — not real data.'
    expect(cleanDescription(raw)).toBe('Real copy.')
  })

  it('returns an empty string for null/undefined', () => {
    expect(cleanDescription(null)).toBe('')
    expect(cleanDescription(undefined)).toBe('')
  })

  it('leaves clean text untouched (trimmed)', () => {
    expect(cleanDescription('  Hello world  ')).toBe('Hello world')
  })
})

describe('humanDuration', () => {
  it('phrases days, weeks and months', () => {
    expect(humanDuration(1)).toBe('1 day')
    expect(humanDuration(5)).toBe('5 days')
    expect(humanDuration(21)).toBe('3 weeks')
    expect(humanDuration(120)).toBe('4 months')
  })

  it('uses the absolute value and handles sub-day spans', () => {
    expect(humanDuration(-5)).toBe('5 days')
    expect(humanDuration(0)).toBe('less than a day')
  })
})

describe('relativeFromNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says "today" for the current day', () => {
    expect(relativeFromNow('2026-07-05T09:00:00Z')).toBe('today')
  })

  it('phrases near-future and near-past dates relatively', () => {
    expect(relativeFromNow('2026-07-08T12:00:00Z')).toBe('in 3 days')
    expect(relativeFromNow('2026-06-21T12:00:00Z')).toBe('2 weeks ago')
  })

  it('falls back to an absolute date beyond the 90-day horizon', () => {
    expect(relativeFromNow('2027-01-01T12:00:00Z')).toBe('1 Jan 2027')
  })

  it('renders a dash for empty and invalid input', () => {
    expect(relativeFromNow(null)).toBe('—')
    expect(relativeFromNow('nope')).toBe('—')
  })
})
