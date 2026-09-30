import { buildAgentStartupPlan, type AgentStartupPlan } from './tui-agent-startup'
import { quoteStartupArg, type AgentStartupShell } from './tui-agent-startup-shell'
import { getTuiAgentLaunchCommand, TUI_AGENT_CONFIG } from './tui-agent-config'

export function buildMultiRepoCoordinatorStartup(args: {
  paths: readonly string[]
  prompt: string
  platform: NodeJS.Platform
  shell: AgentStartupShell
  commandOverride?: string
}): AgentStartupPlan | null {
  const command =
    args.commandOverride || getTuiAgentLaunchCommand(TUI_AGENT_CONFIG.claude, args.platform)
  // Paths are literal argv, not user CLI syntax: do not send them through the settings tokenizer.
  const directoryArgs = args.paths
    .map((path) => `--add-dir ${quoteStartupArg(path, args.shell)}`)
    .join(' ')
  return buildAgentStartupPlan({
    agent: 'claude',
    prompt: args.prompt,
    cmdOverrides: { claude: `${command} ${directoryArgs}` },
    platform: args.platform,
    shell: args.shell,
    // Claude's variadic --add-dir would otherwise consume the positional prompt.
    agentArgs: '--'
  })
}
