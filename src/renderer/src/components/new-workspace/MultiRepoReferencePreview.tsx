import { useEffect, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import {
  KIND_ICON,
  multiRepoMentionGroupLabel,
  multiRepoReferenceLabel
} from './MultiRepoMentionOption'

const PREVIEW_MAX_LINES = 80
const previewCache = new Map<string, string | null>()

async function loadPreview(filePath: string): Promise<string | null> {
  if (previewCache.has(filePath)) {
    return previewCache.get(filePath) ?? null
  }
  let text: string | null = null
  try {
    const file = await window.api.fs.readFile({ filePath })
    text = file.isBinary ? null : file.content.split(/\r?\n/).slice(0, PREVIEW_MAX_LINES).join('\n')
  } catch {
    // Unreadable files simply show no excerpt.
  }
  previewCache.set(filePath, text)
  return text
}

/** Details of the highlighted `@` suggestion, so a skill can be read before it is picked. */
export function MultiRepoReferencePreview({
  reference,
  absolutePath,
  onSelect
}: {
  reference: MultiRepoReference
  /** Readable location of the referenced file, or null for MCP servers. */
  absolutePath: string | null
  onSelect: () => void
}): React.JSX.Element {
  const [excerpt, setExcerpt] = useState<{ path: string; text: string | null } | null>(null)
  useEffect(() => {
    if (!absolutePath) {
      return
    }
    let stale = false
    void loadPreview(absolutePath).then((text) => {
      if (!stale) {
        setExcerpt({ path: absolutePath, text })
      }
    })
    return () => {
      stale = true
    }
  }, [absolutePath])
  const Icon = KIND_ICON[reference.kind]
  const loading = Boolean(absolutePath) && excerpt?.path !== absolutePath
  const text = excerpt?.path === absolutePath ? excerpt.text : null
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3 pb-12">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span>{multiRepoMentionGroupLabel(reference.kind)}</span>
      </div>
      <p className="break-words text-sm font-semibold text-foreground">
        {multiRepoReferenceLabel(reference)}
      </p>
      {reference.description ? (
        <p className="text-xs text-muted-foreground">{reference.description}</p>
      ) : null}
      {reference.kind === 'mcp' && reference.source ? (
        <p className="text-xs text-muted-foreground">{reference.source}</p>
      ) : null}
      {absolutePath ? (
        <p className="break-all font-mono text-[11px] text-muted-foreground">{absolutePath}</p>
      ) : null}
      {loading ? (
        <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
      ) : text ? (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-[11px] text-foreground scrollbar-sleek">
          {text}
        </pre>
      ) : null}
      <div className="absolute right-3 bottom-3">
        <Button
          type="button"
          size="sm"
          // Why mousedown: keeps the textarea focused so the mention lands at its caret.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onSelect}
        >
          <Check className="size-3.5" />
          {translate('multiRepo.references.select', 'Select')}
        </Button>
      </div>
    </div>
  )
}
