import type { AppState } from '@/store/types'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments/workspace-attachments'
import { parseWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { getFolderWorkspaceWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { Worktree, WorkspaceAttachment } from '../../../../shared/worktree/types'
import {
  bookRepoRefFor,
  listBookConversationCandidates,
  type BookConversationCandidate
} from './book-conversations'
import type {
  BookEntry,
  BookEntryContext,
  BookLinkedTask
} from '../../../../shared/fork-book/book-catalog-types'

type SnapshotState = Pick<
  AppState,
  | 'worktreesByRepo'
  | 'folderWorkspaces'
  | 'repos'
  | 'projectGroups'
  | 'workspaceLineageByChildKey'
  | 'unifiedTabsByWorktree'
  | 'agentStatusByPaneKey'
>

const PROVIDER_NAMES: Record<WorkspaceAttachment['provider'], string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  linear: 'Linear',
  jira: 'Jira',
  bitbucket: 'Bitbucket',
  'azure-devops': 'Azure DevOps',
  gitea: 'Gitea',
  asana: 'Asana'
}

/** Live worktree by id, also matching ids a renamed folder used to have. */
export function findBookWorktree(
  state: Pick<AppState, 'worktreesByRepo' | 'folderWorkspaces'>,
  workspaceId: string
): Worktree | null {
  const scope = parseWorkspaceKey(workspaceId)
  if (scope?.type === 'folder') {
    const folder = state.folderWorkspaces.find((item) => item.id === scope.folderWorkspaceId)
    return folder ? getFolderWorkspaceWorktree(folder) : null
  }
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    const match = worktrees.find(
      (worktree) => worktree.id === workspaceId || worktree.priorWorktreeIds?.includes(workspaceId)
    )
    if (match) {
      return match
    }
  }
  return null
}

function linkedTaskOf(worktree: Worktree): BookLinkedTask | undefined {
  const attachments = getWorkspaceAttachments(worktree)
  const item = attachments.find((candidate) => candidate.type === 'issue') ?? attachments[0]
  if (!item) {
    return undefined
  }
  const reference =
    item.jiraIdentifier ??
    item.linearIdentifier ??
    item.identifier ??
    (item.number > 0 ? `#${item.number}` : '')
  return {
    provider: item.provider,
    label: [PROVIDER_NAMES[item.provider], reference].filter(Boolean).join(' '),
    title: item.title,
    url: item.url
  }
}

function repoNameOf(state: SnapshotState, worktree: Worktree): string | undefined {
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  if (repo) {
    return repo.displayName
  }
  const scope = parseWorkspaceKey(worktree.id)
  if (scope?.type !== 'folder') {
    return undefined
  }
  const folder = state.folderWorkspaces.find((item) => item.id === scope.folderWorkspaceId)
  return state.projectGroups.find((group) => group.id === folder?.projectGroupId)?.name
}

// Shell and bare agent names say nothing about the work, so only titled tabs are kept.
const GENERIC_TAB_LABEL =
  /^(terminal|powershell|pwsh|cmd|bash|zsh|sh|fish|wsl|claude|codex|gemini|opencode|cursor|copilot|grok|kimi|pi|omp|droid|amp|antigravity)(\s+(chat|code|agent))?(\s*\d+)?$/i

function agentTitlesOf(state: SnapshotState, worktreeIds: string[]): string[] {
  const titles = new Set<string>()
  for (const worktreeId of worktreeIds) {
    for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) {
      if (tab.contentType !== 'agent-session' && tab.contentType !== 'terminal') {
        continue
      }
      const title = (tab.customLabel ?? tab.generatedLabel ?? tab.label ?? '').trim()
      if (title && !GENERIC_TAB_LABEL.test(title)) {
        titles.add(title)
      }
    }
  }
  return [...titles].slice(0, 20)
}

function memberWorktreesOf(state: SnapshotState, workspaceId: string): Worktree[] {
  if (parseWorkspaceKey(workspaceId)?.type !== 'folder') {
    return []
  }
  const members: Worktree[] = []
  for (const lineage of Object.values(state.workspaceLineageByChildKey)) {
    if (lineage.parentWorkspaceKey !== workspaceId) {
      continue
    }
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    const worktree = child?.type === 'worktree' ? findBookWorktree(state, child.worktreeId) : null
    if (worktree) {
      members.push(worktree)
    }
  }
  return members
}

export type BookWorkspaceSnapshot = {
  context: BookEntryContext
  fields: Pick<
    BookEntry,
    'workspaceId' | 'workspaceName' | 'repoName' | 'branch' | 'path' | 'linkedTask' | 'repo'
  >
  /** Conversations open in the workspace, newest first; the editor offers them as a choice. */
  conversations: BookConversationCandidate[]
}

/** Everything Book freezes about a workspace when it is saved, plus the facts used to draft text. */
export function snapshotBookWorkspace(
  state: SnapshotState,
  worktree: Worktree
): BookWorkspaceSnapshot {
  const members = memberWorktreesOf(state, worktree.id)
  const linkedTask = linkedTaskOf(worktree)
  const repoName = repoNameOf(state, worktree)
  const isFolder = parseWorkspaceKey(worktree.id)?.type === 'folder'
  const branch = isFolder ? undefined : worktree.branch?.replace(/^refs\/heads\//, '') || undefined
  const path = worktree.path || undefined
  const memberIds = members.map((member) => member.id)
  return {
    conversations: listBookConversationCandidates(state, [worktree.id, ...memberIds]),
    fields: {
      workspaceId: worktree.id,
      workspaceName: worktree.displayName,
      repoName,
      branch,
      path,
      linkedTask,
      repo: bookRepoRefFor(state, worktree)
    },
    context: {
      workspaceName: worktree.displayName,
      repoName,
      branch,
      path,
      comment: worktree.comment || undefined,
      linkedTask,
      agentTitles: agentTitlesOf(state, [worktree.id, ...memberIds]),
      memberWorkspaces: members.map((member) => ({
        name: member.displayName,
        repoName: repoNameOf(state, member),
        branch: member.branch?.replace(/^refs\/heads\//, '') || undefined
      }))
    }
  }
}
