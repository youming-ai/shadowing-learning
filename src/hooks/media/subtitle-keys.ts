/**
 * subtitle 查询键工厂。独立成模块，避免 useSubtitlePipeline 与
 * 其他模块互相导入形成 useSubtitlePipeline → useSubtitlePipeline 的自环。
 */
export const subtitleKeys = {
  all: ['subtitle'] as const,
  forMedia: (mediaId: number) => [...subtitleKeys.all, 'media', mediaId] as const,
}
