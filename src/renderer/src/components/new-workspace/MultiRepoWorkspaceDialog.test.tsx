// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { fixture, repo } from '@/lib/multi-repo-workspace-test-fixtures'
import {
  encodeWorkspaceFilePaths,
  WORKSPACE_FILE_DRAG_SOURCE_MIME,
  WORKSPACE_FILE_PATHS_MIME,
  WORKSPACE_FILE_PATH_MIME
} from '@/lib/workspace-file-drag'

const mocks = vi.hoisted(() => {
  const repos: Repo[] = []
  return { launch: vi.fn(async () => {}), repos }
})
vi.mock('@/lib/multi-repo-coordinator-launch', () => ({ launchMultiRepoCoordinator: mocks.launch }))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (select: (state: { repos: Repo[] }) => unknown) => select({ repos: mocks.repos }),
    { getState: () => ({ settings: null }) }
  )
}))

import MultiRepoWorkspaceDialog from './MultiRepoWorkspaceDialog'

function catalogFixture() {
  return {
    ...fixture(),
    skills: {
      discover: vi.fn(async () => ({
        skills: [
          {
            id: 'tdd',
            name: 'tdd',
            description: 'Test first',
            providers: ['claude'],
            sourceKind: 'home',
            sourceLabel: 'Claude',
            rootPath: 'C:/Users/me/.claude/skills',
            directoryPath: 'C:/Users/me/.claude/skills/tdd',
            skillFilePath: 'C:/Users/me/.claude/skills/tdd/SKILL.md',
            installed: true,
            updatedAt: null
          }
        ],
        sources: [],
        scannedAt: 0
      }))
    },
    fs: {
      listMarkdownDocuments: vi.fn(async ({ rootPath }: { rootPath: string }) =>
        rootPath === 'E:\\Back'
          ? [
              {
                filePath: 'E:\\Back\\docs\\api.md',
                relativePath: 'docs/api.md',
                basename: 'api.md',
                name: 'api'
              }
            ]
          : []
      ),
      listFiles: vi.fn(async () => ['src/index.ts']),
      readDir: vi.fn(async () => []),
      readFile: vi.fn(async () => ({ content: '', isBinary: false }))
    },
    claudeMcp: {
      listClaudeUserServers: vi.fn(async () => ({
        user: [{ name: 'cosmosdb', transport: 'stdio', status: 'enabled' }],
        projects: {}
      }))
    }
  }
}

let root: Root
let api: ReturnType<typeof catalogFixture>
const close = vi.fn()

beforeEach(() => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.repos = [repo('front', 'D:\\Front'), repo('back', 'E:\\Back')]
  mocks.launch.mockClear()
  close.mockClear()
  api = catalogFixture()
  Object.defineProperty(window, 'api', { value: api, configurable: true })
})
afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

function button(label: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll('button')).find((entry) =>
    entry.textContent?.includes(label)
  )
  if (!found) {
    throw new Error(`Missing button: ${label}`)
  }
  return found
}

