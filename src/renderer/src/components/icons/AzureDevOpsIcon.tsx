export function AzureDevOpsIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={className} fill="currentColor">
      {/* Why: monochrome Azure DevOps mark so it matches the other provider icons. */}
      <path d="M17 4v9.74l-4 3.28-6.2-2.26V17l-3.51-4.59 10.23.8V4.44zm-3.41.49L7.85 1v2.29L2.58 4.84 1 6.87v4.61l2.26 1V6.57z" />
    </svg>
  )
}
