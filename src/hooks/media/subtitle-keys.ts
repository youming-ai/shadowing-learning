/**
 * subtitle 查询键工厂。
 * 独立成模块：useSubtitlePipeline（watch 页）与 useTranscription（音频转写链路）
 * 都需要失效它，直接互相导入会形成
 * useSubtitlePipeline → useFileStatus → useTranscription → useSubtitlePipeline 的循环。
 */
export const subtitleKeys = {
  all: ['subtitle'] as const,
  forMedia: (mediaId: number) => [...subtitleKeys.all, 'media', mediaId] as const,
}
