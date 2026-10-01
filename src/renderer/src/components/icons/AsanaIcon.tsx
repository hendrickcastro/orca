export function AsanaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {/* Why: monochrome Asana three-dot mark so it matches the other provider icons. */}
      <circle cx="12" cy="6.5" r="4.5" />
      <circle cx="5.5" cy="15.5" r="4.5" />
      <circle cx="18.5" cy="15.5" r="4.5" />
    </svg>
  )
}
