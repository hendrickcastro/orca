import { useMemo, useRef } from 'react'
import { FolderGit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import { getRelativePathInsideRoot } from '@/lib/path'
import type { Repo } from '../../../../shared/repo-types'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import { useMultiRepoMentionCatalog } from './use-multi-repo-mention-catalog'
import { RepoReferenceChips, selectRepoReferenceChips } from './RepoReferenceChips'
import { insertTextIntoPrompt } from './multi-repo-prompt-path-drop'

type Props = Pick<
  NewWorkspaceComposerCardProps,
  | 'quickAgent'
  | 'agentPrompt'
  | 'onAgentPromptChange'
  | 'onUseMultipleRepos'
  | 'eligibleRepos'
  | 'repoId'
>

const NO_REPOS: readonly Repo[] = []

/** The single-repo agent has no `@` reference block, so a chip inserts a plain instruction. */
export function describeSingleRepoReference(
  reference: MultiRepoReference,
  repoPath: string
): string {
  const path = reference.path
    ? (getRelativePathInsideRoot(reference.path, repoPath) ?? reference.path)
    : null
  const where = path ? ` (${path})` : ''
  return reference.kind === 'workflow'
    ? `Run the "${reference.name}" workflow${where} with the Workflow tool.`
    : `Use the "${reference.name}" skill${where}.`
}

/** Extra instructions for the agent on top of the linked task, and the switch to several repos. */
export function NewWorkspaceComposerInstructionsSection({
  quickAgent,
  agentPrompt,
  onAgentPromptChange,
  onUseMultipleRepos,
  eligibleRepos,
  repoId
}: Props): React.JSX.Element | null {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const repo = eligibleRepos.find((entry) => entry.id === repoId)
  // Why local only: skill discovery and directory reads run on this computer.
  const catalogRepos = useMemo(() => (repo && !repo.connectionId ? [repo] : NO_REPOS), [repo])
  const { catalog } = useMultiRepoMentionCatalog(catalogRepos)
  const chips = useMemo(() => selectRepoReferenceChips(catalog.references), [catalog])
  if (!onAgentPromptChange && !onUseMultipleRepos) {
    return null
  }
  const insertReference = (reference: MultiRepoReference): void => {
    if (!onAgentPromptChange || !repo) {
      return
    }
    const value = agentPrompt ?? ''
    const textarea = textareaRef.current
    const next = insertTextIntoPrompt(
      value,
      textarea?.selectionStart ?? value.length,
      textarea?.selectionEnd ?? value.length,
      describeSingleRepoReference(reference, repo.path)
    )
    onAgentPromptChange(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.caret, next.caret)
    })
  }
  return (
    <div className="space-y-2">
      {quickAgent !== null && onAgentPromptChange ? (
        <div className="space-y-1.5">
          <Label htmlFor="new-workspace-agent-instructions">
            {translate(
              'auto.components.NewWorkspaceComposerCard.agentInstructions',
              'Instructions for the agent (optional)'
            )}
          </Label>
          <Textarea
            id="new-workspace-agent-instructions"
            ref={textareaRef}
            rows={3}
            value={agentPrompt ?? ''}
            onChange={(event) => onAgentPromptChange(event.target.value)}
            placeholder={translate(
              'auto.components.NewWorkspaceComposerCard.agentInstructionsPlaceholder',
              'Add context or constraints. The linked task is sent to the agent as well.'
            )}
          />
          <RepoReferenceChips references={chips} showRepoName={false} onPick={insertReference} />
        </div>
      ) : null}
      {onUseMultipleRepos ? (
        <Button type="button" variant="link" size="sm" onClick={onUseMultipleRepos}>
          <FolderGit2 className="size-3.5" />
          {translate(
            'auto.components.NewWorkspaceComposerCard.useMultipleRepositories',
            'Work across several repositories…'
          )}
        </Button>
      ) : null}
    </div>
  )
}
