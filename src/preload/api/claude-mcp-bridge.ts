import { ipcRenderer } from 'electron'
import type { ClaudeUserMcpServers } from '../../shared/claude-user-mcp-servers'
import type { PreloadApi } from '../api-types'

export const claudeMcpApi = {
  listClaudeUserServers: (projectPaths: string[]): Promise<ClaudeUserMcpServers> =>
    ipcRenderer.invoke('mcp:listClaudeUserServers', projectPaths)
} satisfies PreloadApi['claudeMcp']
