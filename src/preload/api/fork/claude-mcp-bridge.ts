import { ipcRenderer } from 'electron'
import type { ClaudeUserMcpServers } from '../../../shared/claude-user-mcp-servers'

export const claudeMcpApi = {
  listClaudeUserServers: (projectPaths: string[]): Promise<ClaudeUserMcpServers> =>
    ipcRenderer.invoke('mcp:listClaudeUserServers', projectPaths)
}
