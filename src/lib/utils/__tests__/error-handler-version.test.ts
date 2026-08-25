import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { getFriendlyErrorMessage } from '~/lib/utils/error-handler'

describe('Dexie version errors', () => {
  it('maps VersionError to a refresh prompt', () => {
    const err = new Dexie.VersionError('stale schema')
    expect(getFriendlyErrorMessage(err)).toContain('刷新')
  })
  it('maps DatabaseClosedError to a refresh prompt', () => {
    const err = new Dexie.DatabaseClosedError('closed')
    expect(getFriendlyErrorMessage(err)).toContain('刷新')
  })
})
