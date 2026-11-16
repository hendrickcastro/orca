import { registerAzureDevOpsHandlers } from '../azure-devops'
import { registerAsanaHandlers } from '../asana'
import { registerClaudeMcpServerHandlers } from '../claude-mcp-servers'
import { registerForkBookHandlers } from '../fork-book'
import type { Store } from '../../persistence/loading-store/store'
import type { CommitMessageAgentEnvironmentResolvers } from '../../text-generation/execution/commit-message-agent-environment'

/** IPC handlers only the Orca knwr fork registers; one call keeps upstream's registry merge-clean. */
export function registerForkHandlers(
  store: Pick<Store, 'getSettings'>,
  commitMessageAgentEnv?: CommitMessageAgentEnvironmentResolvers
): void {
  registerAzureDevOpsHandlers()
  registerAsanaHandlers()
  registerClaudeMcpServerHandlers()
  registerForkBookHandlers(store, commitMessageAgentEnv)
}
