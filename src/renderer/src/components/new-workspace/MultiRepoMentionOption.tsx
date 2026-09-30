import { BookOpen, FileCode, Plug, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference, MultiRepoReferenceKind } from '@/lib/multi-repo-prompt-references'

export function multiRepoMentionGroupLabel(kind: MultiRepoReferenceKind): string {
  switch (kind) {
    case 'skill':
      return translate('multiRepo.references.skills', 'Skills')
    case 'mcp':
      return translate('multiRepo.references.mcp', 'MCP servers')
    case 'doc':
      return translate('multiRepo.references.docs', 'Docs')
    case 'file':
      return translate('multiRepo.references.files', 'Files')
  }
}

const KIND_ICON = { skill: Sparkles, mcp: Plug, doc: BookOpen, file: FileCode } as const

export function MultiRepoMentionOption({
  reference
}: {
  reference: MultiRepoReference
}): React.JSX.Element {
  const Icon = KIND_ICON[reference.kind]
  const detail = reference.kind === 'mcp' ? reference.source : reference.description
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="truncate font-medium">{reference.name}</span>
        {detail && <span className="truncate text-muted-foreground">{detail}</span>}
      </span>
      <Badge variant="hostContext">
        {reference.scope.kind === 'repo'
          ? reference.scope.repoName
          : translate('multiRepo.references.global', 'Global')}
      </Badge>
    </>
  )
}
