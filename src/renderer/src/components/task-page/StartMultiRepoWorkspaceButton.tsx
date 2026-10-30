import { useState } from 'react'
import { FolderGit2, LoaderCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** Row action beside "Start workspace": the task goes to the several-repositories flow instead. */
export function StartMultiRepoWorkspaceButton({
  taskLabel,
  onStart
}: {
  taskLabel: string
  onStart: () => void | Promise<void>
}): React.JSX.Element {
  const [launching, setLaunching] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={launching}
          onClick={(event) => {
            event.stopPropagation()
            setLaunching(true)
            void Promise.resolve(onStart()).finally(() => setLaunching(false))
          }}
          aria-label={translate(
            'auto.components.TaskPage.startMultiRepoWorkspaceFrom',
            'Start multi-repository workspace from {{value0}}',
            { value0: taskLabel }
          )}
        >
          {launching ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <FolderGit2 className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {translate(
          'auto.components.TaskPage.startMultiRepoWorkspace',
          'Start multi-repository workspace'
        )}
      </TooltipContent>
    </Tooltip>
  )
}
