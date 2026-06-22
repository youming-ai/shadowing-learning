/** * 应用路由常量定义 * 统一管理所有路由path，避免硬编码*/

export const ROUTES = {
  /** 首页 - Online discover library */
  HOME: '/',
  /** Online discover library (alias for HOME) */
  ONLINE: '/',
  /** My audio library */
  MY_AUDIO: '/me',
  /** Set页面*/
  SETTINGS: '/settings',
  /** 账户页面*/
  ACCOUNT: '/account',
} as const

export type RouteKey = keyof typeof ROUTES

/** * 生成路由path * @param key 路由键 * @param params path参数*/
export function generatePath(key: RouteKey, params?: Record<string, string>): string {
  const path = ROUTES[key]

  if (!params) {
    return path
  }

  return path
}
