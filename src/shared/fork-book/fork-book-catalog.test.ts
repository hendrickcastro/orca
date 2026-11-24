import { describe, expect, it } from 'vitest'
import { deleteBookFolder, moveBookFolder } from './book-catalog-operations'
import { normalizeBookCatalog } from './book-catalog-normalization'
import { parseBookEntryAnswer } from './book-entry-text'
import type { BookCatalog } from './book-catalog-types'

const catalog: BookCatalog = {
  version: 1,
  folders: [
    { id: 'clients', name: 'Clients', parentId: null, createdAt: 1 },
    { id: 'refunds', name: 'Refunds', parentId: 'clients', createdAt: 2 },
    { id: 'bugs', name: 'Bugs', parentId: 'refunds', createdAt: 3 }
  ],
  entries: [
    {
      id: 'e1',
      folderId: 'refunds',
      title: 'Refund retries',
      description: '',
      workspaceId: 'repo::C:/work/refunds',
      workspaceName: 'refunds',
      createdAt: 1,
      updatedAt: 1
    }
  ]
}

describe('fork: Book catalog', () => {
  it('keeps a deleted folder’s entries and sub-folders by moving them to its parent', () => {
    const next = deleteBookFolder(catalog, 'refunds')
    expect(next.entries[0].folderId).toBe('clients')
    expect(next.folders.find((folder) => folder.id === 'bugs')?.parentId).toBe('clients')
  })

  it('refuses to move a folder inside its own sub-folder', () => {
    expect(moveBookFolder(catalog, 'clients', 'bugs')).toBe(catalog)
  })

  it('re-roots entries and folders whose parent is missing when read from disk', () => {
    const read = normalizeBookCatalog({
      folders: [{ id: 'a', name: 'A', parentId: 'gone' }],
      entries: [{ id: 'x', title: 'X', workspaceId: 'w', folderId: 'gone' }, { title: 'bad' }]
    })
    expect(read.folders[0].parentId).toBeNull()
    expect(read.entries).toHaveLength(1)
    expect(read.entries[0].folderId).toBeNull()
  })

  it('reads the agent answer even when it is wrapped in markdown', () => {
    expect(
      parseBookEntryAnswer(
        '```\n**TITLE:** "Fix duplicate refund emails"\nDESCRIPTION: Stops the retry job.\n```'
      )
    ).toEqual({ title: 'Fix duplicate refund emails', description: 'Stops the retry job.' })
  })
})
