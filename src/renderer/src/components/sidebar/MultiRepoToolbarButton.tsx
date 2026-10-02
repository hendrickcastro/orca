import React from 'react'
import { FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import MultiRepoWorkspaceDialog from '../new-workspace/MultiRepoWorkspaceDialog'

export function MultiRepoToolbarButton(): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      {open && <MultiRepoWorkspaceDialog onClose={() => setOpen(false)} />}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={translate('multiRepo.title', 'New multi-repository task')}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {translate('multiRepo.title', 'New multi-repository task')}
        </TooltipContent>
      </Tooltip>
    </>
  )
}
