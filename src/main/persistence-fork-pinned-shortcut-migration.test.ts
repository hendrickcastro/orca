import { closeTestStores, testState, createStore, writeDataFile } from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  },
  safeStorage: {
    isEncryptionAvailable: () => false
  }
}))

vi.mock('./telemetry/client', () => ({
  track: vi.fn()
}))

vi.mock('./telemetry/cohort-classifier', () => ({
  getCohortAtEmit: () => ({ nth_repo_added: 2 })
}))

function writeSettings(settings: Record<string, unknown>): void {
  writeDataFile({
    schemaVersion: 1,
    repos: [],
    worktreeMeta: {},
    settings,
    ui: {},
    githubCache: { pr: {}, issue: {} },
    workspaceSession: {}
  })
}

describe('fork pinned-shortcut default', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('flips the stored upstream default once so pinning keeps the workspace in its project', async () => {
    writeSettings({ showPinnedWorktreesInGroups: false })
    const store = await createStore()
    expect(store.getSettings().showPinnedWorktreesInGroups).toBe(true)
    expect(store.getSettings().showPinnedWorktreesInGroupsDefaultedOnForFork).toBe(true)
  })

  it('keeps an opt-out made after the migration', async () => {
    writeSettings({
      showPinnedWorktreesInGroups: false,
      showPinnedWorktreesInGroupsDefaultedOnForFork: true
    })
    const store = await createStore()
    expect(store.getSettings().showPinnedWorktreesInGroups).toBe(false)
  })
})
