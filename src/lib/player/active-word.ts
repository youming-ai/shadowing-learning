import type { WordTimestamp } from '~/types/db/database'

/**
 * Find which word is "active" at `time` for karaoke highlighting.
 *
 * - Returns the first word where `start <= time < end` (half-open).
 * - On an exact end boundary shared with the next word's start, the next word wins
 *   only if time is in that next word's interval; otherwise the containing word wins.
 * - If `time` is after the last word's end (but still in the sentence silence tail),
 *   returns the last word index so the highlight stays lit.
 * - If `time` is before the first word, returns -1 (nothing lit yet).
 * - Empty list → -1.
 */
export function findActiveWordIndex(words: WordTimestamp[], time: number): number {
  const n = words.length
  if (n === 0) return -1

  // Linear scan is fine: a sentence rarely has > 40 words, and keeps edge logic simple.
  for (let i = 0; i < n; i++) {
    const w = words[i]
    if (time >= w.start && time < w.end) return i
  }

  if (time < words[0].start) return -1
  if (time >= words[n - 1].end) return n - 1

  // In a gap between words: nearest by distance; tie → upcoming word.
  for (let i = 0; i < n - 1; i++) {
    const cur = words[i]
    const next = words[i + 1]
    if (time >= cur.end && time < next.start) {
      const distBefore = time - cur.end
      const distAfter = next.start - time
      return distAfter <= distBefore ? i + 1 : i
    }
  }

  return -1
}
