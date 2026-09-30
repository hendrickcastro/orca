import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, GitPullRequestArrow, KeyRound, LoaderCircle, Unlink } from 'lucide-react'
import type {
  AzureDevOpsConnectionStatus,
  AzureDevOpsOrganizationCredential
} from '../../../../shared/azure-devops-credentials'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { readIpcErrorMessage } from '@/lib/ipc-error'
import { translate } from '@/i18n/i18n'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { useIntegrationSubordinateRowClass } from './integration-card-presentation'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'
import { tokenProviderStatusLabel } from './token-source-control-status'
import { AzureDevOpsCredentialsDialog } from './azure-devops-credentials-dialog'

const PAT_DOCS_URL =
  'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'

type DialogTarget = { organization: AzureDevOpsOrganizationCredential | null }

export function AzureDevOpsIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('azureDevOps')
  const status = unavailable ? 'unavailable' : statuses.azureDevOpsStatus
  const configured = status === 'configured'
  const mountedRef = useMountedRef()
  const rowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const [connection, setConnection] = useState<AzureDevOpsConnectionStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [dialog, setDialog] = useState<DialogTarget | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const generationRef = useRef(0)

  // Reads plaintext metadata only — never the encrypted tokens — so opening Settings cannot prompt the keychain.
  const loadConnection = useCallback(async () => {
    const generation = ++generationRef.current
    try {
      const next = await window.api.azureDevOps.status()
      if (mountedRef.current && generation === generationRef.current) {
        setConnection(next)
        setLoadFailed(false)
      }
    } catch {
      if (mountedRef.current && generation === generationRef.current) {
        setLoadFailed(true)
      }
    }
  }, [mountedRef])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  const reload = (): void => {
    void loadConnection()
    refresh()
  }
  const envManaged = connection?.source === 'environment'
  const organizations = connection?.organizations ?? []

  const remove = async (organizationUrl: string): Promise<void> => {
    setRemoving(organizationUrl)
    setRemoveError(null)
    try {
      await window.api.azureDevOps.disconnect(organizationUrl)
    } catch (error) {
      if (mountedRef.current) {
        setRemoveError(
          readIpcErrorMessage(error) ??
            translate(
              'settings.azureDevOps.card.removeFailed',
              'Could not remove the saved Azure DevOps organization.'
            )
        )
      }
    } finally {
      if (mountedRef.current) {
        setRemoving(null)
      }
      reload()
    }
  }

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Azure DevOps"
      description={
        configured
          ? statuses.azureDevOpsAccount || statuses.azureDevOpsBaseUrl
            ? translate(
                'auto.components.settings.token.source.control.integration.cards.ea204f5e03',
                '{{value0}} · Pull requests and build statuses',
                { value0: statuses.azureDevOpsAccount || statuses.azureDevOpsBaseUrl }
              )
            : translate(
                'auto.components.settings.token.source.control.integration.cards.54636c65d4',
                'Pull requests and build statuses for detected Azure Repos'
              )
          : translate(
              'settings.azureDevOps.card.description',
              'Pull requests and build statuses for Azure Repos, with a token per organization.'
            )
      }
      checking={status === 'checking'}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={tokenProviderStatusLabel({
        configured,
        hasAccount: Boolean(statuses.azureDevOpsAccount),
        status
      })}
      actions={
        status !== 'checking' && !envManaged && (connection !== null || loadFailed) ? (
          <Button
            variant={organizations.length > 0 ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialog({ organization: null })}
          >
            {organizations.length > 0
              ? translate('settings.azureDevOps.card.addOrganization', 'Add organization')
              : translate('settings.azureDevOps.card.connect', 'Connect')}
          </Button>
        ) : null
      }
    >
      {status !== 'checking' ? (
        <IntegrationCardDetails>
          {organizations.map((organization) => (
            <div key={organization.organizationUrl} className={rowClass}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {organization.organizationUrl}
                </p>
                {organization.account || organization.username ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {[organization.account, organization.username].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
              {!envManaged ? (
                <>
                  <button
                    onClick={() => setDialog({ organization })}
                    aria-label={translate(
                      'settings.azureDevOps.card.replaceToken',
                      'Replace token for {{value0}}',
                      { value0: organization.organizationUrl }
                    )}
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
                  >
                    <KeyRound className="size-3.5" />
                  </button>
                  <button
                    onClick={() => void remove(organization.organizationUrl)}
                    disabled={removing !== null}
                    aria-label={translate('settings.azureDevOps.card.remove', 'Remove {{value0}}', {
                      value0: organization.organizationUrl
                    })}
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                  >
                    {removing === organization.organizationUrl ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Unlink className="size-3.5" />
                    )}
                  </button>
                </>
              ) : null}
            </div>
          ))}
          {removeError ? <p className="text-xs text-destructive">{removeError}</p> : null}
          {loadFailed ? (
            <p role="alert" className="text-xs text-destructive">
              {translate(
                'settings.azureDevOps.card.statusLoadFailed',
                'Could not check for saved Azure DevOps organizations.'
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable'
              ? translate(
                  'auto.components.settings.token.source.control.integration.cards.f3f47dc7de',
                  'Azure DevOps status is not available in this runtime yet.'
                )
              : envManaged
                ? translate(
                    'settings.azureDevOps.card.envManaged',
                    'Configured via ORCA_AZURE_DEVOPS_* environment variables, which apply to every organization. Unset them to use saved organizations.'
                  )
                : status === 'not-authenticated'
                  ? translate(
                      'auto.components.settings.token.source.control.integration.cards.40f678df73',
                      'Azure DevOps credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart Orca if environment variables changed.'
                    )
                  : organizations.length > 0
                    ? translate(
                        'settings.azureDevOps.card.stored',
                        'Saved in Orca on this machine. Each repository uses the token of the organization in its git remote.'
                      )
                    : translate(
                        'settings.azureDevOps.card.notConfigured',
                        'Connect each organization with a personal access token. ORCA_AZURE_DEVOPS_TOKEN works too and takes precedence.'
                      )}
          </p>
          <div className="flex items-center gap-2">
            {!configured ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.api.shell.openUrl(PAT_DOCS_URL)}
              >
                <ExternalLink className="size-3.5 mr-1.5" />
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.1a9475dace',
                  'Learn more'
                )}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={reload}>
              {translate(
                'auto.components.settings.token.source.control.integration.cards.793a06e899',
                'Re-check'
              )}
            </Button>
          </div>
        </IntegrationCardDetails>
      ) : null}

      <AzureDevOpsCredentialsDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        initialOrganizationUrl={dialog?.organization?.organizationUrl}
        initialUsername={dialog?.organization?.username}
        environmentManaged={envManaged}
        onConnected={reload}
      />
    </IntegrationCardShell>
  )
}
