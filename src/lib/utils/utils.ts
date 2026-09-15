import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind 类名：clsx 处理条件，twMerge 消解冲突（后者胜出）。*/
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
