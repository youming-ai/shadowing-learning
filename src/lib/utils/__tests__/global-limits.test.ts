import { describe, expect, it } from 'vitest'
import { createDailyQuota, createSemaphore } from '~/lib/utils/global-limits'

describe('createSemaphore', () => {
  it('rejects acquisition beyond max and releases correctly', () => {
    const sem = createSemaphore(1)
    const release = sem.tryAcquire()
    expect(release).not.toBeNull()
    expect(sem.tryAcquire()).toBeNull()
    release?.()
    expect(sem.tryAcquire()).not.toBeNull()
  })
})

describe('createDailyQuota', () => {
  it('consumes up to max per UTC day then rejects', () => {
    const quota = createDailyQuota(2, () => '2026-06-10')
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(false)
  })

  it('resets when the UTC day changes', () => {
    let day = '2026-06-10'
    const quota = createDailyQuota(1, () => day)
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(false)
    day = '2026-06-11'
    expect(quota.tryConsume()).toBe(true)
  })
})
