import { describe, expect, it, vi } from 'vitest'
import {
  buildBatchPrompt,
  buildSegmentPrompt,
  type ChatFn,
  FatalEngineError,
  fallbackResult,
  indexResults,
  POSTPROCESS_TEMPERATURE,
  parsePostProcessJson,
  processSegmentsWithChat,
  SHORT_TEXT_THRESHOLD,
  stripFence,
} from '~shared/ai/postprocess-core'

const SEG = (text: string, i: number) => ({ text, start: i, end: i + 1, segmentIndex: i })

/** 一个把请求记下来、按预设脚本回话的假传输层。 */
function makeChat(replies: string[]): { chat: ChatFn; calls: Parameters<ChatFn>[0][] } {
  const calls: Parameters<ChatFn>[0][] = []
  let n = 0
  const chat: ChatFn = async (req) => {
    calls.push(req)
    return replies[Math.min(n++, replies.length - 1)] ?? ''
  }
  return { chat, calls }
}

describe('stripFence', () => {
  it('去掉 ```json 围栏', () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('去掉裸 ``` 围栏', () => {
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('从前后废话中截出最外层 JSON 对象', () => {
    expect(stripFence('Sure! here you go: {"a":1} hope that helps')).toBe('{"a":1}')
  })

  it('没有 JSON 时原样返回 trim 结果', () => {
    expect(stripFence('  plain text  ')).toBe('plain text')
  })
})

describe('parsePostProcessJson', () => {
  it('解析标准形状', () => {
    const parsed = parsePostProcessJson(
      '{"normalizedText":"A","translation":"甲","annotations":["n"]}',
    )
    expect(parsed).toEqual({
      normalizedText: 'A',
      translation: '甲',
      annotations: ['n'],
      furigana: undefined,
    })
  })

  it('兼容用 text 字段代替 normalizedText 的模型输出', () => {
    expect(parsePostProcessJson('{"text":"A"}').normalizedText).toBe('A')
  })

  it('annotations 缺省为数组而非 undefined', () => {
    expect(parsePostProcessJson('{"normalizedText":"A"}').annotations).toEqual([])
  })

  it('不可解析时退回原文，不抛错', () => {
    expect(parsePostProcessJson('not json').normalizedText).toBe('not json')
  })
})

describe('buildSegmentPrompt', () => {
  it('按开关拼接要求编号', () => {
    const p = buildSegmentPrompt('こんにちは', 'ja', 'en', true, true)
    expect(p).toContain('Provide translation to English')
    expect(p).toContain('\n3. Add grammatical and cultural annotations')
    expect(p).toContain('\n4. Include furigana for kanji')
  })

  it('非日语不出 furigana 要求', () => {
    expect(buildSegmentPrompt('hi', 'en', 'zh-CN', true, true)).not.toContain('furigana for kanji')
  })

  it('关掉注释时不出现第 3 条', () => {
    expect(buildSegmentPrompt('hi', 'en', 'zh-CN', false, false)).not.toContain('\n3.')
  })
})

describe('buildBatchPrompt', () => {
  it('按目标语言与开关决定 JSON 形状里的字段', () => {
    const p = buildBatchPrompt(2, '[SEGMENT_0] a\n[SEGMENT_1] b', 'ja', {
      language: 'ja',
      targetLanguage: 'en',
      enableAnnotations: true,
      enableFurigana: true,
    })
    expect(p).toContain('[SEGMENT_0] a')
    expect(p).toContain('"translation"')
    expect(p).toContain('"annotations"')
    expect(p).toContain('"furigana"')
  })

  it('无目标语言时形状里不含 translation', () => {
    const p = buildBatchPrompt(1, '[SEGMENT_0] a', 'ja', { language: 'ja', enableFurigana: true })
    expect(p).not.toContain('"translation"')
  })

  it('非日语不含 furigana 字段', () => {
    const p = buildBatchPrompt(1, '[SEGMENT_0] a', 'en', {
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: true,
    })
    expect(p).not.toContain('"furigana"')
  })
})

describe('processSegmentsWithChat', () => {
  const options = {
    language: 'ja',
    targetLanguage: 'en',
    enableAnnotations: true,
    enableFurigana: true,
  }

  it('短文本合批为一次请求并逐条回填', async () => {
    const { chat, calls } = makeChat([
      '{"segments":[{"id":0,"normalizedText":"A","translation":"甲"},{"id":1,"normalizedText":"B","translation":"乙"}]}',
    ])
    const out = await processSegmentsWithChat([SEG('a', 0), SEG('b', 1)], options, chat)

    expect(calls).toHaveLength(1)
    expect(out.map((r) => r.translation)).toEqual(['甲', '乙'])
    expect(out.map((r) => r.segmentIndex)).toEqual([0, 1])
  })

  it('长文本逐条处理，与短文本分流', async () => {
    const long = 'x'.repeat(SHORT_TEXT_THRESHOLD + 1)
    const { chat, calls } = makeChat([
      '{"segments":[{"normalizedText":"short"}]}',
      '{"normalizedText":"long"}',
    ])
    const out = await processSegmentsWithChat([SEG('short', 0), SEG(long, 1)], options, chat)

    expect(calls).toHaveLength(2)
    expect(out[0].normalizedText).toBe('short')
    expect(out[1].normalizedText).toBe('long')
  })

  it('阈值边界：等于阈值走批处理', async () => {
    const exact = 'x'.repeat(SHORT_TEXT_THRESHOLD)
    const { chat, calls } = makeChat(['{"segments":[{"normalizedText":"ok"}]}'])
    await processSegmentsWithChat([SEG(exact, 0)], options, chat)
    expect(calls).toHaveLength(1)
    expect(calls[0].user).toContain('1 independent')
  })

  it('系统性失败（FatalEngineError）必须冒泡，不能被降级成"成功"', async () => {
    const chat: ChatFn = vi.fn(async () => {
      throw new FatalEngineError('INVALID_KEY (401)', 'ENGINE_UNAVAILABLE')
    })
    await expect(
      processSegmentsWithChat([SEG('a', 0), SEG('b', 1)], options, chat),
    ).rejects.toThrow('INVALID_KEY')
  })

  it('长文本的系统性失败同样冒泡（不是只降级那一条）', async () => {
    const long = 'y'.repeat(SHORT_TEXT_THRESHOLD + 1)
    const chat: ChatFn = vi.fn(async () => {
      throw new FatalEngineError('NETWORK_ERROR', 'NETWORK_ERROR')
    })
    await expect(processSegmentsWithChat([SEG(long, 0)], options, chat)).rejects.toThrow(
      'NETWORK_ERROR',
    )
  })

  it('非系统性失败（如 5xx）保留降级行为 —— 不让一次抖动废掉整条字幕', async () => {
    const chat: ChatFn = vi.fn(async () => {
      throw new Error('HTTP 503')
    })
    const out = await processSegmentsWithChat([SEG('a', 0), SEG('b', 1)], options, chat)
    expect(out.map((r) => r.normalizedText)).toEqual(['a', 'b'])
  })

  it('内容级失败（非法 JSON）不算传输错误：不冒泡，其余照常', async () => {
    const long = 'y'.repeat(SHORT_TEXT_THRESHOLD + 1)
    let n = 0
    const chat: ChatFn = async () => {
      n++
      if (n === 1) return 'not json at all' // 内容级失败 → 不抛，就地降级
      return '{"normalizedText":"second ok"}'
    }
    // 关键断言是"不抛"（与传输错误区分开）。不锚定具体降级文案：
    // 单条路径沿用旧的宽容解析（取模型原文），批处理路径取原句文本，两者尚未统一，
    // 且 official 字幕链路不落库 normalizedText，因此这里只验证错误语义。
    const out = await processSegmentsWithChat([SEG(long, 0), SEG(long, 1)], options, chat)
    expect(out).toHaveLength(2)
    expect(out[1].normalizedText).toBe('second ok')
  })

  it('模型返回非法 JSON 时该批降级而非污染结果', async () => {
    const { chat } = makeChat(['not json at all'])
    const out = await processSegmentsWithChat([SEG('a', 0)], options, chat)
    expect(out[0].normalizedText).toBe('a')
  })

  it('批处理返回的 segments 数量不足时缺的按位置降级', async () => {
    const { chat } = makeChat(['{"segments":[{"normalizedText":"only one"}]}'])
    const out = await processSegmentsWithChat([SEG('a', 0), SEG('b', 1)], options, chat)
    expect(out[0].normalizedText).toBe('only one')
    expect(out[1].normalizedText).toBe('b')
  })

  it('乱序输入也按 segmentIndex 归位输出', async () => {
    const { chat } = makeChat(['{"segments":[{"normalizedText":"p0"},{"normalizedText":"p1"}]}'])
    const out = await processSegmentsWithChat([SEG('a', 5), SEG('b', 2)], options, chat)
    expect(out.map((r) => r.segmentIndex)).toEqual([5, 2])
  })

  it('请求带上系统提示与固定温度，并要求 JSON 模式', async () => {
    const { chat, calls } = makeChat(['{"segments":[{"normalizedText":"ok"}]}'])
    await processSegmentsWithChat([SEG('a', 0)], options, chat)
    expect(calls[0].jsonMode).toBe(true)
    expect(calls[0].temperature).toBe(POSTPROCESS_TEMPERATURE)
    expect(calls[0].system).toContain('Japanese')
  })

  it('空输入不产生任何请求', async () => {
    const chat = vi.fn<ChatFn>()
    const out = await processSegmentsWithChat([], options, chat)
    expect(chat).not.toHaveBeenCalled()
    expect(out).toEqual([])
  })
})

describe('indexResults', () => {
  it('缺失的 segmentIndex 用降级结果补齐', () => {
    const segs = [SEG('a', 0), SEG('b', 1)]
    const out = indexResults([{ ...fallbackResult(SEG('a', 0)), normalizedText: 'A' }], segs)
    expect(out[0].normalizedText).toBe('A')
    expect(out[1].normalizedText).toBe('b')
  })
})
