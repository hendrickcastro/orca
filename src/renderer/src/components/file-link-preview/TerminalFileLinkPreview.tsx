import { useMemo, useSyncExternalStore } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { terminalLinkClickBehaviorFor } from '@/components/terminal-pane/terminal-link-click-behavior'
import { useAppStore } from '@/store'
import { FileLinkPreviewBody, fileLinkOpenHint } from './FileLinkPreviewBody'
import {
  getTerminalFileLinkPreview,
  hideTerminalFileLinkPreviewNow,
  hideTerminalFileLinkPreviewSoon,
  keepTerminalFileLinkPreviewOpen,
  subscribeTerminalFileLinkPreview
} from './terminal-file-link-preview-state'

/** One for the app: the preview of the terminal file link under the pointer. */
export function TerminalFileLinkPreview(): React.JSX.Element {
  const request = useSyncExternalStore(
    subscribeTerminalFileLinkPreview,
    getTerminalFileLinkPreview,
    getTerminalFileLinkPreview
  )
  const opensOnPlainClick = useAppStore((s) => terminalLinkClickBehaviorFor(s.settings) === 'open')
  const virtualRef = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => new DOMRect(request?.anchorX ?? 0, request?.anchorY ?? 0, 0, 0)
      }
    }),
    [request?.anchorX, request?.anchorY]
  )
  return (
    <Popover
      open={request !== null}
      onOpenChange={(open) => !open && hideTerminalFileLinkPreviewNow()}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      {request ? (
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={8}
          className="w-[560px] max-w-[calc(100vw-2rem)]"
          // Why: the terminal keeps the keyboard; the preview is only looked at and scrolled.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={keepTerminalFileLinkPreviewOpen}
          onPointerLeave={hideTerminalFileLinkPreviewSoon}
        >
          {/* Why the wrapper: PopoverContent carries no padding, unlike HoverCardContent. */}
          <div className="p-3">
            <FileLinkPreviewBody
              absolutePath={request.absolutePath}
              line={request.line}
              fileContext={request.fileContext}
              rootPath={request.rootPath}
              fallbackLabel={request.absolutePath}
              openHint={fileLinkOpenHint(opensOnPlainClick)}
            />
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  )
}
