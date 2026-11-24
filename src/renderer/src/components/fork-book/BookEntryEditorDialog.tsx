import { useEffect, useMemo, useRef, useState } from 'react'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import { LoaderCircle, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import {
  bookConversationKey,
  findBookEntryForConversation,
  upsertBookEntry
} from '../../../../shared/fork-book/book-catalog-operations'
import { bookEntryMembers } from '../../../../shared/fork-book/book-catalog-normalization'
import { draftBookEntryText } from '../../../../shared/fork-book/book-entry-text'
import { useBookStore } from './book-store'
import { BOOK_ROOT_FOLDER_VALUE, flattenBookFolders } from './book-folder-options'
import { BookConversationPicker } from './BookConversationPicker'
import { useBookHistoryConversations } from './use-book-history-conversations'

/** Create or edit one Book entry; mounted once at the app root so the sidebar menu can open it. */
export function BookEntryEditorDialog(): React.JSX.Element | null {
  const intlLocale = useIntlLocale()
  const t = useTranslate()
  const editor = useBookStore((s) => s.editor)
  const catalog = useBookStore((s) => s.catalog)
  const updateEditor = useBookStore((s) => s.updateEditor)
  const closeEditor = useBookStore((s) => s.closeEditor)
  const openEditorForEntry = useBookStore((s) => s.openEditorForEntry)
  const setWorkspacePrompt = useBookStore((s) => s.setWorkspacePrompt)
  const commit = useBookStore((s) => s.commit)
  const [generating, setGenerating] = useState(false)
  const history = useBookHistoryConversations(editor?.snapshot?.fields.path)
  const liveCandidates = editor?.snapshot?.conversations
  const candidates = useMemo(() => {
    const seen = new Set<string>()
    return [...(liveCandidates ?? []), ...history].filter((candidate) => {
      const key = bookConversationKey(candidate.conversation)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [liveCandidates, history])
  // A new entry picks the newest conversation once; a later "only the workspace" choice sticks.
  const autoPickedFor = useRef<object | null>(null)
  useEffect(() => {
    const snapshot = editor?.snapshot
    if (!snapshot || editor.entryId !== null || editor.conversation || candidates.length === 0) {
      return
    }
    if (autoPickedFor.current !== snapshot) {
      autoPickedFor.current = snapshot
      updateEditor({ conversation: candidates[0].conversation })
    }
  }, [candidates, editor, updateEditor])
  if (!editor) {
    return null
  }
  const context = editor.snapshot?.context ?? null
  const folderOptions = flattenBookFolders(catalog)
  const alreadySaved = findBookEntryForConversation(catalog, editor.conversation, editor.entryId)
  const savedEntry = editor.entryId
    ? catalog.entries.find((entry) => entry.id === editor.entryId)
    : undefined
  const reposSummary = savedEntry
    ? bookEntryMembers(savedEntry)
        .map((member) => [member.repoName, member.branch].filter(Boolean).join(': '))
        .join(' · ')
    : ''
  const canSave = editor.title.trim().length > 0 && !alreadySaved

  const close = (): void => {
    if (generating) {
      void window.api.forkBook.cancelGenerate()
      setGenerating(false)
    }
    closeEditor()
  }

  const generate = (): void => {
    if (!context) {
      return
    }
    setGenerating(true)
    void window.api.forkBook
      .generate({ context, includeGitLog: true, language: intlLocale })
      .then((result) => {
        if (result.success) {
          updateEditor({ title: result.title, description: result.description })
        } else if (!result.canceled) {
          toast.error(t('forkBook.generateFailed', 'Could not generate the text.'), {
            description: result.error
          })
        }
      })
      .catch((error: unknown) => {
        toast.error(t('forkBook.generateFailed', 'Could not generate the text.'), {
          description: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => setGenerating(false))
  }

  const save = (): void => {
    if (!canSave) {
      return
    }
    const now = Date.now()
    const snapshot = editor.snapshot
    const existing = editor.entryId
      ? catalog.entries.find((entry) => entry.id === editor.entryId)
      : undefined
    if (existing) {
      commit((current) =>
        upsertBookEntry(current, {
          ...existing,
          title: editor.title.trim(),
          description: editor.description.trim(),
          folderId: editor.folderId,
          conversation: editor.conversation,
          repo: existing.repo ?? snapshot?.fields.repo,
          updatedAt: now
        })
      )
    } else if (snapshot) {
      commit((current) =>
        upsertBookEntry(current, {
          id: createNonSecureContextUuid(),
          ...snapshot.fields,
          title: editor.title.trim(),
          description: editor.description.trim(),
          folderId: editor.folderId,
          conversation: editor.conversation,
          createdAt: now,
          updatedAt: now
        })
      )
      toast.success(t('forkBook.saved', 'Saved to Book.'))
    }
    closeEditor()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editor.entryId
              ? t('forkBook.editTitle', 'Edit Book entry')
              : t('forkBook.newTitle', 'Save to Book')}
          </DialogTitle>
          {context ? (
            <DialogDescription>
              {[context.workspaceName, context.repoName, context.branch]
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="fork-book-entry-title">{t('forkBook.fieldTitle', 'Title')}</Label>
            <Input
              id="fork-book-entry-title"
              value={editor.title}
              onChange={(event) => updateEditor({ title: event.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fork-book-entry-description">
              {t('forkBook.fieldDescription', 'Description')}
            </Label>
            <Textarea
              id="fork-book-entry-description"
              rows={7}
              value={editor.description}
              onChange={(event) => updateEditor({ description: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('forkBook.fieldFolder', 'Book folder')}</Label>
            <Select
              value={editor.folderId ?? BOOK_ROOT_FOLDER_VALUE}
              onValueChange={(value) =>
                updateEditor({ folderId: value === BOOK_ROOT_FOLDER_VALUE ? null : value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BOOK_ROOT_FOLDER_VALUE}>
                  {t('forkBook.rootFolder', 'No folder')}
                </SelectItem>
                {folderOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span style={{ paddingLeft: option.depth * 12 }}>{option.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {savedEntry ? (
            <div className="space-y-1.5">
              <Label>{t('forkBook.fieldRepos', 'Repositories and branches')}</Label>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {reposSummary || t('forkBook.noRepos', 'No repository yet')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canSave || generating}
                  onClick={() => {
                    // Keeps the edits made so far, then picks the repositories.
                    save()
                    setWorkspacePrompt({ entryId: savedEntry.id, next: 'save' })
                  }}
                >
                  {t('forkBook.changeRepos', 'Change…')}
                </Button>
              </div>
            </div>
          ) : null}
          <BookConversationPicker
            candidates={candidates}
            value={editor.conversation}
            onChange={(conversation) => updateEditor({ conversation })}
          />
          {alreadySaved ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1">
                {t(
                  'forkBook.conversationAlreadySaved',
                  'This conversation is already in Book as “{{title}}”.',
                  {
                    title: alreadySaved.title
                  }
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openEditorForEntry(alreadySaved)}
              >
                {t('forkBook.editExistingEntry', 'Edit that entry')}
              </Button>
            </div>
          ) : null}
          {context ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={generating}
                onClick={() => updateEditor(draftBookEntryText(context))}
              >
                <Wand2 className="size-4" />
                {t('forkBook.fillFromTask', 'Fill from task')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={generating}
                onClick={generate}
              >
                {generating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {t('forkBook.generateWithAi', 'Generate with AI')}
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              {t('forkBook.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSave || generating}>
              {t('forkBook.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
