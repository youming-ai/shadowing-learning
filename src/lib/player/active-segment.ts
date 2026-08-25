/**
 * Find the index of the segment that "owns" the given playback time.
 *
 * - If `time` falls inside a segment (`start <= time <= end`), returns that
 *   segment's index. On an exact shared boundary between two adjacent
 *   segments, the lower index wins (binary search lands on the earlier one).
 * - If `time` falls in an inter-segment gap (silence between two segments),
 *   returns the index of the NEAREST segment by distance, so highlighting
 *   never blinks out during silence.
 * - Returns -1 only when `segments` is empty.
 *
 * Segments are assumed sorted by `start` ascending and non-overlapping, which
 * is how the transcription pipeline produces them.
 */
export function findActiveSegmentIndex(
  segments: { start: number; end: number }[],
  time: number,
): number {
  const n = segments.length
  if (n === 0) return -1

  let left = 0
  let right = n - 1

  // Binary search for a containing segment.
  while (left <= right) {
    const mid = (left + right) >> 1
    const seg = segments[mid]
    if (time < seg.start) {
      right = mid - 1
    } else if (time > seg.end) {
      left = mid + 1
    } else if (mid > 0 && time <= segments[mid - 1].end) {
      // `time` also lies on the shared boundary with the previous segment;
      // keep searching left so the lower index wins.
      right = mid - 1
    } else {
      return mid
    }
  }

  // No containing segment: `right` is the last segment that ends before `time`
  // and `left` is the first segment that starts after `time`. One of them may
  // be out of range when `time` is before the first or after the last segment.
  const before = right // segment ending before `time`, or -1
  const after = left // segment starting after `time`, or n

  if (before < 0) return after // time before everything -> first segment
  if (after >= n) return before // time after everything -> last segment

  const distBefore = time - segments[before].end
  const distAfter = segments[after].start - time
  // Tie goes to the upcoming segment (after), matching "next line about to start".
  return distAfter <= distBefore ? after : before
}
