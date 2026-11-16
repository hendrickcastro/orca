import { describe, expect, it } from 'vitest'
import { defaultFoldMarker, sidebarGroupsToFoldByDefault } from './sidebar-default-collapse'

const rows = [
  { type: 'header', key: 'pinned' },
  { type: 'header', key: 'project-group:devops', projectGroup: { id: 'devops' } },
  { type: 'header', key: 'repo:api', repo: { id: 'api' } },
  { type: 'item', key: 'wt-1' },
  { type: 'header', key: 'repo:web', collapseKey: 'repo:web:host:ssh:a', repo: { id: 'web' } }
]

describe('sidebarGroupsToFoldByDefault', () => {
  it('folds project and repository headers that were never folded by default', () => {
    expect(sidebarGroupsToFoldByDefault(rows, new Set())).toEqual([
      'project-group:devops',
      'repo:api',
      'repo:web:host:ssh:a'
    ])
  })

  it('leaves alone a group the user already has an opinion about', () => {
    const seen = new Set([defaultFoldMarker('project-group:devops'), defaultFoldMarker('repo:api')])
    // Why: the user unfolded repo:api after its default fold; it must stay unfolded.
    expect(sidebarGroupsToFoldByDefault(rows, seen)).toEqual(['repo:web:host:ssh:a'])
  })

  it('folds a pinned task with members once, but no other folder row', () => {
    const folderRows = [
      { type: 'folder-workspace', sectionKey: 'pinned', lineageGroupKey: 'lineage:task' },
      { type: 'folder-workspace', sectionKey: 'repo:api', lineageGroupKey: 'lineage:lane' },
      { type: 'folder-workspace', sectionKey: 'pinned' }
    ]
    expect(sidebarGroupsToFoldByDefault(folderRows, new Set())).toEqual(['lineage:task'])
    expect(
      sidebarGroupsToFoldByDefault(folderRows, new Set([defaultFoldMarker('lineage:task')]))
    ).toEqual([])
  })

  it('never folds section lanes such as Pinned', () => {
    expect(sidebarGroupsToFoldByDefault([{ type: 'header', key: 'pinned' }], new Set())).toEqual([])
  })
})
