import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }))
vi.mock('./asana-token-store', () => ({
  hasAsanaToken: () => true,
  readAsanaToken: () => 'token',
  saveAsanaToken: vi.fn(),
  clearAsanaToken: vi.fn()
}))

import { formatAsanaTaskContext } from '../../shared/asana-task-context'
import { mapAsanaTaskDetail } from './asana-task-detail'

describe('Asana task detail', () => {
  it('keeps comments only, and renders everything the agent needs', () => {
    const detail = mapAsanaTaskDetail(
      '42',
      {
        name: 'Envío justificantes',
        notes: 'Los justificantes no llegan.\nRevisar cola.',
        completed: false,
        due_on: '2026-09-28',
        permalink_url: 'https://app.asana.com/0/9/42',
        assignee: { name: 'Hendrick' },
        projects: [{ name: 'Soporte' }],
        tags: [{ name: 'urgente' }],
        custom_fields: [
          { name: 'Prioridad', display_value: 'Alta' },
          { name: 'Vacío', display_value: null }
        ]
      },
      [{ name: 'Reproducir', completed: true }, { name: 'Corregir' }],
      [
        { type: 'system', text: 'Hendrick assigned to you' },
        {
          type: 'comment',
          text: 'Pasa con el ID 63580',
          created_by: { name: 'Ana' },
          created_at: '2026-09-27T10:00:00Z'
        }
      ],
      [
        {
          name: 'captura.png',
          permanent_url: 'https://app.asana.com/app/asana/-/get_asset?asset_id=1'
        }
      ]
    )

    expect(detail.comments).toEqual([
      { author: 'Ana', createdAt: '2026-09-27T10:00:00Z', text: 'Pasa con el ID 63580' }
    ])
    expect(detail.customFields).toEqual([{ name: 'Prioridad', value: 'Alta' }])

    const text = formatAsanaTaskContext(detail)
    expect(text).toContain('Asana task: Envío justificantes')
    expect(text).toContain('URL: https://app.asana.com/0/9/42')
    expect(text).toContain('Status: open')
    expect(text).toContain('Prioridad: Alta')
    expect(text).toContain('Description:\nLos justificantes no llegan.\nRevisar cola.')
    expect(text).toContain('- [x] Reproducir\n- [ ] Corregir')
    expect(text).toContain('- captura.png (https://app.asana.com/app/asana/-/get_asset?asset_id=1)')
    expect(text).toContain('- Ana on 2026-09-27: Pasa con el ID 63580')
  })
})
