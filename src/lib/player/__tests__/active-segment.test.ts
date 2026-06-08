import { findActiveSegmentIndex } from '~/lib/player/active-segment'

describe('findActiveSegmentIndex', () => {
  // Contiguous-ish segments with a couple of gaps, used across cases.
  const segments = [
    { start: 0, end: 2 }, // index 0
    { start: 2, end: 4 }, // index 1 (touches 0 at t=2)
    { start: 5, end: 7 }, // index 2 (gap 4..5 before it)
    { start: 9, end: 11 }, // index 3 (gap 7..9 before it)
  ]

  describe('direct hits', () => {
    it('returns the index of the segment strictly containing the time', () => {
      expect(findActiveSegmentIndex(segments, 1)).toBe(0)
      expect(findActiveSegmentIndex(segments, 3)).toBe(1)
      expect(findActiveSegmentIndex(segments, 6)).toBe(2)
      expect(findActiveSegmentIndex(segments, 10)).toBe(3)
    })
  })

  describe('exact boundaries', () => {
    it('matches a segment at its exact start', () => {
      expect(findActiveSegmentIndex(segments, 0)).toBe(0)
      expect(findActiveSegmentIndex(segments, 5)).toBe(2)
      expect(findActiveSegmentIndex(segments, 9)).toBe(3)
    })

    it('matches a segment at its exact end', () => {
      // t=2 is the end of index 0 and the start of index 1; the lower index wins.
      expect(findActiveSegmentIndex(segments, 2)).toBe(0)
      expect(findActiveSegmentIndex(segments, 7)).toBe(2)
      expect(findActiveSegmentIndex(segments, 11)).toBe(3)
    })
  })

  describe('empty input', () => {
    it('returns -1 when there are no segments', () => {
      expect(findActiveSegmentIndex([], 0)).toBe(-1)
      expect(findActiveSegmentIndex([], 5)).toBe(-1)
    })
  })
})

describe('findActiveSegmentIndex — gaps, single segment, scale', () => {
  const segments = [
    { start: 0, end: 2 }, // 0
    { start: 2, end: 4 }, // 1
    { start: 5, end: 7 }, // 2 (gap 4..5)
    { start: 9, end: 11 }, // 3 (gap 7..9)
  ]

  describe('inter-segment gaps return the nearest segment', () => {
    it('snaps to the closer side of a gap', () => {
      // gap 4..5: t=4.2 is closer to seg 1 (end 4) than seg 2 (start 5)
      expect(findActiveSegmentIndex(segments, 4.2)).toBe(1)
      // gap 4..5: t=4.8 is closer to seg 2 (start 5)
      expect(findActiveSegmentIndex(segments, 4.8)).toBe(2)
      // gap 7..9: t=7.4 closer to seg 2 (end 7)
      expect(findActiveSegmentIndex(segments, 7.4)).toBe(2)
      // gap 7..9: t=8.6 closer to seg 3 (start 9)
      expect(findActiveSegmentIndex(segments, 8.6)).toBe(3)
    })

    it('breaks a midpoint tie toward the upcoming segment', () => {
      // gap 4..5 midpoint t=4.5 is equidistant; tie -> after (seg 2)
      expect(findActiveSegmentIndex(segments, 4.5)).toBe(2)
      // gap 7..9 midpoint t=8 is equidistant; tie -> after (seg 3)
      expect(findActiveSegmentIndex(segments, 8)).toBe(3)
    })

    it('returns the first segment when time is before everything', () => {
      expect(findActiveSegmentIndex(segments, -5)).toBe(0)
    })

    it('returns the last segment when time is after everything', () => {
      expect(findActiveSegmentIndex(segments, 100)).toBe(3)
    })
  })

  describe('single segment', () => {
    const one = [{ start: 3, end: 6 }]
    it('hits inside, at both boundaries, and clamps outside to index 0', () => {
      expect(findActiveSegmentIndex(one, 4)).toBe(0)
      expect(findActiveSegmentIndex(one, 3)).toBe(0)
      expect(findActiveSegmentIndex(one, 6)).toBe(0)
      expect(findActiveSegmentIndex(one, 0)).toBe(0) // before -> 0
      expect(findActiveSegmentIndex(one, 999)).toBe(0) // after -> 0
    })
  })

  describe('large array stays correct', () => {
    // 5000 segments: [0,1], gap, [2,3], gap, [4,5], ... i.e. start=2i, end=2i+1
    const big = Array.from({ length: 5000 }, (_, i) => ({ start: 2 * i, end: 2 * i + 1 }))

    it('finds an interior hit', () => {
      // seg 1234 spans [2468, 2469]; t=2468.5 is inside it
      expect(findActiveSegmentIndex(big, 2468.5)).toBe(1234)
    })

    it('finds an exact boundary', () => {
      expect(findActiveSegmentIndex(big, 2468)).toBe(1234) // start
      expect(findActiveSegmentIndex(big, 2469)).toBe(1234) // end
    })

    it('snaps a gap time to the nearer segment', () => {
      // gap between seg 1234 (end 2469) and seg 1235 (start 2470)
      expect(findActiveSegmentIndex(big, 2469.2)).toBe(1234)
      expect(findActiveSegmentIndex(big, 2469.8)).toBe(1235)
    })

    it('clamps the extremes', () => {
      expect(findActiveSegmentIndex(big, -1)).toBe(0)
      expect(findActiveSegmentIndex(big, 1_000_000)).toBe(4999)
    })
  })
})
