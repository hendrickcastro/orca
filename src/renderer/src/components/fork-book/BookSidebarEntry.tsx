import { BookMarked } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'

/** Sidebar navigation entry for Book, under Orca Mobile; matches its sibling nav rows. */
export function BookSidebarEntry(): React.JSX.Element {
  const active = useAppStore((s) => s.activeView === 'book')
  const setActiveView = useAppStore((s) => s.setActiveView)
  return (
    <button
      type="button"
      onClick={() => setActiveView('book')}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <BookMarked
        className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="flex-1">{translate('forkBook.navLabel', 'Book')}</span>
    </button>
  )
}
