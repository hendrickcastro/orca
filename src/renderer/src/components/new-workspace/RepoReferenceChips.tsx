import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import { KIND_ICON } from './MultiRepoMentionOption'

/** Repository-owned skills and workflows only: global ones are reachable through `@`. */
export function selectRepoReferenceChips(
  references: readonly MultiRepoReference[]
): MultiRepoReference[] {
  return references
    .filter(
      (reference) =>
        reference.scope.kind === 'repo' &&
        (reference.kind === 'skill' || reference.kind === 'workflow')
    )
    .toSorted(
      (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
    )
}

export function RepoReferenceChips({
  references,
  showRepoName,
  onPick
}: {
  references: readonly MultiRepoReference[]
  showRepoName: boolean
  onPick: (reference: MultiRepoReference) => void
}): React.JSX.Element | null {
  if (references.length === 0) {
    return null
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {translate(
          'multiRepo.repoReferencesTitle',
          'Repository skills and workflows (click to reference them):'
        )}
      </p>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto scrollbar-sleek">
        {references.map((reference) => {
          const Icon = KIND_ICON[reference.kind]
          const repoName = reference.scope.kind === 'repo' ? reference.scope.repoName : null
          return (
            <Button
              key={reference.token}
              type="button"
              variant="outline"
              size="xs"
              title={reference.description ?? reference.path ?? reference.name}
              // Why mousedown: keeps the textarea caret where the reference should go.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(reference)}
            >
              <Icon className="size-3" />
              {showRepoName && repoName ? `${repoName}/${reference.name}` : reference.name}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
