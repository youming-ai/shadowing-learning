/** * URL管理器 - 自动跟踪和清理Object URLs (函数式模块)*/

import { handleSilently } from '../utils/error-handler'

// 向后兼容：keep URLManager class别名
// biome-ignore lint/complexity/noStaticOnlyClass: Backward compatibility for existing code
class URLManager {
  static createObjectUrl(blob: Blob): string {
    return createObjectUrl(blob)
  }

  // 兼容旧method名
  static createObjectURL(blob: Blob): string {
    return createObjectUrl(blob)
  }

  static revokeObjectUrl(url: string): void {
    revokeObjectUrl(url)
  }

  static revokeObjectURL(url: string): void {
    revokeObjectUrl(url)
  }

  static createTemporaryUrl(blob: Blob, autoRevokeAfter?: number): string {
    return createTemporaryUrl(blob, autoRevokeAfter)
  }

  static createTemporaryURL(blob: Blob, autoRevokeAfter?: number): string {
    return createTemporaryUrl(blob, autoRevokeAfter)
  }

  static getActiveUrlCount(): number {
    return getActiveUrlCount()
  }

  static revokeAllUrls(): void {
    revokeAllUrls()
  }

  static revokeAllURLs(): void {
    revokeAllUrls()
  }
}

// 活跃URLs跟踪
const activeUrls = new Set<string>()

/** * 创建Object URL并自动跟踪*/
export function createObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  activeUrls.add(url)
  return url
}

/** * 撤销Object URL并从跟踪inRemoved*/
export function revokeObjectUrl(url: string): void {
  if (activeUrls.has(url)) {
    URL.revokeObjectURL(url)
    activeUrls.delete(url)
  }
}

/** * Get当前活跃URL数量*/
export function getActiveUrlCount(): number {
  return activeUrls.size
}

/** * 清理所有活跃URLs*/
export function revokeAllUrls(): void {
  for (const url of activeUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch (error) {
      handleSilently(error, 'url-revoke')
    }
  }
  activeUrls.clear()
}

/** * 创建临时URL（自动清理）*/
export function createTemporaryUrl(
  blob: Blob,
  autoRevokeAfter: number = 5 * 60 * 1000, // 默认5minutes
): string {
  const url = createObjectUrl(blob)

  if (autoRevokeAfter > 0) {
    setTimeout(() => {
      revokeObjectUrl(url)
    }, autoRevokeAfter)
  } else if (autoRevokeAfter === 0) {
    // 使用 setTimeout(..., 0) 而不i立即撤销，以匹配测试期望
    setTimeout(() => {
      revokeObjectUrl(url)
    }, 0)
  }

  return url
}

// a了向后兼容，keep别名（已修正命名约定）
export function createObjectUrlLegacy(blob: Blob): string {
  return createObjectUrl(blob)
}

export function revokeObjectUrlLegacy(url: string): void {
  revokeObjectUrl(url)
}

export function createTemporaryUrlLegacy(blob: Blob, autoRevokeAfter?: number): string {
  return createTemporaryUrl(blob, autoRevokeAfter)
}

// 导出 URLManager class以保持向后兼容
export { URLManager }
