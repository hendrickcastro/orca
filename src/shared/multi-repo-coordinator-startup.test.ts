import { describe, expect, it } from 'vitest'
import { buildMultiRepoCoordinatorStartup } from './multi-repo-coordinator-startup'
import { tokenizeStartupCommand, type AgentStartupShell } from './tui-agent-startup-shell'
import { runProcess } from './child-process/run-process'

describe('multi-repository Claude launch arguments', () => {
  it.each<AgentStartupShell>(['powershell', 'cmd', 'posix'])(
    'preserves separate Windows paths and terminates directory arguments for %s',
    (shell) => {
      const paths = ['D:\\_ALGORITXIA\\Front End', 'E:\\Services\\Back End']
      const plan = buildMultiRepoCoordinatorStartup({
        paths,
        prompt: 'Implement the API and its consumer.',
        platform: 'win32',
        shell
      })
      expect(plan).not.toBeNull()
      const parsed = tokenizeStartupCommand(plan!.launchCommand, shell)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        throw new Error(parsed.error)
      }
      expect(parsed.tokens).toEqual([
        'claude',
        '--add-dir',
        paths[0],
        '--add-dir',
        paths[1],
        '--',
        'Implement the API and its consumer.'
      ])
      expect(plan!.launchConfig?.agentCommand).toContain('--add-dir')
    }
  )

  it('does not reparse PowerShell single-quoted literal backticks or apostrophes', () => {
    const plan = buildMultiRepoCoordinatorStartup({
      paths: ["D:\\O'Brien\\$HOME `whoami`"],
      prompt: 'Task',
      platform: 'win32',
      shell: 'powershell'
    })
    expect(plan?.launchCommand).toBe("claude --add-dir 'D:\\O''Brien\\$HOME `whoami`' '--' 'Task'")
  })

  it.runIf(process.platform !== 'win32')(
    'passes Unix paths and prompt literally to a real shell',
    async () => {
      const paths = ["/work/O'Brien; $(echo unwanted)/front", '/work/$HOME `whoami`/back']
      const prompt = 'Implement "search"\nwithout expanding $HOME or `whoami`.'
      const plan = buildMultiRepoCoordinatorStartup({
        paths,
        prompt,
        platform: 'linux',
        shell: 'posix',
        commandOverride: 'printf "%s\\n"'
      })
      const result = await runProcess({ program: '/bin/sh', args: ['-c', plan!.launchCommand] })
      expect(result.code).toBe(0)
      expect(result.stdout).toBe(
        ['--add-dir', paths[0], '--add-dir', paths[1], '--', prompt, ''].join('\n')
      )
    }
  )
})
