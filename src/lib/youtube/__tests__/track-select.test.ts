import { describe, expect, it } from 'vitest'
import { type CaptionTrackMeta, selectCaptionTrack } from '~/lib/youtube/track-select'

const t = (language: string, kind: 'manual' | 'asr', displayName: string): CaptionTrackMeta => ({
  language, kind, displayName,
})

describe('selectCaptionTrack — 5 级优先', () => {
  const tracks = [
    t('ja', 'asr', 'Japanese (auto-generated)'),
    t('en', 'manual', 'English'),
    t('en', 'asr', 'English (auto-generated)'),
    t('ko', 'manual', 'Korean'),
  ]

  it('1. preferredLanguage 的手动字幕最优', () => {
    expect(selectCaptionTrack(tracks, { preferredLanguage: 'en' })?.displayName).toBe('English')
  })
  it('2. 无手动时取 preferredLanguage 的 ASR', () => {
    expect(selectCaptionTrack(tracks, { preferredLanguage: 'ja' })?.displayName).toBe(
      'Japanese (auto-generated)',
    )
  })
  it('3. 无 preferred 命中时取原声语言的手动字幕', () => {
    expect(
      selectCaptionTrack(tracks, { preferredLanguage: 'fr', originalLanguage: 'ko' })?.displayName,
    ).toBe('Korean')
  })
  it('4. 再退到任意手动字幕', () => {
    const only = [t('de', 'manual', 'German'), t('ja', 'asr', 'Japanese (auto-generated)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'fr' })?.displayName).toBe('German')
  })
  it('5. 最后任意 ASR', () => {
    const only = [t('ja', 'asr', 'Japanese (auto-generated)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'fr' })?.displayName).toBe(
      'Japanese (auto-generated)',
    )
  })
  it('语言比较忽略地区后缀（zh-CN 匹配 zh）', () => {
    const only = [t('zh-Hans', 'manual', 'Chinese (Simplified)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'zh-CN' })?.displayName).toBe(
      'Chinese (Simplified)',
    )
  })
  it('空轨道返回 null', () => {
    expect(selectCaptionTrack([], {})).toBeNull()
  })
})
