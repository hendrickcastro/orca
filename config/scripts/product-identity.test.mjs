import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import * as productIdentity from '../../src/shared/product-identity'

const require = createRequire(import.meta.url)

describe('product identity', () => {
  it('matches the electron-builder mirror', () => {
    expect(require('../product-identity.cjs')).toEqual({ ...productIdentity })
  })
})
