import { describe, expect, it } from 'vitest'
import {
  embedBookContextManifest,
  readBookContextManifest,
  relativizeBookPaths,
  restoreBookPaths,
  stripBookContextManifest,
  type BookContextManifest
} from './book-context-transfer'

describe('fork: Book context transfer between computers', () => {
  it('rewrites a Windows checkout in every spelling a transcript uses', () => {
    const text = [
      'Edited E:\\ORCA\\orca\\feature\\src\\main.ts',
      '{"file_path":"E:\\\\ORCA\\\\orca\\\\feature\\\\src\\\\main.ts"}',
      'cd e:/ORCA/orca/feature/src',
      'Config in C:\\Users\\dev\\.claude\\settings.json'
    ].join('\n')
    expect(relativizeBookPaths(text, ['E:\\ORCA\\orca\\feature'], 'C:\\Users\\dev')).toBe(
      [
        'Edited <REPO_ROOT>\\src\\main.ts',
        '{"file_path":"<REPO_ROOT>\\\\src\\\\main.ts"}',
        'cd <REPO_ROOT>/src',
        'Config in <HOME>\\.claude\\settings.json'
      ].join('\n')
    )
  })

  it('restores the placeholder on a Mac with forward slashes', () => {
    expect(
      restoreBookPaths('Edited <REPO_ROOT>\\src\\main.ts and <REPO_ROOT>', '/Users/dev/orca', '/')
    ).toBe('Edited /Users/dev/orca/src/main.ts and /Users/dev/orca')
  })

  it('round-trips the manifest and strips it from the summary text', () => {
    const manifest: BookContextManifest = {
      format: 'orca-book-context',
      version: 1,
      title: 'Refund retries',
      description: 'Stops duplicate emails',
      branch: 'fix/refund-retries',
      headCommit: 'abc123',
      exportedAt: '2026-11-17T10:00:00.000Z',
      sourcePlatform: 'win32',
      repo: { projectId: 'github:acme/payments', remoteUrl: 'git@github.com:acme/payments.git' },
      conversationFile: 'refund-retries.conversation.md'
    }
    const file = embedBookContextManifest('# Goal\n\nShip it.', manifest)
    expect(readBookContextManifest(file)).toMatchObject({
      title: 'Refund retries',
      branch: 'fix/refund-retries',
      repo: { projectId: 'github:acme/payments' },
      conversationFile: 'refund-retries.conversation.md'
    })
    expect(stripBookContextManifest(file)).toBe('# Goal\n\nShip it.')
    expect(readBookContextManifest('# Just notes')).toBeNull()
  })
})
