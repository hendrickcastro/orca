import type { ClaudeUserMcpServers } from '../../../shared/claude-user-mcp-servers'
import { asanaApi, type AsanaApi } from './asana-bridge'
import { azureDevOpsApi, type AzureDevOpsApi } from './azure-devops-bridge'
import { claudeMcpApi } from './claude-mcp-bridge'
import { forkBookApi, type ForkBookApi } from './book-bridge'

/** Preload keys only the Orca knwr fork exposes; PreloadApi and the api object take them in one line each. */
export type ForkPreloadApi = {
  azureDevOps: AzureDevOpsApi
  asana: AsanaApi
  forkBook: ForkBookApi
  claudeMcp: {
    /** MCP servers from Claude's global config (user scope plus each project's local scope). */
    listClaudeUserServers: (projectPaths: string[]) => Promise<ClaudeUserMcpServers>
  }
}

export const forkPreloadApi = {
  azureDevOps: azureDevOpsApi,
  asana: asanaApi,
  forkBook: forkBookApi,
  claudeMcp: claudeMcpApi
} satisfies ForkPreloadApi
