import type { McpServerSummary } from './mcp-config'

export type ClaudeMcpServerEntry = Pick<McpServerSummary, 'name' | 'transport' | 'status'>

/** MCP servers from Claude's global config: user scope and per-project local scope. */
export type ClaudeUserMcpServers = {
  user: ClaudeMcpServerEntry[]
  /** Keyed by the project path exactly as the caller passed it. */
  projects: Record<string, ClaudeMcpServerEntry[]>
}

export const CLAUDE_USER_MCP_MAX_PROJECT_PATHS = 32
