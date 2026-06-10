/**
 * 进程级全局防线（与 IP 无关）：
 * - 信号量：限制 yt-dlp+Whisper 这类重任务的并发，防容器被打满
 * - 每日配额：防多 IP 费用攻击（per-IP 限流挡不住的部分）
 * 单容器部署假设下进程内实现即可；多副本时需移到共享存储。
 */

export interface Semaphore {
  /** 返回 release 函数；占满时返回 null */
  tryAcquire(): (() => void) | null
}

export function createSemaphore(max: number): Semaphore {
  let inFlight = 0
  return {
    tryAcquire() {
      if (inFlight >= max) return null
      inFlight++
      let released = false
      return () => {
        if (!released) {
          released = true
          inFlight--
        }
      }
    },
  }
}

export interface DailyQuota {
  tryConsume(): boolean
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createDailyQuota(maxPerDay: number, dayFn: () => string = todayUtc): DailyQuota {
  let day = dayFn()
  let used = 0
  return {
    tryConsume() {
      const now = dayFn()
      if (now !== day) {
        day = now
        used = 0
      }
      if (used >= maxPerDay) return false
      used++
      return true
    },
  }
}
