/**
 * furigana（振り仮名）的渲染前解析。
 *
 * 背景：官方字幕的 spec 是**永远显示原文**，防 LLM 改写（见 `CurrentSentence`）。
 * 而 `segment.furigana` 是模型返回的、带注音的**改写文本** —— 直接显示它，就等于
 * 推翻了那条 spec。这正是原先「显示 furigana」的分支被 `showOriginalOnly` 全部挡死、
 * 变成死代码的原因：两个需求在当时被当成了二选一。
 *
 * 这里两者都要：把模型返回的「汉字 → 读音」抽出来，只把读音**叠加**到原句上。
 * 于是显示文本逐字来自 `segment.text`（模型改写的措辞一个字都不会露出来），
 * 而注音照常显示，furigana 开关真正生效。
 *
 * 纯函数、不碰 DOM，可单测。**核心不变量**：返回的 token 拼起来必须逐字等于传入的原文
 * （有测试守着）。
 */

/** 一个待渲染片段。`reading` 仅在能查到读音时给出。*/
export interface FuriganaToken {
  /** 原文字符。**永不被改写**。*/
  text: string
  /** 汉字读音（かな）。*/
  reading?: string
}

interface ReadingPair {
  run: string
  reading: string
}

/** 汉字连续段（含扩展 A 区）的字符类片段。*/
const KANJI_CLASS = '[\\u4e00-\\u9fff\\u3400-\\u4dbf]+'

/** `漢字(かな)` 注音对（组 1 = 汉字段，组 2 = 读音），兼容半角/全角圆括号与方括号。*/
const READING_PAIR_SOURCE = `(${KANJI_CLASS})\\s*[（(\\[]([ぁ-んァ-ンー・]+)[）)\\]]`

/** 按出现顺序解析出「汉字段 → 读音」对。*/
function parseReadingPairs(furiganaText: string): ReadingPair[] {
  const pairs: ReadingPair[] = []
  for (const match of furiganaText.matchAll(new RegExp(READING_PAIR_SOURCE, 'g'))) {
    pairs.push({ run: match[1], reading: match[2] })
  }
  return pairs
}

/**
 * 一个汉字段该挂哪些读音。
 *
 * 不能只做「整段精确匹配」：原文里连续汉字是**一段**（「日本語」），而模型常常按词
 * 注音成 `日本(にほん)語(ご)` —— 此时段与对不是一对一。所以这里按顺序把若干注音对
 * **拼**起来对齐到这一段：
 *
 * - `日本(にほん)語(ご)` + 原文「日本語」→ 日本(にほん) + 語(ご)
 * - `日本語(にほんご)` + 原文「日本語」→ 日本語(にほんご)
 * - `日(にち)曜日(び)` + 原文「日曜日」→ 日(にち) + 曜日(び)
 * - 只注了一半（`日(にち)` + 「日曜日」）→ 日(にち) + 曜日（余下部分保持原文）
 *
 * 每一步都用 `startsWith` 校验拼接结果确实对应本段的前缀，因此读音不会错位到别的字上；
 * 首对就对不上时**不消费**任何注音对，留给后面的汉字段去匹配。
 */
function matchRunReadings(
  run: string,
  pairs: ReadingPair[],
  startIndex: number,
): { tokens: FuriganaToken[]; nextIndex: number } {
  const consumed: FuriganaToken[] = []
  let acc = ''
  let index = startIndex

  while (index < pairs.length && acc.length < run.length) {
    const next = acc + pairs[index].run
    // 拼接结果必须是本段的前缀，否则这一对不属于本段，就此打住
    if (!run.startsWith(next)) break
    acc = next
    consumed.push({ text: pairs[index].run, reading: pairs[index].reading })
    index += 1
  }

  if (consumed.length === 0) return { tokens: [{ text: run }], nextIndex: startIndex }

  const remainder = run.slice(acc.length)
  if (remainder) consumed.push({ text: remainder })
  return { tokens: consumed, nextIndex: index }
}

/**
 * 把原文切成可渲染片段，并把查得到的读音挂到对应汉字段上。
 *
 * 刻意**不用** `String.prototype.split` 配捕获组来切分：带 `g` 标志时 Bun 会丢掉捕获组
 * （V8 不会），同一份代码会在浏览器里正常、在 `bun run test:run` 下把汉字整段吞掉。
 * 手动按 `matchAll` 的 index 切片既避开这个引擎差异，也让「拼回去等于原文」由构造方式保证。
 *
 * 已知限制：只识别 `漢字(かな)` 形式的注音。若模型整词注音（`食べる(たべる)`），
 * 汉字段「食」拼不出「食べる」，该词回落为纯文本 —— 宁可不注音，也不要猜错读音，
 * 更不能拿模型的改写文本顶替原文。
 */
export function buildFuriganaTokens(originalText: string, furiganaText: string): FuriganaToken[] {
  const pairs = parseReadingPairs(furiganaText)
  if (pairs.length === 0) return [{ text: originalText }]

  const tokens: FuriganaToken[] = []
  let pairIndex = 0
  let cursor = 0

  for (const match of originalText.matchAll(new RegExp(KANJI_CLASS, 'g'))) {
    const start = match.index ?? 0
    if (start > cursor) tokens.push({ text: originalText.slice(cursor, start) })

    const matched = matchRunReadings(match[0], pairs, pairIndex)
    tokens.push(...matched.tokens)
    pairIndex = matched.nextIndex
    cursor = start + match[0].length
  }

  if (cursor < originalText.length) tokens.push({ text: originalText.slice(cursor) })
  return tokens
}
