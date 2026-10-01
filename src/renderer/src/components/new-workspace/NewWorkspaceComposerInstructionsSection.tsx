import { FolderGit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'

type Props = Pick<
  NewWorkspaceComposerCardProps,
  'quickAgent' | 'agentPrompt' | 'onAgentPromptChange' | 'onUseMultipleRepos'
>

/** Extra instructions for the agent on top of the linked task, and the switch to several repos. */
export function NewWorkspaceComposerInstructionsSection({
  quickAgent,
  agentPrompt,
  onAgentPromptChange,
  onUseMultipleRepos
}: Props): React.JSX.Element | null {
  if (!onAgentPromptChange && !onUseMultipleRepos) {
    return null
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
            rows={3}
            value={agentPrompt ?? ''}
            onChange={(event) => onAgentPromptChange(event.target.value)}
            placeholder={translate(
              'auto.components.NewWorkspaceComposerCard.agentInstructionsPlaceholder',
              'Add context or constraints. The linked task is sent to the agent as well.'
            )}
          />
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
