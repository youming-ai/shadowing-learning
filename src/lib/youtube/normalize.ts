export interface CaptionCue {
  start: number // 秒
  end: number
  text: string
}

export interface MsCue {
  startMs: number
  endMs: number
  text: string
}

const SENTENCE_END_RE = /[.!?。！？…]["')\]」』]?$/
const MIN_CUE_SECONDS = 1.2

export function msCuesToSeconds(cues: MsCue[]): CaptionCue[] {
  return cues.map((c) => ({ start: c.startMs / 1000, end: c.endMs / 1000, text: c.text }))
}

/**
 * YouTube ASR 字幕碎片化严重；将「时长 < 1.2s 且不以句末标点结尾」的片段
 * 并入下一段，避免翻译与逐句学习体验被碎片破坏。最后一段永不丢弃。
 */
export function mergeShortCues(cues: CaptionCue[]): CaptionCue[] {
  const result: CaptionCue[] = []
  let pending: CaptionCue | null = null

  for (const cue of cues) {
    const current: CaptionCue = pending
      ? { start: pending.start, end: cue.end, text: `${pending.text} ${cue.text}`.trim() }
      : { ...cue }
    pending = null

    const duration = current.end - current.start
    if (duration < MIN_CUE_SECONDS && !SENTENCE_END_RE.test(current.text.trim())) {
      pending = current
    } else {
      result.push(current)
    }
  }

  if (pending) result.push(pending)
  return result
}
