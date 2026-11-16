import type { ParsedTerminalFileLink } from '../../../../shared/terminal/links/terminal-links'
import type { TerminalFileContext } from '@/components/terminal-pane/host-files/terminal-file-path-mapping'
import {
  resolveFileLinkTarget,
  type FileLinkHost,
  type FileLinkTarget
} from '@/components/terminal-pane/links/files/terminal-file-link-target'
import { findWorkspaceFileForTerminal } from './workspace-file-name-lookup'
import { showTerminalFileLinkPreviewSoon } from './terminal-file-link-preview-state'

/** The upstream target when it exists; else the one workspace file the text names by name or partial path. */
export async function resolveTerminalFileLinkOrWorkspaceFile(
  parsed: ParsedTerminalFileLink,
  host: FileLinkHost,
  exists: (target: FileLinkTarget) => Promise<boolean>
): Promise<FileLinkTarget | null> {
  const target = resolveFileLinkTarget(parsed, host)
  if (target && (await exists(target))) {
    return target
  }
  // Agents print files by name or by a path from some subfolder; find the one meant.
  const { worktreeId, worktreePath, runtimeEnvironmentId } = host
  const found = worktreeId
    ? await findWorkspaceFileForTerminal(
        { worktreeId, worktreePath, runtimeEnvironmentId: runtimeEnvironmentId ?? null },
        parsed.pathText
      )
    : null
  return found
    ? resolveFileLinkTarget({ ...parsed, pathText: found }, { ...host, cwd: worktreePath })
    : null
}

export function showTerminalFileLinkPreviewForTarget(
  target: FileLinkTarget,
  fileContext: TerminalFileContext,
  rootPath: string,
  event: MouseEvent
): void {
  if (target.isKnownWorktreeRoot || /[\\/]$/.test(target.absolutePath)) {
    return
  }
  showTerminalFileLinkPreviewSoon({
    absolutePath: target.absolutePath,
    line: target.line,
    fileContext,
    rootPath,
    anchorX: event.clientX,
    anchorY: event.clientY
  })
}
