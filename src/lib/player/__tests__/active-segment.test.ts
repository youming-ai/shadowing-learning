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
