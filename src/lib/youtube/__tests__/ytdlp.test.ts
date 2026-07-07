import { describe, expect, it } from 'vitest'
import { parseJson3Cues } from '~/lib/youtube/ytdlp'

describe('parseJson3Cues', () => {
  it('maps events to MsCue with endMs = start + duration', () => {
    const raw = JSON.stringify({
      events: [
        { tStartMs: 292, dDurationMs: 2000, segs: [{ utf8: 'Think of the mind like an ocean.' }] },
        { tStartMs: 3040, dDurationMs: 4335, segs: [{ utf8: 'Up on the surface.' }] },
      ],
    })
    expect(parseJson3Cues(raw)).toEqual([
      { startMs: 292, endMs: 2292, text: 'Think of the mind like an ocean.' },
      { startMs: 3040, endMs: 7375, text: 'Up on the surface.' },
    ])
  })

  it('collapses newlines/whitespace across segs to single spaces', () => {
    const raw = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'line one\n' }, { utf8: '  line two' }] },
      ],
    })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 0, endMs: 1000, text: 'line one line two' }])
  })

  it('skips events without segs, with empty text, or without tStartMs', () => {
    const raw = JSON.stringify({
      events: [
        { tStartMs: 100, dDurationMs: 500 }, // no segs
        { tStartMs: 200, dDurationMs: 500, segs: [{ utf8: '   ' }] }, // empty text
        { dDurationMs: 500, segs: [{ utf8: 'no start' }] }, // no tStartMs
        { tStartMs: 300, dDurationMs: 500, segs: [{ utf8: 'kept' }] },
      ],
    })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 300, endMs: 800, text: 'kept' }])
  })

  it('treats missing dDurationMs as 0', () => {
    const raw = JSON.stringify({ events: [{ tStartMs: 500, segs: [{ utf8: 'x' }] }] })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 500, endMs: 500, text: 'x' }])
  })
})
