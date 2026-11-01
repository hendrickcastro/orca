import { registerAzureDevOpsHandlers } from '../azure-devops'
import { registerAsanaHandlers } from '../asana'
import { registerSubagentResultHandlers } from '../subagent-results'
import { registerClaudeMcpServerHandlers } from '../claude-mcp-servers'

/** IPC handlers only the Orca knwr fork registers; one call keeps upstream's registry merge-clean. */
export function registerForkHandlers(): void {
  registerAzureDevOpsHandlers()
  registerAsanaHandlers()
  registerSubagentResultHandlers()
  registerClaudeMcpServerHandlers()
}
