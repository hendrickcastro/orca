import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import { MentionSuggestionTextarea } from '@/components/mention-textarea/MentionSuggestionTextarea'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  isMultiRepoLocalRepository,
  MULTI_REPO_BRANCH_PREFIX,
  MULTI_REPO_TASK_KINDS,
  MultiRepoWorkspaceCreation,
  type MultiRepoTaskKind
} from '@/lib/multi-repo-workspace-creation'
import { launchMultiRepoCoordinator } from '@/lib/multi-repo-coordinator-launch'
import {
  collectMentionedReferences,
  findMultiRepoMentionQuery,
  type MultiRepoReference
} from '@/lib/multi-repo-prompt-references'
import { rankMultiRepoMentionSuggestions } from '@/lib/multi-repo-mention-suggestions'
import { cn } from '@/lib/utils'
import { slugifyForWorkspaceName } from '../../../../shared/workspace-name'
import { useMultiRepoMentionCatalog } from './use-multi-repo-mention-catalog'
import { MultiRepoMentionOption, multiRepoMentionGroupLabel } from './MultiRepoMentionOption'
import { insertTextIntoPrompt, useMultiRepoPromptPathDrop } from './multi-repo-prompt-path-drop'
import { RepoReferenceChips, selectRepoReferenceChips } from './RepoReferenceChips'
import {
  buildMultiRepoPromptWithLinkedTask,
  defaultMultiRepoTaskName,
  type MultiRepoInitialValues
} from './multi-repo-linked-task'
import { MultiRepoLinkedTaskRow } from './MultiRepoLinkedTaskRow'
import { MultiRepoReferencePreview } from './MultiRepoReferencePreview'
import { joinPath } from '@/lib/path'

function taskKindLabel(kind: MultiRepoTaskKind): string {
  switch (kind) {
    case 'feature':
      return translate('multiRepo.kind.feature', 'Feature')
    case 'bugfix':
      return translate('multiRepo.kind.bugfix', 'Bug fix')
    case 'refactor':
      return translate('multiRepo.kind.refactor', 'Refactor')
    case 'chore':
      return translate('multiRepo.kind.chore', 'Maintenance')
  }
}

const NO_INITIAL_VALUES: MultiRepoInitialValues = {}

