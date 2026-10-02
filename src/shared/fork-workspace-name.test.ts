import { describe, expect, it } from 'vitest'
import { slugifyForWorkspaceName } from './workspace-name'

describe('fork: workspace name seeds', () => {
  it('drop accents and sentence punctuation instead of splitting words', () => {
    expect(slugifyForWorkspaceName('Envío justificantes. 63580 id')).toBe(
      'envio-justificantes-63580-id'
    )
    expect(slugifyForWorkspaceName('Migración v1.2 añadida')).toBe('migracion-v1.2-anadida')
  })
})
