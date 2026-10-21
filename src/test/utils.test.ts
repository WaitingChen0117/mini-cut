import { describe, it, expect } from 'vitest'
import { formatTime, clamp, generateId } from '../utils/time'

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('00:00.0')
  })

  it('formats 65.5 seconds', () => {
    expect(formatTime(65.5)).toBe('01:05.5')
  })

  it('formats sub-second', () => {
    expect(formatTime(0.3)).toBe('00:00.3')
  })
})

describe('clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 10)).toBe(0))
  it('clamps above max', () => expect(clamp(15, 0, 10)).toBe(10))
  it('returns value in range', () => expect(clamp(5, 0, 10)).toBe(5))
})

describe('generateId', () => {
  it('returns non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0)
  })

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId))
    expect(ids.size).toBe(100)
  })
})
