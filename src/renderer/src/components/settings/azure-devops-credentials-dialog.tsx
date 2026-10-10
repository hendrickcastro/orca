import { useId, useLayoutEffect, useState } from 'react'
import { ExternalLink, LoaderCircle, Lock } from 'lucide-react'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasRemoteProviderRuntime } from '@/lib/provider-runtime-context'
import { preventOutsideDismissWhenDirty } from '@/lib/outside-dismiss-guard'
import { translate } from '@/i18n/i18n'

const PAT_DOCS_URL =
  'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'

type AzureDevOpsCredentialsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefills the organization when replacing the token of a saved one. */
  initialOrganizationUrl?: string | null
  initialUsername?: string | null
  environmentManaged?: boolean
  onConnected?: () => void
}

export function AzureDevOpsCredentialsDialog({
  open,
  onOpenChange,
  initialOrganizationUrl,
  initialUsername,
  environmentManaged = false,
  onConnected
}: AzureDevOpsCredentialsDialogProps): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()
  const organizationId = useId()
  const usernameId = useId()
  const patId = useId()
  const errorId = useId()
  const [organizationUrl, setOrganizationUrl] = useState('')
  const [username, setUsername] = useState('')
  const [pat, setPat] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Secrets always start empty: the main process never hands them back.
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    setOrganizationUrl(initialOrganizationUrl ?? '')
    setUsername(initialUsername ?? '')
    setPat('')
    setConnecting(false)
    setError(null)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on `open` alone: a status refresh mid-edit must not overwrite what the user is typing.
  }, [open])

  const canSubmit =
    !environmentManaged && !connecting && Boolean(organizationUrl.trim()) && Boolean(pat.trim())
  const guardOutsideDismiss = preventOutsideDismissWhenDirty(
    () => pat !== '' || organizationUrl !== (initialOrganizationUrl ?? '')
  )
  const clearError = (): void => setError(null)

  const handleConnect = async (): Promise<void> => {
    if (!canSubmit) {
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const result = await window.api.azureDevOps.connect({
        organizationUrl: organizationUrl.trim(),
        username: username.trim() || null,
        pat: pat.trim()
      })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setPat('')
        onOpenChange(false)
        onConnected?.()
        return
      }
      setError(result.error)
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : translate('settings.azureDevOps.dialog.connectFailed', 'Connection failed')
        )
      }
    } finally {
      if (mountedRef.current) {
        setConnecting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !connecting && onOpenChange(next)}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={guardOutsideDismiss}
        onInteractOutside={guardOutsideDismiss}
        onKeyDown={(event) => {
          if (event.target instanceof HTMLInputElement && event.key === 'Enter' && canSubmit) {
            event.preventDefault()
            void handleConnect()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {translate('settings.azureDevOps.dialog.title', 'Connect an Azure DevOps organization')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'settings.azureDevOps.dialog.description',
              'Each organization keeps its own token. Repositories use the token of the organization in their git remote. Orca verifies it before saving.'
            )}
          </DialogDescription>
        </DialogHeader>
        {environmentManaged ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'settings.azureDevOps.dialog.environmentManaged',
              'Azure DevOps is configured through ORCA_AZURE_DEVOPS_* environment variables, which take precedence for every organization. Unset them to use saved organizations.'
            )}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={organizationId}>
                {translate('settings.azureDevOps.dialog.organization', 'Organization')}
              </Label>
              <Input
                id={organizationId}
                autoFocus
                placeholder={translate(
                  'settings.azureDevOps.dialog.organizationPlaceholder',
                  'https://dev.azure.com/my-organization'
                )}
                value={organizationUrl}
                onChange={(event) => {
                  setOrganizationUrl(event.target.value)
                  clearError()
                }}
                disabled={connecting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={usernameId}>
                {translate('settings.azureDevOps.dialog.username', 'Username (optional)')}
              </Label>
              <Input
                id={usernameId}
                autoComplete="username"
                placeholder={translate(
                  'settings.azureDevOps.dialog.usernamePlaceholder',
                  'you@example.com'
                )}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  clearError()
                }}
                disabled={connecting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={patId}>
                {translate('settings.azureDevOps.dialog.pat', 'Personal access token')}
              </Label>
              <Input
                id={patId}
                type="password"
                autoComplete="off"
                placeholder={translate(
                  'settings.azureDevOps.dialog.patPlaceholder',
                  'Token with Code (Read) access'
                )}
                value={pat}
                onChange={(event) => {
                  setPat(event.target.value)
                  clearError()
                }}
                disabled={connecting}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            {error ? (
              <p id={errorId} className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                {translate(
                  'settings.azureDevOps.dialog.hint',
                  'Create the token under User settings → Personal access tokens with Code (Read) scope; add Code (Read & write) to create pull requests from Orca.'
                )}
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                onClick={() => window.api.shell.openUrl(PAT_DOCS_URL)}
              >
                <ExternalLink className="size-3" />
                {translate('settings.azureDevOps.dialog.docsLink', 'Azure DevOps token docs')}
              </button>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground/70">
              <Lock className="size-3 mt-0.5 shrink-0" />
              {hasRemoteProviderRuntime(settings)
                ? translate(
                    'settings.azureDevOps.dialog.remoteRuntime',
                    'Stored on this machine, not on the active remote runtime — set ORCA_AZURE_DEVOPS_* there instead.'
                  )
                : translate(
                    'settings.azureDevOps.dialog.storageNote',
                    'Stored on this machine with encrypted storage when the OS keychain is available. ORCA_AZURE_DEVOPS_* environment variables take precedence.'
                  )}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={connecting}>
            {translate('settings.azureDevOps.dialog.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleConnect()} disabled={!canSubmit}>
            {connecting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {translate('settings.azureDevOps.dialog.verifying', 'Verifying...')}
              </>
            ) : (
              translate('settings.azureDevOps.dialog.connect', 'Connect')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
