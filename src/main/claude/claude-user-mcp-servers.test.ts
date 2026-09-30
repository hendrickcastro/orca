import { describe, expect, it } from 'vitest'
import { parseClaudeUserMcpServers } from './claude-user-mcp-servers'

const config = JSON.stringify({
  mcpServers: {
    cosmosdb: { command: 'npx', args: ['cosmos-mcp'], env: { COSMOS_KEY: 'secret' } },
    docs: { type: 'http', url: 'https://docs.example/mcp', disabled: true }
  },
  projects: {
    'd:/Work/front': { mcpServers: { playwright: { command: 'npx' } } },
    '/home/me/back': { mcpServers: { sql: { command: 'sql-mcp' } } }
  }
})

describe('parseClaudeUserMcpServers', () => {
  it('returns user servers without their environment', () => {
    const result = parseClaudeUserMcpServers(config, [], 'posix')
    expect(result.user).toEqual([
      { name: 'cosmosdb', transport: 'stdio', status: 'enabled' },
      { name: 'docs', transport: 'http', status: 'disabled' }
    ])
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('matches Windows project keys regardless of separators and drive case', () => {
    const result = parseClaudeUserMcpServers(config, ['D:\\Work\\front', 'E:\\Other'], 'win32')
    expect(result.projects).toEqual({
      'D:\\Work\\front': [{ name: 'playwright', transport: 'stdio', status: 'enabled' }],
      'E:\\Other': []
    })
  })

  it('keeps POSIX project keys case-sensitive', () => {
    const result = parseClaudeUserMcpServers(config, ['/home/me/back', '/home/Me/back'], 'posix')
    expect(result.projects['/home/me/back']).toHaveLength(1)
    expect(result.projects['/home/Me/back']).toEqual([])
  })

  it('treats a missing or corrupt config as empty', () => {
    expect(parseClaudeUserMcpServers(null, ['/a'], 'posix')).toEqual({ user: [], projects: {} })
    expect(parseClaudeUserMcpServers('{', ['/a'], 'posix')).toEqual({ user: [], projects: {} })
  })
})
