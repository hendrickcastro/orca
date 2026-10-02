import { useCallback, useMemo, useRef } from 'react'
import { FolderGit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import { getRelativePathInsideRoot, joinPath } from '@/lib/path'
import { findMultiRepoMentionQuery } from '@/lib/multi-repo-prompt-references'
import { rankMultiRepoMentionSuggestions } from '@/lib/multi-repo-mention-suggestions'
import { MentionSuggestionTextarea } from '@/components/mention-textarea/MentionSuggestionTextarea'
import { MultiRepoMentionOption, multiRepoMentionGroupLabel } from './MultiRepoMentionOption'
import { MultiRepoReferencePreview } from './MultiRepoReferencePreview'
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

/** The single-repo agent has no `@` reference block, so a pick inserts a plain instruction. */
export function describeSingleRepoReference(
  reference: MultiRepoReference,
  repoPath: string
): string {
  const path = reference.path
    ? (getRelativePathInsideRoot(reference.path, repoPath) ?? reference.path)
    : null
  const where = path ? ` (${path})` : ''
  switch (reference.kind) {
    case 'workflow':
      return `Run the "${reference.name}" workflow${where} with the Workflow tool.`
    case 'skill':
      return `Use the "${reference.name}" skill${where}.`
    case 'mcp':
      return `Use the "${reference.name}" MCP server.`
    case 'doc':
    case 'file':
      return `Read ${path ?? reference.name}.`
  }
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
  const getSuggestions = useCallback(
    (query: string) => rankMultiRepoMentionSuggestions(query, catalog),
    [catalog]
  )
  const resolveReferencePath = (reference: MultiRepoReference): string | null => {
    if (!reference.path) {
      return null
    }
    return reference.kind === 'skill' || !repo
      ? reference.path
      : joinPath(repo.path, reference.path)
  }
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
          <MentionSuggestionTextarea
            id="new-workspace-agent-instructions"
            appearance="field"
            rows={3}
            value={agentPrompt ?? ''}
            onValueChange={onAgentPromptChange}
            textareaRef={textareaRef}
            placeholder={translate(
              'auto.components.NewWorkspaceComposerCard.agentInstructionsMentionPlaceholder',
              'Add context or constraints. Type @ for skills, workflows and files. The linked task is sent as well.'
            )}
            findQuery={findMultiRepoMentionQuery}
            getSuggestions={getSuggestions}
            getOptionKey={(option) => option.token}
            getInsertText={(option) =>
              repo ? describeSingleRepoReference(option, repo.path) : option.token
            }
            getOptionGroup={(option) => multiRepoMentionGroupLabel(option.kind)}
            renderOption={(option) => <MultiRepoMentionOption reference={option} />}
            renderPreview={(option, select) => (
              <MultiRepoReferencePreview
                reference={option}
                absolutePath={resolveReferencePath(option)}
                onSelect={select}
              />
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
