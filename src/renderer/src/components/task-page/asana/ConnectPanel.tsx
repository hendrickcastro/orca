import { useState } from 'react'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { applyAsanaStatus } from './asana-task-view-store'

const ASANA_TOKEN_URL = 'https://app.asana.com/0/my-apps'

export function AsanaConnectPanel({ error }: { error: string | null }): React.JSX.Element {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const connect = async (): Promise<void> => {
    const api = window.api.asana
    if (!api) {
      return
    }
    setBusy(true)
    setConnectError(null)
    try {
      const result = await api.connect(token)
      if (result.ok) {
        setToken('')
        applyAsanaStatus(result.status)
      } else {
        setConnectError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-10">
      <p className="text-base font-medium text-foreground">
        {translate('auto.components.TaskPage.asanaConnectTitle', 'Connect Asana')}
      </p>
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.TaskPage.asanaConnectDescription',
          'Create a personal access token in the Asana developer console and paste it here. It is stored encrypted on this computer.'
        )}
      </p>
      <Button
        variant="link"
        size="sm"
        onClick={() => void window.api.shell.openUrl(ASANA_TOKEN_URL)}
      >
        <ExternalLink className="size-3.5" />
        {translate(
          'auto.components.TaskPage.asanaOpenTokenPage',
          'Open the Asana developer console'
        )}
      </Button>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void connect()
        }}
      >
        <Label htmlFor="asana-token">
          {translate('auto.components.TaskPage.asanaToken', 'Personal access token')}
        </Label>
        <Input
          id="asana-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        {connectError || error ? (
          <p role="alert" className="text-xs text-destructive">
            {connectError ?? error}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={busy || !token.trim()}>
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {translate('auto.components.TaskPage.asanaConnect', 'Connect')}
        </Button>
      </form>
    </div>
  )
}
