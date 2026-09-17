import { describe, expect, it } from 'vitest'
import { buildFuriganaTokens, type FuriganaToken } from '~/lib/subtitles/furigana'

const joined = (tokens: FuriganaToken[]) => tokens.map((t) => t.text).join('')
const ruby = (tokens: FuriganaToken[]) =>
  tokens.filter((t) => t.reading).map((t) => `${t.text}(${t.reading})`)

describe('buildFuriganaTokens', () => {
  /**
   * 核心不变量：显示文本必须逐字等于原句。
   * 这条一破，就等于把模型改写过的措辞显示给了用户（spec：官方字幕防 LLM 改写）。
   */
  const INVARIANT_CASES: Array<[string, string]> = [
    ['私は日本語を勉強します', '私(わたし)は日本(にほん)語(ご)を勉強(べんきょう)します'],
    ['日本語', '日本語(にほんご)'], // 整词注音
    ['日本語', '日本(にほん)語(ご)'], // 按词拆开注音（原文里是一整段连续汉字）
    ['日曜日', '日(にち)曜日(び)'],
    ['猫が好き', '私は猫(ねこ)が好きです'], // furigana 串措辞与原文不同
    ['食べる', '食べる(たべる)'], // 整词注音但含送假名：匹配不到，回落纯文本
    ['こんにちは', 'こんにちは'], // 无汉字
    ['日本語', ''], // 无注音
    ['日本語', 'English(イングリッシュ)'], // 注音对与原文毫无关系
  ]

  it.each(INVARIANT_CASES)('拼起来逐字等于原文：%s', (original, furigana) => {
    expect(joined(buildFuriganaTokens(original, furigana))).toBe(original)
  })

  it('把读音挂到对应汉字上，其余部分保持原样', () => {
    const tokens = buildFuriganaTokens(
      '私は日本語を勉強します',
      '私(わたし)は日本(にほん)語(ご)を勉強(べんきょう)します',
    )

    expect(ruby(tokens)).toEqual(['私(わたし)', '日本(にほん)', '語(ご)', '勉強(べんきょう)'])
    expect(tokens.filter((t) => t.text === 'は' || t.text === 'を')).toEqual([
      { text: 'は' },
      { text: 'を' },
    ])
  })

  it('原文一整段连续汉字，也能被多个注音对覆盖', () => {
    const tokens = buildFuriganaTokens('日本語', '日本(にほん)語(ご)')

    expect(ruby(tokens)).toEqual(['日本(にほん)', '語(ご)'])
    expect(joined(tokens)).toBe('日本語')
  })

  it('模型改写过的措辞不会出现在输出里', () => {
    const tokens = buildFuriganaTokens('猫が好き', '私は猫(ねこ)が好きです')

    expect(joined(tokens)).toBe('猫が好き')
    expect(joined(tokens)).not.toContain('私')
    expect(ruby(tokens)).toEqual(['猫(ねこ)'])
  })

  it('同一个字出现多次时按出现顺序取读音', () => {
    const tokens = buildFuriganaTokens('日と日', '日(ひ)と日(にち)')

    expect(ruby(tokens)).toEqual(['日(ひ)', '日(にち)'])
  })

  it('只注了一部分时，余下部分保持原文', () => {
    const tokens = buildFuriganaTokens('日曜日', '日(にち)')

    expect(tokens).toEqual([{ text: '日', reading: 'にち' }, { text: '曜日' }])
  })

  it('注音对与原文对不上时不消费它，也不会错挂到别的字上', () => {
    const tokens = buildFuriganaTokens('猫が好き', '犬(いぬ)')

    expect(ruby(tokens)).toEqual([])
    expect(joined(tokens)).toBe('猫が好き')
  })

  /**
   * 回归：模型顺手改写了句子、在 furigana 串里多注了原文没有的汉字时，
   * 那个多出来的注音对曾把对齐指针**永久钉住**，后面本来正确的读音也一并丢掉。
   */
  it('跳过模型自造、原文里没有的注音对，而不是被它钉住', () => {
    const tokens = buildFuriganaTokens('猫が好き', '私(わたし)は猫(ねこ)が好(すき)です')

    expect(ruby(tokens)).toEqual(['猫(ねこ)', '好(すき)'])
    expect(joined(tokens)).toBe('猫が好き')
  })

  it('首个注音对属于后一段时，不消费它，留给后面匹配', () => {
    const tokens = buildFuriganaTokens('猫犬', '犬(いぬ)')

    expect(tokens).toEqual([{ text: '猫' }, { text: '犬', reading: 'いぬ' }])
  })

  /** 回归：「々」「ヶ」等记号曾被排除在汉字段之外，`時々` 这类常见词因此完全没有注音。 */
  it.each([
    ['時々', 'ときどき'],
    ['人々', 'ひとびと'],
    ['三ヶ月', 'さんかげつ'],
  ])('叠字/构词记号参与匹配：%s', (original, reading) => {
    const tokens = buildFuriganaTokens(original, `${original}(${reading})`)

    expect(ruby(tokens)).toEqual([`${original}(${reading})`])
    expect(joined(tokens)).toBe(original)
  })

  it.each([
    ['日本（にほん）', '全角圆括号'],
    ['日本[にほん]', '方括号'],
    ['日本(にほん)', '半角圆括号'],
  ])('兼容注音括号写法：%s', (furigana) => {
    expect(ruby(buildFuriganaTokens('日本', furigana))).toEqual(['日本(にほん)'])
  })

  it('没有任何注音对时返回单个纯文本片段', () => {
    expect(buildFuriganaTokens('こんにちは', '')).toEqual([{ text: 'こんにちは' }])
  })
})
