// Where the active credential comes from; `environment` wins over every saved organization.
export type AzureDevOpsCredentialSource = 'environment' | 'stored' | 'none'

export type AzureDevOpsConnectArgs = {
  /** Organization URL (`https://dev.azure.com/org`), a legacy `org.visualstudio.com` URL, or a Server collection URL. */
  organizationUrl: string
  username?: string | null
  pat: string
}

// Deliberately excludes the secret: it never crosses the IPC boundary back to the renderer.
export type AzureDevOpsOrganizationCredential = {
  organizationUrl: string
  username: string | null
  account: string | null
  updatedAt: string
}

export type AzureDevOpsConnectionStatus = {
  source: AzureDevOpsCredentialSource
  organizations: AzureDevOpsOrganizationCredential[]
}

export type AzureDevOpsConnectResult =
  | { ok: true; organizationUrl: string; account: string | null }
  | { ok: false; error: string }
