import type { GlobalSettings } from '../../../shared/global-settings-types'
import { resolveLocalWindowsAgentStartupShell } from '../../../shared/windows-terminal-shell'
import { buildMultiRepoCoordinatorStartup } from '../../../shared/multi-repo-coordinator-startup'
import {
  buildMultiRepoCoordinatorPrompt,
  type MultiRepoWorkspaceCreation
} from './multi-repo-workspace-creation'
import { activateAndRevealFolderWorkspace } from './worktree-activation'
import { createBrowserUuid } from './browser-uuid'
import { CLIENT_PLATFORM } from './new-workspace'
import { useAppStore } from '@/store'

export async function launchMultiRepoCoordinator(
  creation: MultiRepoWorkspaceCreation,
  settings: GlobalSettings | null
): Promise<void> {
  const { workspace, members, request } = creation
  if (!workspace || members.length !== request.repos.length) {
    throw new Error('Create every repository worktree before starting the coordinator.')
  }
  if (
    CLIENT_PLATFORM === 'win32' &&
    /(?:^|[\\/])wsl(?:\.exe)?$/i.test(settings?.terminalWindowsShell?.trim() ?? '')
  ) {
    throw new Error(
      'Select PowerShell, Command Prompt or Git Bash in Settings before starting this local coordinator.'
    )
  }
  const shell =
    resolveLocalWindowsAgentStartupShell({
      platform: CLIENT_PLATFORM,
      isRemote: false,
      terminalWindowsShell: settings?.terminalWindowsShell
    }) ?? (CLIENT_PLATFORM === 'win32' ? 'powershell' : 'posix')
  const startup = buildMultiRepoCoordinatorStartup({
    prompt: buildMultiRepoCoordinatorPrompt(
      request.name,
      members,
      request.prompt,
      request.kind,
      request.references
    ),
    commandOverride: settings?.agentCmdOverrides?.claude,
    platform: CLIENT_PLATFORM,
    shell,
    paths: members.map((member) => member.worktree.path)
  })
  if (!startup) {
    throw new Error('The Claude launch command is invalid. Check the agent command in Settings.')
  }
  const state = useAppStore.getState()
  await Promise.all([
    state.fetchProjectGroups({ runtimeEnvironmentId: null }),
    state.fetchFolderWorkspaces({ runtimeEnvironmentId: null }),
    ...members.map(({ repo }) => state.fetchWorktrees(repo.id, { forceLocalOwner: true }))
  ])
  await state.fetchWorktreeLineage({ forceLocalOwner: true })
  const activation = activateAndRevealFolderWorkspace(workspace.id, {
    agent: 'claude',
    runtimeEnvironmentId: null,
    executionHostId: 'local',
    startup: {
      command: startup.launchCommand,
      env: startup.env,
      launchConfig: startup.launchConfig,
      launchAgent: 'claude',
      launchToken: createBrowserUuid(),
      sessionOptions: startup.sessionOptions,
      startupCommandDelivery: startup.startupCommandDelivery
    }
  })
  if (!activation) {
    throw new Error('Worktrees were created, but the coordinator workspace could not be opened.')
  }
}
