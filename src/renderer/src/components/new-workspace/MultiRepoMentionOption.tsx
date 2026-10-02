import { BookOpen, FileCode, Plug, Sparkles, Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference, MultiRepoReferenceKind } from '@/lib/multi-repo-prompt-references'

export function multiRepoMentionGroupLabel(kind: MultiRepoReferenceKind): string {
  switch (kind) {
    case 'skill':
      return translate('multiRepo.references.skills', 'Skills')
    case 'workflow':
      return translate('multiRepo.references.workflows', 'Workflows')
    case 'mcp':
      return translate('multiRepo.references.mcp', 'MCP servers')
    case 'doc':
      return translate('multiRepo.references.docs', 'Docs')
    case 'file':
      return translate('multiRepo.references.files', 'Files')
  }
}

export const KIND_ICON = {
  skill: Sparkles,
  workflow: Workflow,
  mcp: Plug,
  doc: BookOpen,
  file: FileCode
} as const

/** `repository:name` (or `global:name`), the label users scan for in long skill lists. */
export function multiRepoReferenceLabel(reference: MultiRepoReference): string {
  const scope =
    reference.scope.kind === 'repo'
      ? reference.scope.repoName
      : translate('multiRepo.references.globalScope', 'global')
  return `${scope}:${reference.name}`
}

export function MultiRepoMentionOption({
  reference
}: {
  reference: MultiRepoReference
}): React.JSX.Element {
  const Icon = KIND_ICON[reference.kind]
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {multiRepoReferenceLabel(reference)}
      </span>
    </>
  )
}
