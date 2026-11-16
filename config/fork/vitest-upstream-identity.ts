import { vi } from 'vitest'

// Why: upstream's tests assert upstream's identity (stablyai/orca feeds, ~/.orca, Orca.exe…).
// Mocking the identity module keeps those tests byte-identical to upstream, so syncs never
// conflict on them. Fork tests that need the real values call vi.unmock on this module.
vi.mock('../../src/shared/product-identity', () => import('./upstream-product-identity'))

// Why: CJS build config can't see vi.mock; config/fork/electron-builder-fork-identity.cjs reads this.
// Fork tests that need the fork's build config delete it first.
process.env.ORCA_FORK_UPSTREAM_IDENTITY = '1'
