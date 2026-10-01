import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { patchAsanaTaskView, refreshAsanaTasks, useAsanaTaskView } from './asana-task-view-store'

export function AsanaCreateTaskDialog(): React.JSX.Element | null {
  const { createOpen, workspaceGid, projectGid, projects, scope } = useAsanaTaskView()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [assignToMe, setAssignToMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!createOpen || !workspaceGid) {
    return null
  }
  const targetProjectGid = scope === 'project' ? projectGid : null
  const targetProject = projects.find((project) => project.gid === targetProjectGid)
  const close = (): void => {
    patchAsanaTaskView({ createOpen: false })
    setName('')
    setNotes('')
    setDueOn('')
    setError(null)
  }
  const submit = async (): Promise<void> => {
    const api = window.api.asana
    if (!api) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.createTask({
        workspaceGid,
        name,
        notes,
        projectGid: targetProjectGid,
        assignToMe,
        dueOn: dueOn || null
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(translate('auto.components.TaskPage.asanaTaskCreated', 'Asana task created.'))
      close()
      refreshAsanaTasks()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.TaskPage.asanaNewTask', 'New Asana task')}
          </DialogTitle>
          <DialogDescription>
            {targetProject
              ? translate(
                  'auto.components.TaskPage.asanaNewTaskInProject',
                  'In project {{value0}}',
                  {
                    value0: targetProject.name
                  }
                )
              : translate(
                  'auto.components.TaskPage.asanaNewTaskInWorkspace',
                  'In the selected workspace, without a project.'
                )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="asana-task-name">
              {translate('auto.components.TaskPage.asanaTaskName', 'Name')}
            </Label>
            <Input
              id="asana-task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asana-task-notes">
              {translate('auto.components.TaskPage.asanaTaskNotes', 'Description')}
            </Label>
            <Textarea
              id="asana-task-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="asana-task-due">
                {translate('auto.components.TaskPage.asanaTaskDue', 'Due date')}
              </Label>
              <Input
                id="asana-task-due"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="asana-task-assign"
                checked={assignToMe}
                onCheckedChange={(checked) => setAssignToMe(checked === true)}
              />
              <Label htmlFor="asana-task-assign">
                {translate('auto.components.TaskPage.asanaAssignToMe', 'Assign to me')}
              </Label>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={close}>
              {translate('auto.components.TaskPage.asanaCancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {translate('auto.components.TaskPage.asanaCreate', 'Create task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
