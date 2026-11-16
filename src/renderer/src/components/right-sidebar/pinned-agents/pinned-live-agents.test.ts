import { describe, expect, it } from 'vitest'
import { flattenPinnedWorkspaces, isPinnedLiveAgentRow } from './pinned-live-agents'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

function entry(id: string, members: PinnedWorkspaceEntry[] = []): PinnedWorkspaceEntry {
  return {
    id,
    kind: 'worktree',
    name: id,
    projectName: 'p',
    path: `/tmp/${id}`,
    hostId: null,
    members
  }
}

describe('isPinnedLiveAgentRow', () => {
  it('keeps working, waiting and just-finished agents', () => {
    expect(isPinnedLiveAgentRow({ rowSource: 'live', state: 'working' })).toBe(true)
    expect(isPinnedLiveAgentRow({ rowSource: 'live', state: 'done' })).toBe(true)
    expect(isPinnedLiveAgentRow({ rowSource: undefined, state: 'unverifiable' })).toBe(true)
  })

  it('drops silent agents and subagents', () => {
    expect(isPinnedLiveAgentRow({ rowSource: 'live', state: 'idle' })).toBe(false)
    expect(isPinnedLiveAgentRow({ rowSource: 'subagent', state: 'working' })).toBe(false)
  })
})

describe('flattenPinnedWorkspaces', () => {
  it('lists each task before its repos and every workspace once', () => {
    const repo = entry('wt-repo')
    const task = { ...entry('folder:task', [repo]), kind: 'folder' as const }
    const items = flattenPinnedWorkspaces([task, repo, entry('wt-other')])
    expect(items.map((item) => [item.entry.id, item.parent?.id ?? null])).toEqual([
      ['folder:task', null],
      ['wt-repo', 'folder:task'],
      ['wt-other', null]
    ])
  })
})
