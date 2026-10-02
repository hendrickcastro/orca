import type React from 'react'
import { AsanaIcon } from '@/components/icons/AsanaIcon'
import { AzureDevOpsIcon } from '@/components/icons/AzureDevOpsIcon'
import { translate } from '@/i18n/i18n'
import type { TaskProvider } from '../../../shared/task-providers'

type ForkTaskProvider = Extract<TaskProvider, 'azure-devops' | 'asana'>
const FORK_TASK_PROVIDERS: readonly ForkTaskProvider[] = ['azure-devops', 'asana']

// Why getters: labels must re-translate after a language switch, so callers reference entries instead of spreading.
export const FORK_TASKS_PANE_PROVIDER_META: Record<
  ForkTaskProvider,
  {
    label: string
    description: string
    Icon: (props: { className?: string }) => React.JSX.Element
  }
> = {
  'azure-devops': {
    get label() {
      return translate('auto.components.settings.TasksPane.azureDevOpsLabel', 'Azure DevOps')
    },
    get description() {
      return translate(
        'auto.components.settings.TasksPane.azureDevOpsDescription',
        'Browse Azure Boards work items and pull requests and start workspaces from them.'
      )
    },
    Icon: ({ className }) => <AzureDevOpsIcon className={className} />
  },
  asana: {
    get label() {
      return translate('auto.components.settings.TasksPane.asanaLabel', 'Asana')
    },
    get description() {
      return translate(
        'auto.components.settings.TasksPane.asanaDescription',
        'Connect Asana to browse and create tasks and start workspaces from them.'
      )
    },
    Icon: ({ className }) => <AsanaIcon className={className} />
  }
}

function shortcutLabel(provider: ForkTaskProvider): string {
  return provider === 'asana'
    ? translate('auto.components.sidebar.SidebarNav.openAsanaTasks', 'Open Asana tasks')
    : translate(
        'auto.components.sidebar.SidebarNav.openAzureDevOpsTasks',
        'Open Azure DevOps tasks'
      )
}

/** Sidebar shortcuts for the fork's task providers, rendered with the host's shortcut button. */
export function ForkTaskProviderShortcuts({
  visibleTaskProviders,
  onOpen,
  Shortcut
}: {
  visibleTaskProviders: readonly TaskProvider[]
  onOpen: (taskSource: ForkTaskProvider) => void
  Shortcut: (props: {
    label: string
    onOpen: () => void
    children: React.ReactNode
  }) => React.JSX.Element
}): React.JSX.Element {
  return (
    <>
      {FORK_TASK_PROVIDERS.filter((provider) => visibleTaskProviders.includes(provider)).map(
        (provider) => {
          const { Icon } = FORK_TASKS_PANE_PROVIDER_META[provider]
          return (
            <Shortcut
              key={provider}
              label={shortcutLabel(provider)}
              onOpen={() => onOpen(provider)}
            >
              <Icon className="size-3.5" />
            </Shortcut>
          )
        }
      )}
    </>
  )
}
