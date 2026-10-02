import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import * as productIdentity from '../../src/shared/product-identity'

// Why: the shared test setup swaps in upstream's identity; this test checks the fork's own.
vi.unmock('../../src/shared/product-identity')

const require = createRequire(import.meta.url)

describe('product identity', () => {
  it('matches the electron-builder mirror', () => {
    expect(require('../product-identity.cjs')).toEqual({ ...productIdentity })
  })
})
