import type { ReactNode } from 'react'
import { findActiveWordIndex } from '~/lib/player/active-word'
import type { Segment, WordTimestamp } from '~/types/db/database'

interface CurrentSentenceProps {
  segment: Segment | null
  showOriginalOnly: boolean // official 字幕永远显示原文（spec：防 LLM 改写）
  currentTime?: number
}

/** Render ruby furigana when the string contains simple 漢字(かな) patterns. */
function FuriganaText({ text }: { text: string }) {
  const parts = text.split(/([\u4e00-\u9fff\u3400-\u4dbf]+)\(([ぁ-んァ-ンー]+)\)/g)
  if (parts.length === 1) {
    return <>{text}</>
  }
  const nodes: ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
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
      i += 1
    } else if (i % 3 === 0) {
      nodes.push(<span key={i}>{part}</span>)
    }
  }
  return <>{nodes}</>
}

function KaraokeLine({ words, currentTime }: { words: WordTimestamp[]; currentTime: number }) {
  const active = findActiveWordIndex(words, currentTime)
  // Space-separated for Latin; no extra space for CJK / kana runs.
  const spaced = !words.some((w) => /[\u3040-\u30ff\u3400-\u9fff]/.test(w.word))
  return (
    <p className="font-heading text-xl font-bold leading-relaxed sm:text-2xl" aria-live="polite">
      {words.map((w, i) => {
        const isActive = i === active
        const isPast = active >= 0 && i < active
        return (
          <span
            key={`${w.start}:${w.end}:${w.word}`}
            className={
              isActive
                ? 'text-[var(--color-primary)] underline decoration-[var(--color-primary)] decoration-2 underline-offset-4 transition-colors'
                : isPast
                  ? 'text-[var(--text-primary)] opacity-90'
                  : 'text-[var(--text-secondary)] opacity-70'
            }
          >
            {w.word}
            {spaced && i < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </p>
  )
}

export function CurrentSentence({
  segment,
  showOriginalOnly,
  currentTime = 0,
}: CurrentSentenceProps) {
  if (!segment) {
    return <div className="min-h-[5rem]" />
  }

  const original = showOriginalOnly ? segment.text : (segment.normalizedText ?? segment.text)
  const furigana = segment.furigana?.trim()
  const words = segment.wordTimestamps?.filter((w) => w.word.trim().length > 0) ?? []
  // Karaoke only when we have real timings; don't invent karaoke from plain text.
  const useKaraoke = words.length > 0
  // Furigana is whole-line when karaoke is off (avoid misaligned word/ruby pairs).
  const useFurigana = !useKaraoke && !showOriginalOnly && Boolean(furigana)
  const displayText = useFurigana && furigana ? furigana : original

  return (
    <div className="flex min-h-[5rem] flex-col items-center gap-2 px-4 py-3 text-center">
      {useKaraoke ? (
        <KaraokeLine words={words} currentTime={currentTime} />
      ) : (
        <p className="font-heading text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
          {useFurigana ? <FuriganaText text={displayText} /> : displayText}
        </p>
      )}
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
