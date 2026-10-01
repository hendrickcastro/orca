import { useCallback, useEffect, useState, type DragEvent, type RefObject } from 'react'
import { translate } from '@/i18n/i18n'
import {
  getWorkspaceFileDragRejectionMessage,
  hasWorkspaceFileDragType,
  readWorkspaceFileDragPaths,
  readWorkspaceFileDragSource
} from '@/lib/workspace-file-drag'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'

function formatDroppedPath(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path
}

/** Splices dropped paths over the selection, padding with spaces so they never fuse with neighbours. */
export function insertDroppedPathsIntoPrompt(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  paths: readonly string[]
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const before = value.slice(0, start)
  const after = value.slice(end)
  const prefix = before && !/\s$/.test(before) ? ' ' : ''
  const suffix = after && !/^\s/.test(after) ? ' ' : ''
  const inserted = `${prefix}${paths.map(formatDroppedPath).join(' ')}${suffix}`
  return { value: `${before}${inserted}${after}`, caret: start + inserted.length }
}

export function useMultiRepoPromptPathDrop({
  disabled,
  value,
  onValueChange,
  textareaRef
}: {
  disabled: boolean
  value: string
  onValueChange: (value: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}): {
  isDragOver: boolean
  notice: string | null
  dropHandlers: {
    onDragOver: (event: DragEvent<HTMLDivElement>) => void
    onDragLeave: (event: DragEvent<HTMLDivElement>) => void
    onDrop: (event: DragEvent<HTMLDivElement>) => void
  }
} {
  const [isDragOver, setIsDragOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const reset = (): void => setIsDragOver(false)
    document.addEventListener('dragend', reset, true)
    return () => document.removeEventListener('dragend', reset, true)
  }, [])

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (!hasWorkspaceFileDragType(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
      setIsDragOver(!disabled)
    },
    [disabled]
  )

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    // Why: dragleave also fires when moving onto a child; only a real exit clears the highlight.
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return
    }
    setIsDragOver(false)
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (!hasWorkspaceFileDragType(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      setIsDragOver(false)
      if (disabled) {
        return
      }
      // Why: the coordinator runs on this computer, so a path from an SSH or remote workspace
      // would point at a file it cannot open. Unstamped drags fail closed like the chat composer.
      if (
        readWorkspaceFileDragSource(event.dataTransfer)?.executionHostId !== LOCAL_EXECUTION_HOST_ID
      ) {
        setNotice(
          translate(
            'multiRepo.dropLocalOnly',
            'Only files and folders on this computer can be added to the prompt.'
          )
        )
        return
      }
      const dragPaths = readWorkspaceFileDragPaths(event.dataTransfer)
      if (dragPaths.status === 'rejected') {
        setNotice(getWorkspaceFileDragRejectionMessage(dragPaths.reason))
        return
      }
      if (dragPaths.paths.length === 0) {
        return
      }
      setNotice(null)
      const textarea = textareaRef.current
      const next = insertDroppedPathsIntoPrompt(
        value,
        textarea?.selectionStart ?? value.length,
        textarea?.selectionEnd ?? value.length,
        dragPaths.paths
      )
      onValueChange(next.value)
      requestAnimationFrame(() => {
        textarea?.focus()
        textarea?.setSelectionRange(next.caret, next.caret)
      })
    },
    [disabled, onValueChange, textareaRef, value]
  )

  return { isDragOver, notice, dropHandlers: { onDragOver, onDragLeave, onDrop } }
}
