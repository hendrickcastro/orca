import { describe, expect, it } from 'vitest'
import { mayShutDownDaemonForDevParent } from './fork-dev-shared-profile'

describe('mayShutDownDaemonForDevParent', () => {
  it('keeps the daemon when the dev build shares the installed profile', () => {
    expect(mayShutDownDaemonForDevParent({ ORCA_DEV_SHARED_PROFILE: '1' })).toBe(false)
  })

  it('still shuts a dev-only profile daemon down when its dev parent dies', () => {
    expect(mayShutDownDaemonForDevParent({})).toBe(true)
  })
})
