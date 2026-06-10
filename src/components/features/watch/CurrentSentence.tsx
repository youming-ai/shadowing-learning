import type { Segment } from '~/types/db/database'

interface CurrentSentenceProps {
  segment: Segment | null
  showOriginalOnly: boolean // official 字幕永远显示原文（spec：防 LLM 改写）
}

export function CurrentSentence({ segment, showOriginalOnly }: CurrentSentenceProps) {
  if (!segment) {
    return <div className="min-h-[5rem]" />
  }
  const original = showOriginalOnly ? segment.text : (segment.normalizedText ?? segment.text)
  return (
    <div className="flex min-h-[5rem] flex-col items-center gap-2 px-4 py-3 text-center">
      <p className="text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
        {original}
      </p>
      {segment.translation && (
        <p className="text-base text-[var(--text-secondary)]">{segment.translation}</p>
      )}
    </div>
  )
}
