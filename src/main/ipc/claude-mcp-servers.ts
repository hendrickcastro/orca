import { readClaudeUserMcpServers } from '../claude/claude-user-mcp-servers'
import {
  CLAUDE_USER_MCP_MAX_PROJECT_PATHS,
  type ClaudeUserMcpServers
} from '../../shared/claude-user-mcp-servers'
import { handleMainWindowSkillIpc } from './skill-ipc-main-window'

export function registerClaudeMcpServerHandlers(): void {
  handleMainWindowSkillIpc(
    'mcp:listClaudeUserServers',
    async (_event, projectPaths: unknown): Promise<ClaudeUserMcpServers> => {
      const paths = Array.isArray(projectPaths)
        ? projectPaths
            .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            .slice(0, CLAUDE_USER_MCP_MAX_PROJECT_PATHS)
        : []
      return readClaudeUserMcpServers(paths)
    }
  )
}
