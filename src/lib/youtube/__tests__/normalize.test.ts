import { describe, expect, it } from 'vitest'
import { type CaptionCue, mergeShortCues, msCuesToSeconds } from '~/lib/youtube/normalize'

describe('msCuesToSeconds', () => {
  it('converts ms offsets to seconds', () => {
    expect(msCuesToSeconds([{ startMs: 1500, endMs: 4250, text: 'hi' }])).toEqual([
      { start: 1.5, end: 4.25, text: 'hi' },
    ])
  })
})

describe('mergeShortCues', () => {
  const cue = (start: number, end: number, text: string): CaptionCue => ({ start, end, text })

  it('merges a fragment shorter than 1.2s without ending punctuation into the next cue', () => {
    const merged = mergeShortCues([cue(0, 0.8, 'I was'), cue(0.8, 3, 'told to make my bed.')])
    expect(merged).toEqual([cue(0, 3, 'I was told to make my bed.')])
  })

  it('keeps short fragments that end with sentence punctuation', () => {
    const input = [cue(0, 1, 'Yeah.'), cue(1, 4, 'That is about right.')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('keeps long cues as-is and supports CJK punctuation', () => {
    const input = [cue(0, 0.9, '你好。'), cue(0.9, 5, '欢迎来到本频道，今天我们聊聊苹果。')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('chains merges across consecutive fragments', () => {
    const merged = mergeShortCues([cue(0, 0.5, 'a'), cue(0.5, 1.0, 'b'), cue(1.0, 4, 'c done.')])
    expect(merged).toEqual([cue(0, 4, 'a b c done.')])
  })

  it('last cue is never dropped even if short', () => {
    const input = [cue(0, 3, 'Hello there.'), cue(3, 3.5, 'bye')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('handles empty input', () => {
    expect(mergeShortCues([])).toEqual([])
  })
})
