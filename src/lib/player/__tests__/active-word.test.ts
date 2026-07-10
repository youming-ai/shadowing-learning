import { describe, expect, it } from 'vitest'
import { findActiveWordIndex } from '~/lib/player/active-word'
import type { WordTimestamp } from '~/types/db/database'

const words: WordTimestamp[] = [
  { word: 'Hello', start: 1.0, end: 1.4 },
  { word: 'world', start: 1.4, end: 1.9 },
  { word: 'today', start: 2.1, end: 2.6 },
]

describe('findActiveWordIndex', () => {
  it('returns -1 for empty words', () => {
    expect(findActiveWordIndex([], 1)).toBe(-1)
  })

  it('returns -1 before the first word', () => {
    expect(findActiveWordIndex(words, 0.5)).toBe(-1)
  })

  it('hits the containing word (half-open [start, end))', () => {
    expect(findActiveWordIndex(words, 1.0)).toBe(0)
    expect(findActiveWordIndex(words, 1.39)).toBe(0)
    expect(findActiveWordIndex(words, 1.4)).toBe(1)
    expect(findActiveWordIndex(words, 1.89)).toBe(1)
  })

  it('keeps the last word lit after its end (sentence tail)', () => {
    expect(findActiveWordIndex(words, 2.6)).toBe(2)
    expect(findActiveWordIndex(words, 3.0)).toBe(2)
  })

  it('in an inter-word gap, prefers the nearer word (tie → upcoming)', () => {
    // gap [1.9, 2.1): midpoint 2.0 → equal distance 0.1 → upcoming (today)
    expect(findActiveWordIndex(words, 2.0)).toBe(2)
    // closer to previous
    expect(findActiveWordIndex(words, 1.95)).toBe(1)
  })
})
