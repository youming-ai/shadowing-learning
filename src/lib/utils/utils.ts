import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind 类名：clsx 处理条件，twMerge 消解冲突（后者胜出）。*/
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * 单调时钟（毫秒），用于测量时长。
 *
 * 刻意不用 `Date.now()`：系统时间被调整或 NTP 校时时它会跳变，把时长算成负数或几百秒。
 * `performance.now()` 单调递增，正是量间隔该用的工具。
 */
export function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
