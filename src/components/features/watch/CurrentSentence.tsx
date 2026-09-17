import { findActiveWordIndex } from '~/lib/player/active-word'
import { buildFuriganaTokens, type FuriganaToken } from '~/lib/subtitles/furigana'
import type { Segment, WordTimestamp } from '~/types/db/database'

interface CurrentSentenceProps {
  segment: Segment | null
  showOriginalOnly: boolean // official 字幕永远显示原文（spec：防 LLM 改写）
  currentTime?: number
}

/**
 * 用纯函数产出的 token 渲染 ruby 注音。
 *
 * 关键：显示文本逐字来自 `original`（`segment.text`），`reading` 只是叠加在上面的读音。
 * 绝不显示 `segment.furigana` 那串模型改写过的文本 —— 那会违反「官方字幕防 LLM 改写」。
 */
function RubyText({ tokens }: { tokens: FuriganaToken[] }) {
  // key 用「在原句中的累积偏移」而不是数组下标：同一句里同一个字可能出现多次，
  // 下标做 key 会在重渲染时错配（Biome 的 noArrayIndexKey 也正是不允许这么写）。
  let offset = 0
  const nodes = tokens.map((token) => {
    const key = `${offset}:${token.text}`
    offset += token.text.length
    return token.reading ? (
      <ruby key={key}>
        {token.text}
        <rp>(</rp>
        <rt className="text-[0.55em] text-[var(--text-tertiary)]">{token.reading}</rt>
        <rp>)</rp>
      </ruby>
    ) : (
      <span key={key}>{token.text}</span>
    )
  })

  return (
    <p className="font-heading text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
      {nodes}
    </p>
  )
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
                ? 'text-[var(--rhythm-beat)] underline decoration-[var(--rhythm-beat)] decoration-2 underline-offset-4 transition-colors'
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
  /**
   * furigana 与 `showOriginalOnly` **不冲突**：注音只是叠加在原句上的读音，
   * 显示文本仍是 `original`（官方字幕 = 原文）。所以这里不再拿 showOriginalOnly 挡它 ——
   * 以前那条 `!showOriginalOnly` 让整个分支永久不可达（source 只可能是 'official'）。
   * 逐段注音 / 整词注音的区别见 `buildFuriganaTokens`。
   */
  const useFurigana = !useKaraoke && Boolean(furigana)

  return (
    <div className="flex min-h-[5rem] flex-col items-center gap-2 px-4 py-3 text-center">
      {useKaraoke ? (
        <KaraokeLine words={words} currentTime={currentTime} />
      ) : useFurigana && furigana ? (
        <RubyText tokens={buildFuriganaTokens(original, furigana)} />
      ) : (
        <p className="font-heading text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
          {original}
        </p>
      )}
      {segment.translation && (
        <p className="text-base text-[var(--text-secondary)]">{segment.translation}</p>
      )}
      {segment.annotations && segment.annotations.length > 0 && (
        <ul className="mt-1 max-w-prose space-y-0.5 text-left text-xs text-[var(--text-tertiary)]">
          {segment.annotations.slice(0, 4).map((note) => (
            <li key={note} className="flex gap-1.5">
              <span className="text-[var(--rhythm-beat)]">·</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
