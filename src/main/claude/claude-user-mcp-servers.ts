import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { summarizeMcpServer } from '../../shared/mcp-server-inspection'
import { MCP_CONFIG_INSPECTION_MAX_SERVERS } from '../../shared/mcp-config-inspection-limits'
import type {
  ClaudeMcpServerEntry,
  ClaudeUserMcpServers
} from '../../shared/claude-user-mcp-servers'
import {
  resolveClaudeGlobalConfigFile,
  toClaudeTrustKey,
  type ClaudeTrustPathStyle
} from './claude-folder-trust-file'

// Why: ~/.claude.json also holds per-project history, so it outgrows the 256 KiB MCP-file limit.
const MAX_CLAUDE_GLOBAL_CONFIG_BYTES = 32 * 1024 * 1024

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function summarizeServers(value: unknown): ClaudeMcpServerEntry[] {
  if (!isPlainObject(value)) {
    return []
  }
  return Object.entries(value)
    .slice(0, MCP_CONFIG_INSPECTION_MAX_SERVERS)
    .map(([name, entry]) => {
      const { transport, status } = summarizeMcpServer(name, entry)
      return { name, transport, status }
    })
}

export function parseClaudeUserMcpServers(
  content: string | null,
  projectPaths: readonly string[],
  style: ClaudeTrustPathStyle
): ClaudeUserMcpServers {
  const result: ClaudeUserMcpServers = { user: [], projects: {} }
  if (!content) {
    return result
  }
  let config: unknown
  try {
    config = JSON.parse(content)
  } catch {
    return result
  }
  if (!isPlainObject(config)) {
    return result
  }
  result.user = summarizeServers(config.mcpServers)
  const projects = isPlainObject(config.projects) ? config.projects : {}
  // Why: Windows paths are case-insensitive, and the drive letter case varies between writers.
  const normalizeKey = (key: string): string => (style === 'win32' ? key.toLowerCase() : key)
  const projectByKey = new Map(Object.entries(projects).map(([key, v]) => [normalizeKey(key), v]))
  for (const projectPath of projectPaths) {
    const project = projectByKey.get(normalizeKey(toClaudeTrustKey(projectPath, style)))
    result.projects[projectPath] = isPlainObject(project)
      ? summarizeServers(project.mcpServers)
      : []
  }
  return result
}

export async function readClaudeUserMcpServers(
  projectPaths: readonly string[]
): Promise<ClaudeUserMcpServers> {
  const style: ClaudeTrustPathStyle = process.platform === 'win32' ? 'win32' : 'posix'
  const homeDir = (style === 'win32' ? process.env.USERPROFILE : process.env.HOME) || homedir()
  const configFile = resolveClaudeGlobalConfigFile({
    env: {
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      CLAUDE_CODE_CUSTOM_OAUTH_URL: process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL
    },
    homeDir,
    style,
    exists: existsSync
  })
  let content: string | null = null
  try {
    if ((await stat(configFile)).size <= MAX_CLAUDE_GLOBAL_CONFIG_BYTES) {
      content = await readFile(configFile, 'utf8')
    }
  } catch {
    // A missing or unreadable config simply contributes no servers.
  }
  return parseClaudeUserMcpServers(content, projectPaths, style)
}
