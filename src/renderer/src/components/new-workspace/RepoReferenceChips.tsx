import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import { KIND_ICON } from './MultiRepoMentionOption'

/** Chips shown before "Show more"; repositories with dozens of migration steps would fill the dialog. */
export const REPO_REFERENCE_CHIP_PAGE = 20

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
  const [visibleCount, setVisibleCount] = useState(REPO_REFERENCE_CHIP_PAGE)
  if (references.length === 0) {
    return null
  }
  const visible = references.slice(0, visibleCount)
  const hidden = references.length - visible.length
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {translate(
          'multiRepo.repoReferencesTitle',
          'Repository skills and workflows (click to reference them):'
        )}
      </p>
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scrollbar-sleek">
        {visible.map((reference) => {
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
        {hidden > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisibleCount((count) => count + REPO_REFERENCE_CHIP_PAGE)}
          >
            {translate(
              'multiRepo.repoReferencesShowMoreLeft',
              'Show {{value0}} more ({{value1}} left)',
              {
                value0: Math.min(hidden, REPO_REFERENCE_CHIP_PAGE),
                value1: hidden
              }
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
