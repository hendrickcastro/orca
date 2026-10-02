import { vi } from 'vitest'

// Why: upstream's tests assert upstream's identity (stablyai/orca feeds, ~/.orca, Orca.exe…).
// Mocking the identity module keeps those tests byte-identical to upstream, so syncs never
// conflict on them. Fork tests that need the real values call vi.unmock on this module.
vi.mock('../../src/shared/product-identity', () => import('./upstream-product-identity'))
