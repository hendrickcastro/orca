import { useEffect, useState } from 'react'
import type { TerminalFileContext } from '@/components/terminal-pane/terminal-file-path-mapping'
import { NativeChatHighlightedCode } from '@/components/native-chat/NativeChatHighlightedCode'
import { readRuntimeFilePreview } from '@/runtime/runtime-file-read-client'
import { detectLanguage } from '@/lib/language-detect'
import { translate } from '@/i18n/i18n'

const LINES_BEFORE_TARGET = 4
const PREVIEW_LINE_COUNT = 30

type PreviewState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; code: string; firstLine: number; language: string }

/** The lines around `line` (or the file's start), numbered from `firstLine`. */
export function sliceFilePreview(
  content: string,
  line: number | null
): { code: string; firstLine: number } {
  const lines = content.split(/\r?\n/)
  const start =
    line === null ? 0 : Math.max(0, Math.min(line - 1, lines.length - 1) - LINES_BEFORE_TARGET)
  return {
    code: lines.slice(start, start + PREVIEW_LINE_COUNT).join('\n'),
    firstLine: start + 1
  }
}

function displayPath(absolutePath: string, rootPath: string): string {
  const root = rootPath.replace(/[\\/]+$/, '')
  return absolutePath.startsWith(`${root}/`) || absolutePath.startsWith(`${root}\\`)
    ? absolutePath.slice(root.length + 1)
    : absolutePath
}

/** The click that opens the link outright, for the preview's hint. */
export function fileLinkOpenHint(opensOnPlainClick: boolean): string {
  return opensOnPlainClick
    ? translate('components.native-chat.fileLinks.previewOpenHint', 'Click to open')
    : translate(
        'components.native-chat.fileLinks.previewModifierOpenHint',
        '{{value0}}+Click to open',
        {
          value0: navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
        }
      )
}

/** Path, open hint and the file's first lines (or those around `line`), read on the file's host. */
export function FileLinkPreviewBody({
  absolutePath,
  line,
  fileContext,
  rootPath,
  fallbackLabel,
  openHint
}: {
  absolutePath: string | null
  line: number | null
  fileContext: TerminalFileContext | null
  rootPath: string
  /** Shown in place of the path when the link resolved to none. */
  fallbackLabel: string
  openHint: string
}): React.JSX.Element {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })

  useEffect(() => {
    // Why: with no single host for the workspace, a read would silently go to this machine.
    if (!absolutePath || !fileContext?.sourceHostResolved) {
      setState({ status: 'unavailable' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    readRuntimeFilePreview(fileContext, absolutePath).then(
      (result) => {
        if (cancelled) {
          return
        }
        setState(
          result.isBinary || result.isImage
            ? { status: 'unavailable' }
            : {
                status: 'ready',
                ...sliceFilePreview(result.content, line),
                language: detectLanguage(absolutePath)
              }
        )
      },
      () => {
        if (!cancelled) {
          setState({ status: 'unavailable' })
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [absolutePath, fileContext, line])

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate font-mono" title={absolutePath ?? undefined}>
          {absolutePath ? displayPath(absolutePath, rootPath) : fallbackLabel}
          {line !== null ? `:${line}` : ''}
        </span>
        <span className="shrink-0">{openHint}</span>
      </div>
      {state.status === 'ready' ? (
        // Why fixed height: a card that grows once the file arrives slides under the pointer, and the
        // terminal reads that as leaving the link.
        <div className="scrollbar-sleek flex h-80 min-w-0 overflow-auto rounded-sm border border-border font-mono text-xs leading-5">
          <pre className="m-0 shrink-0 select-none border-r border-border px-2 py-2 text-right text-muted-foreground">
            {state.code
              .split('\n')
              .map((_, index) => state.firstLine + index)
              .join('\n')}
          </pre>
          <pre className="m-0 min-w-0 flex-1 px-3 py-2 text-foreground">
            <code>
              <NativeChatHighlightedCode code={state.code} language={state.language} />
            </code>
          </pre>
        </div>
      ) : (
        // Why loading reserves the code area: shrinking never slides the card under the pointer.
        <div
          className={
            state.status === 'loading'
              ? 'h-80 text-xs text-muted-foreground'
              : 'text-xs text-muted-foreground'
          }
        >
          {state.status === 'loading'
            ? translate('components.native-chat.fileLinks.previewLoading', 'Loading preview…')
            : translate(
                'components.native-chat.fileLinks.previewUnavailable',
                'No preview available'
              )}
        </div>
      )}
    </div>
  )
}
