import type { ReactNode } from 'react'
import type { Segment } from '~/types/db/database'

interface CurrentSentenceProps {
  segment: Segment | null
  showOriginalOnly: boolean // official 字幕永远显示原文（spec：防 LLM 改写）
}

/** Render ruby furigana when the string contains simple 漢字(かな) patterns. */
function FuriganaText({ text }: { text: string }) {
  // Pattern: one or more CJK chars followed by parentheses with kana
  const parts = text.split(/([\u4e00-\u9fff\u3400-\u4dbf]+)\(([ぁ-んァ-ンー]+)\)/g)
  if (parts.length === 1) {
    return <>{text}</>
  }
  const nodes: ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    // split with 2 capturing groups: plain, kanji, kana, plain, ...
    if (i % 3 === 1) {
      const kana = parts[i + 1]
      nodes.push(
        <ruby key={i}>
          {part}
          <rp>(</rp>
          <rt className="text-[0.55em] text-[var(--text-tertiary)]">{kana}</rt>
          <rp>)</rp>
        </ruby>,
      )
      i += 1 // skip kana part
    } else if (i % 3 === 0) {
      nodes.push(<span key={i}>{part}</span>)
    }
  }
  return <>{nodes}</>
}

export function CurrentSentence({ segment, showOriginalOnly }: CurrentSentenceProps) {
  if (!segment) {
    return <div className="min-h-[5rem]" />
  }
  const original = showOriginalOnly ? segment.text : (segment.normalizedText ?? segment.text)
  const furigana = segment.furigana?.trim()
  const useFurigana = !showOriginalOnly && Boolean(furigana)
  const displayText = useFurigana ? furigana! : original

  return (
    <div className="flex min-h-[5rem] flex-col items-center gap-2 px-4 py-3 text-center">
      <p className="font-heading text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
        {useFurigana ? <FuriganaText text={displayText} /> : displayText}
      </p>
      {segment.translation && (
        <p className="text-base text-[var(--text-secondary)]">{segment.translation}</p>
      )}
      {segment.annotations && segment.annotations.length > 0 && (
        <ul className="mt-1 max-w-prose space-y-0.5 text-left text-xs text-[var(--text-tertiary)]">
          {segment.annotations.slice(0, 4).map((note) => (
            <li key={note} className="flex gap-1.5">
              <span className="text-[var(--color-primary)]">·</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