export default function MultiRepoWorkspaceDialog({
  onClose,
  initial = NO_INITIAL_VALUES
}: {
  onClose: () => void
  initial?: MultiRepoInitialValues
}): React.JSX.Element {
  const repos = useAppStore((state) => state.repos)
  const eligibleRepos = repos.filter(isMultiRepoLocalRepository)
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(eligibleRepos.slice(0, 2).map((repo) => repo.id))
  )
  const [kind, setKind] = useState<MultiRepoTaskKind>('feature')
  const [name, setName] = useState(() => defaultMultiRepoTaskName(initial))
  const [branch, setBranch] = useState(() => {
    const slug = slugifyForWorkspaceName(defaultMultiRepoTaskName(initial))
    return slug ? `${MULTI_REPO_BRANCH_PREFIX.feature}${slug}` : ''
  })
  const [branchEdited, setBranchEdited] = useState(false)
  const [prompt, setPrompt] = useState(initial.prompt ?? '')
  const [linkedWorkItem, setLinkedWorkItem] = useState(initial.linkedWorkItem ?? null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const creationRef = useRef<MultiRepoWorkspaceCreation | null>(null)
  const submittingRef = useRef(false)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const insertedReferencesRef = useRef(new Map<string, MultiRepoReference>())
  const [started, setStarted] = useState(false)
  const selectedRepos = eligibleRepos.filter((repo) => selected.has(repo.id))
  const { catalog, loading: catalogLoading } = useMultiRepoMentionCatalog(selectedRepos)
  // Why: repo-relative entries are read from the original checkout until the worktrees exist.
  const resolveReferencePath = (reference: MultiRepoReference): string | null => {
    if (!reference.path) {
      return null
    }
    if (reference.kind === 'skill' || reference.scope.kind !== 'repo') {
      return reference.path
    }
    const repoId = reference.scope.repoId
    const repo = selectedRepos.find((entry) => entry.id === repoId)
    return repo ? joinPath(repo.path, reference.path) : null
  }
  const repoChips = useMemo(() => selectRepoReferenceChips(catalog.references), [catalog])
  const insertReference = (reference: MultiRepoReference): void => {
    const textarea = promptRef.current
    const next = insertTextIntoPrompt(
      prompt,
      textarea?.selectionStart ?? prompt.length,
      textarea?.selectionEnd ?? prompt.length,
      reference.token
    )
    insertedReferencesRef.current.set(reference.token, reference)
    setPrompt(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.caret, next.caret)
    })
  }
  const getSuggestions = useCallback(
    (query: string) => rankMultiRepoMentionSuggestions(query, catalog),
    [catalog]
  )
  const promptDrop = useMultiRepoPromptPathDrop({
    disabled: busy || started,
    value: prompt,
    onValueChange: setPrompt,
    textareaRef: promptRef
  })
  const suggestedBranch = (nextKind: MultiRepoTaskKind, nextName: string): string => {
    const slug = slugifyForWorkspaceName(nextName)
    return slug ? `${MULTI_REPO_BRANCH_PREFIX[nextKind]}${slug}` : ''
  }

  const submit = async (): Promise<void> => {
    if (submittingRef.current) {
      return
    }
    submittingRef.current = true
    setBusy(true)
    setError(null)
    try {
      creationRef.current ??= new MultiRepoWorkspaceCreation({
        name,
        branch,
        prompt: buildMultiRepoPromptWithLinkedTask(prompt, linkedWorkItem),
        kind,
        references: collectMentionedReferences(prompt, insertedReferencesRef.current.values()),
        repos: selectedRepos
      })
      setStarted(true)
      await creationRef.current.create(window.api, setProgress)
      await launchMultiRepoCoordinator(creationRef.current, useAppStore.getState().settings)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      // Why non-modal: a modal dialog blocks pointer events outside it, so files could not be
      // dragged from the right sidebar's explorer into the prompt.
      modal={false}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(event) => {
          // Why: clicking or dragging in the explorer must not discard the task being written.
          event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          // Why: Escape first dismisses an open reference list, not the whole dialog.
          if (
            event.target === promptRef.current &&
            promptRef.current?.getAttribute('aria-expanded') === 'true'
          ) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{translate('multiRepo.title', 'New multi-repository task')}</DialogTitle>
          <DialogDescription>
            {translate(
              'multiRepo.description',
              'Create a worktree in each selected repository and open one Claude coordinator for a feature, bug fix or any other cross-repository task. Repository folders stay where they are.'
            )}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy || started} className="min-w-0 space-y-3">
          <div className="space-y-2">
            <Label>{translate('multiRepo.repositories', 'Repositories')}</Label>
            <RepoMultiCombobox
              repos={eligibleRepos}
              selected={selected}
              onChange={setSelected}
              onSelectAll={() => setSelected(new Set(eligibleRepos.map((repo) => repo.id)))}
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'multiRepo.localOnly',
                'Choose at least two Git repositories on this computer. SSH, remote servers and WSL are not supported in this version.'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{translate('multiRepo.kindLabel', 'Type')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={kind}
              onValueChange={(value) => {
                const nextKind = MULTI_REPO_TASK_KINDS.find((entry) => entry === value)
                if (!nextKind) {
                  return
                }
                setKind(nextKind)
                if (!branchEdited) {
                  setBranch(suggestedBranch(nextKind, name))
                }
              }}
            >
              {MULTI_REPO_TASK_KINDS.map((entry) => (
                <ToggleGroupItem key={entry} value={entry}>
                  {taskKindLabel(entry)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-name">{translate('multiRepo.name', 'Task name')}</Label>
            <Input
              id="multi-repo-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (!branchEdited) {
                  setBranch(suggestedBranch(kind, event.target.value))
                }
              }}
              placeholder={translate('multiRepo.namePlaceholder', 'Patient search')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-branch">
              {translate('multiRepo.branch', 'New branch in every repository')}
            </Label>
            <Input
              id="multi-repo-branch"
              value={branch}
              onChange={(event) => {
                setBranch(event.target.value)
                setBranchEdited(event.target.value.trim() !== '')
              }}
              placeholder={`${MULTI_REPO_BRANCH_PREFIX[kind]}${translate('multiRepo.branchPlaceholder', 'patient-search')}`}
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'multiRepo.base',
                'Each repository uses its configured base ref. Setup scripts are skipped; commits and pull requests remain separate.'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-prompt">
              {translate('multiRepo.prompt', 'What should Claude do?')}
            </Label>
            {linkedWorkItem ? (
              <MultiRepoLinkedTaskRow
                item={linkedWorkItem}
                onRemove={() => setLinkedWorkItem(null)}
              />
            ) : null}
            <div
              className={cn('rounded-md', promptDrop.isDragOver && 'ring-2 ring-ring/30')}
              {...promptDrop.dropHandlers}
            >
              <MentionSuggestionTextarea
                id="multi-repo-prompt"
                appearance="field"
                value={prompt}
                onValueChange={setPrompt}
                rows={5}
                textareaRef={promptRef}
                findQuery={findMultiRepoMentionQuery}
                getSuggestions={getSuggestions}
                getOptionKey={(option) => option.token}
                getInsertText={(option) => option.token}
                getOptionGroup={(option) => multiRepoMentionGroupLabel(option.kind)}
                onInsert={(option) => insertedReferencesRef.current.set(option.token, option)}
                renderOption={(option) => <MultiRepoMentionOption reference={option} />}
                renderPreview={(option, select) => (
                  <MultiRepoReferencePreview
                    reference={option}
                    absolutePath={resolveReferencePath(option)}
                    onSelect={select}
                  />
                )}
              />
            </div>
            {promptDrop.notice && <p className="text-xs text-destructive">{promptDrop.notice}</p>}
            <RepoReferenceChips
              references={repoChips}
              showRepoName={selectedRepos.length > 1}
              onPick={insertReference}
            />
            <p className="text-xs text-muted-foreground">
              {catalogLoading
                ? translate(
                    'multiRepo.referencesLoading',
                    'Loading skills, MCP servers, docs and files from the selected repositories…'
                  )
                : translate(
                    'multiRepo.referencesHintWorkflows',
                    'Type @ to reference skills, workflows, MCP servers, docs or files, or drag files and folders from the explorer to add their paths. Use @skill:, @workflow: or @mcp: to narrow the list.'
                  )}
            </p>
          </div>
        </fieldset>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {progress}
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{error}</p>
            {started && (
              <p>
                {translate(
                  'multiRepo.recovery',
                  'Confirmed worktrees are kept. Retry continues this creation; closing keeps the partial workspace for inspection in Orca.'
                )}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {translate('multiRepo.close', 'Close')}
          </Button>
          <Button
            disabled={
              busy ||
              (!started &&
                (selected.size < 2 ||
                  !name.trim() ||
                  !branch.trim() ||
                  (!prompt.trim() && !linkedWorkItem)))
            }
            onClick={() => void submit()}
          >
            {started
              ? translate('multiRepo.retry', 'Retry remaining steps')
              : translate('multiRepo.create', 'Create and start Claude')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