function fill(id: string, value: string): void {
  const input = document.getElementById(id)
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing input: ${id}`)
  }
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function dropOnPrompt(paths: string[], executionHostId: string): void {
  const data: Record<string, string> = {
    [WORKSPACE_FILE_PATH_MIME]: paths[0],
    [WORKSPACE_FILE_PATHS_MIME]: encodeWorkspaceFilePaths(paths),
    [WORKSPACE_FILE_DRAG_SOURCE_MIME]: JSON.stringify({
      executionHostId,
      workspaceId: 'workspace-1',
      version: 1
    })
  }
  const dataTransfer = {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
    dropEffect: 'none',
    effectAllowed: 'copyMove'
  }
  const target = document.getElementById('multi-repo-prompt')!
  act(() => {
    for (const type of ['dragover', 'drop']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      target.dispatchEvent(event)
    }
  })
}

function renderFilled(): void {
  act(() => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
  fill('multi-repo-name', 'Search')
  fill('multi-repo-branch', 'feature/search')
  fill('multi-repo-prompt', 'Implement UI and API')
}

describe('multi-repository task dialog', () => {
  it('requires a task name, branch, prompt and two eligible repositories', () => {
    act(() => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
    expect(button('Create and start Claude').disabled).toBe(true)
    fill('multi-repo-name', 'Search')
    fill('multi-repo-branch', 'feature/search')
    expect(button('Create and start Claude').disabled).toBe(true)
    fill('multi-repo-prompt', 'Implement UI and API')
    expect(button('Create and start Claude').disabled).toBe(false)
  })

  it('does not count a remote repository toward the minimum selection', () => {
    mocks.repos[1] = { ...mocks.repos[1], connectionId: 'server' }
    renderFilled()
    expect(button('Create and start Claude').disabled).toBe(true)
  })

  it('starts the coordinator only after every worktree succeeds', async () => {
    renderFilled()
    await act(async () => button('Create and start Claude').click())
    expect(api.worktrees.create).toHaveBeenCalledTimes(2)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('shows a creation failure and retries without launching early or duplicating work', async () => {
    api.worktrees.create.mockRejectedValueOnce(new Error('Git unavailable'))
    renderFilled()
    await act(async () => button('Create and start Claude').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Git unavailable')
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    await act(async () => button('Retry remaining steps').click())
    expect(api.projectGroups.create).toHaveBeenCalledTimes(1)
    expect(api.worktrees.create).toHaveBeenCalledTimes(3)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
  })

  it('suggests a branch from the task type and name until the user edits it', () => {
    act(() => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
    fill('multi-repo-name', 'Login timeout')
    const branch = document.getElementById('multi-repo-branch')
    expect(branch instanceof HTMLInputElement && branch.value).toBe('feature/login-timeout')
    act(() => button('Bug fix').click())
    expect(branch instanceof HTMLInputElement && branch.value).toBe('fix/login-timeout')
    fill('multi-repo-branch', 'hotfix/custom')
    fill('multi-repo-name', 'Other')
    expect(branch instanceof HTMLInputElement && branch.value).toBe('hotfix/custom')
  })

  it('starts from a task handed over by the composer and sends its details to Claude', async () => {
    const linkedWorkItem = {
      provider: 'asana' as const,
      type: 'issue' as const,
      number: 0,
      title: 'Envío justificantes',
      url: 'https://app.asana.com/0/9/42',
      linkedContext: {
        provider: 'asana' as const,
        version: 1 as const,
        renderedText: 'Asana task: Envío justificantes\n\nDescription:\nRevisar la cola.'
      }
    }
    await act(async () =>
      root.render(<MultiRepoWorkspaceDialog onClose={close} initial={{ linkedWorkItem }} />)
    )
    const name = document.getElementById('multi-repo-name')
    const branch = document.getElementById('multi-repo-branch')
    expect(name instanceof HTMLInputElement && name.value).toBe('Envío justificantes')
    expect(branch instanceof HTMLInputElement && branch.value).toBe('feature/envio-justificantes')
    expect(document.body.textContent).toContain('Details included')
    expect(button('Create and start Claude').disabled).toBe(false)

    await act(async () => button('Create and start Claude').click())

    const comment = api.folderWorkspaces.update.mock.calls.at(-1)?.[0].updates.comment
    expect(comment).toContain('https://app.asana.com/0/9/42')
    expect(comment).toContain('Revisar la cola.')
    expect(mocks.launch).toHaveBeenCalledTimes(1)
  })

  it('adds the path of a local file dragged from the explorer to the prompt', () => {
    renderFilled()
    dropOnPrompt(['D:\\Front\\src\\app.ts', 'E:\\Back\\docs'], 'local')
    const prompt = document.getElementById('multi-repo-prompt')
    expect(prompt instanceof HTMLTextAreaElement && prompt.value).toBe(
      'Implement UI and API D:\\Front\\src\\app.ts E:\\Back\\docs'
    )
  })

  it('refuses a path dragged from a remote workspace', () => {
    renderFilled()
    dropOnPrompt(['/home/me/app.ts'], 'ssh:server')
    const prompt = document.getElementById('multi-repo-prompt')
    expect(prompt instanceof HTMLTextAreaElement && prompt.value).toBe('Implement UI and API')
    expect(document.body.textContent).toContain('Only files and folders on this computer')
  })

  it('lists skills, MCP servers and docs on @ and resolves the picked one for Claude', async () => {
    await act(async () => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
    fill('multi-repo-name', 'Search')
    fill('multi-repo-prompt', 'Follow @')
    const options = Array.from(document.body.querySelectorAll('[role="option"]'))
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('tdd'),
      expect.stringContaining('cosmosdb'),
      expect.stringContaining('docs/api.md')
    ])
    expect(options[1].textContent).toContain('Global')
    expect(options[2].textContent).toContain('back')
    act(() => {
      options[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    const prompt = document.getElementById('multi-repo-prompt')
    expect(prompt instanceof HTMLTextAreaElement && prompt.value).toBe('Follow @back/docs/api.md')
    await act(async () => button('Create and start Claude').click())
    const comment = api.folderWorkspaces.update.mock.calls.at(-1)?.[0].updates.comment
    expect(comment).toContain('@back/docs/api.md: document in repository "back" at /worktrees/back')
  })
})
