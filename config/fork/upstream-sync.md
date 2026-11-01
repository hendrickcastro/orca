# Sincronización con upstream (stablyai/orca)

Registro de cada vez que se trae `stablyai/orca` (upstream) a este fork (`hendrickcastro/orca`, producto «Orca knwr»).
**Antes de sincronizar, lee el estado actual; al terminar, actualízalo y añade una fila al historial.**

## Estado actual

| | |
| --- | --- |
| Último commit de upstream integrado | `d95e2324dcd` — 2026-11-01 — fix(notifications): announce finished only when the agent is fully done (#36992) |
| Commit de fusión en el fork | _(se rellena al cerrar la sincronización)_ |
| `main` del fork antes de la fusión | `096af0bd434` |
| Próxima sincronización: commits nuevos | `git log --oneline d95e2324dcd..upstream/main` |

## Procedimiento

1. **Remotos.** `origin` = `hendrickcastro/orca`, `upstream` = `stablyai/orca`.
   ```sh
   git fetch upstream main && git fetch origin main
   git log --oneline <último commit integrado>..upstream/main | wc -l   # cuánto hay que traer
   ```
2. **Worktree aparte, desde el `main` publicado del fork** (nunca sobre un worktree con trabajo a medias):
   ```sh
   git worktree add -b sync/upstream-AAAA-MM-DD ../upstream-sync-AAAA-MM-DD origin/main
   cd ../upstream-sync-AAAA-MM-DD
   git -c merge.renameLimit=20000 merge --no-ff --no-commit upstream/main
   git diff --name-only --diff-filter=U        # lista de conflictos
   ```
3. **Resolver cada conflicto conservando todo lo de upstream y re-aplicando el cambio del fork encima.**
   Para cada archivo: `git show :1:<ruta>` (base), `:2:` (fork), `:3:` (upstream) y la intención del fork con
   `git log -p upstream/main..origin/main -- <ruta>`. Si upstream movió el código, el cambio del fork se porta a la ruta nueva.
4. **Dependencias y comprobaciones** (en este orden):
   ```sh
   pnpm install
   pnpm tc
   pnpm test <carpetas tocadas por el fork y por los conflictos>
   pnpm run check:code-quality:changed
   ```
   Comprobar la app con `ORCA_BACKGROUND_LAUNCH=1 pnpm dev` (perfil aparte con `ORCA_DEV_USER_DATA_PATH`).
5. **Publicar.** Commit de fusión `Merge upstream stablyai/orca main (<N> commits) into the fork`, push de la rama,
   y avanzar `main`. Cada push a `main` lanza `Fork Release (Orca knwr)`, que publica la release para Mac y Windows.
6. **Actualizar este documento**: «Estado actual» y una fila nueva en el historial.

## Dónde choca el fork con upstream

El fork mete su código en archivos propios (`config/fork/`, `src/shared/fork-global-settings-types.ts`,
`*fork*`, `pinned-favorites/`, `pinned-agents/`, `file-link-preview/`, proveedores `asana/` y `azure-devops/`, `new-workspace/multi-repo-*`).
Aun así hay enganches en código de upstream que conflictúan casi siempre:

| Área | Archivos de upstream con enganches del fork | Qué hace el fork ahí |
| --- | --- | --- |
| Identidad «Orca knwr» | `package.json`, `config/electron-builder.config.cjs`, `config/nsis/orca-installer-hooks.nsh`, `config/scripts/dev-electron-bundle-identity.mjs`, `src/cli/runtime/metadata.ts`, `src/main/cli/cli-install-location.ts`, `src/main/daemon/daemon-host-relocation.ts`, `src/main/macos-tcc-prompt-watch.ts`, almacenes de credenciales (`jira/site-credential-store.ts`, `zcode/zcode-plan-api-key-store.ts`, `codex/codex-home-paths.ts`) | Nombre, app id, carpeta de perfil y llaveros propios para instalarse junto a Orca |
| Actualizador y releases | `src/main/updater*.ts`, `src/main/updater/*`, `src/shared/release-channel.ts`, `.github/workflows/fork-release.yml`, `config/scripts/verify-packaged-daemon-entry.cjs` | Lee las releases de `hendrickcastro/orca`; Mac sin firmar, actualización desde el DMG |
| Ajustes | `src/shared/global-settings-types.ts`, `default-global-settings.ts`, `loading-store/normalize-loaded-global-settings.ts`, `prepare-loaded-profile-settings.ts` | Ajustes del fork y migraciones de una sola vez |
| Barra lateral / Fijados | `src/shared/sidebar-list/*` (antes `worktree-list/grouping/*`), `worktree-list/rows/*`, `WorktreeCard*.tsx`, `worktree-card-*` | Fijados como acceso directo, Favoritos, tareas multi-repo plegables, nombre del proyecto en Fijados |
| Chat y terminal | `CommentMarkdown.tsx`, `comment-markdown-*`, `NativeChatMarkdown.tsx`, `terminal-link-handlers.ts`, `App.tsx` | Enlaces a archivos por nombre y vista previa al pasar el ratón |
| Multi-repo y tareas | `AppRootSurfaces.tsx`, `NewWorkspaceComposerModal.tsx`, `quick-creation-execution.ts`, `task-source-context-summary.ts`, `task-page/*` | Tareas multi-repositorio, proveedores Asana y Azure DevOps |
| Vista de agentes fijados y subagentes | `AppWorkspaceShell.tsx`, `right-sidebar/index.tsx`, `right-sidebar-panel-content.tsx`, `AgentTerminalPreview.tsx`, `zoom-ipc-bridge.ts` | Vista central «Pinned agents», pestañas del panel derecho |
| Textos | `src/renderer/src/i18n/locales/en.json`, `es.json`, `en-runtime-required.json` | Claves propias del fork; conservar las de ambos lados |

## Historial

| Fecha | Upstream integrado | Commits traídos | Conflictos | Notas |
| --- | --- | --- | --- | --- |
| 2026-09-30 | `23a874a2a19` | — | — | Primera integración tras la feature multi-repo |
| 2026-10-13 | `e15b77aba3a` | 657 | — | PR #5 `Upgrade-from-parent-fork` |
| 2026-11-01 | `d95e2324dcd` | 4.603 | 63 | Ver «Decisiones» y «Novedades de upstream» abajo |

## Decisiones de la sincronización del 2026-11-01

- **Barra lateral movida a `src/shared/sidebar-list/`**: `build-rows.ts` pasó a `sidebar-row-plan.ts` (`planSidebarRows`). Favoritos y tareas multi-repo fijadas viven ahora en `shared/sidebar-list/pinned-favorites.ts`, `pinned-folder-workspaces.ts` y `pinned-task-rows.ts`; en el renderer solo queda el icono y la etiqueta (`sidebar/pinned-favorites/`).
- **Nombre del proyecto en Fijados**: retirado el del fork; upstream ya muestra su propia etiqueta de proyecto en las filas de Fijados.
- **Estado del coordinador multi-repo**: una sola suscripción compartida (`use-coordinated-worktree-activity-status.ts`) en vez de una por tarjeta, para no superar el presupuesto de rendimiento de upstream.
- **Registro de IPC del fork** en `src/main/ipc/register-core-handlers/register-fork-handlers.ts` y migraciones de ajustes del fork en `loading-store/fork-loaded-profile-settings.ts`: así los archivos de upstream no superan el máximo de líneas y apenas tienen enganches.
- **Clave de credenciales de orcad** (`orcadCredentialRoot`, nuevo en upstream) apunta a `~/.orca-knwr` para no compartir clave con Orca original.
- **Azure DevOps**: la verificación de organización usa la negociación de versión de API de upstream (baja de versión en servidores antiguos).
- **Retirado** `fork-claude-init-inventory-frame.test.ts`: upstream ya clasifica los frames por tipo y cubre ese caso.

### Pendiente

- **Móvil**: no muestra Favoritos ni tareas multi-repo fijadas agrupadas (el feed móvil no pasa esos datos); ve el Fijados de upstream.
- **Desinstalador de Windows**: el de upstream borra los hooks de agentes en `~/.orca/agent-hooks` si no detecta otra instalación, y esa carpeta la comparten Orca y Orca knwr. Orca los reinstala al arrancar.
- **Tests que ya fallaban en upstream** el 2026-11-01 (9, en `src/main/native-chat/agent-session-wire/structured-agent-session-*`): no son del fork.

## Novedades de upstream traídas el 2026-11-01

Resumen de los 360 commits `feat` (de 4.603: 2.184 fix, 337 refactor, 226 perf…):

- **Plugins y temas**: catálogo de plugins con contadores de instalación, paneles de plugin en TSX, marcos aislados activados por defecto, temas de app y de terminal en una sola lista, imágenes de fondo, tema de editor independiente, iconos por carpeta.
- **Habilidades (skills)**: las skills de Orca sin editar se actualizan solas; solo pregunta por las que has cambiado.
- **Chat nativo**: tarjetas de vista previa para enlaces web y para PRs/issues de GitHub, fecha completa al pasar por la hora, agentes de chat disponibles donde corra su programa.
- **Navegador integrado**: nueva pestaña con sugerencias, DevTools acoplado, perfiles por repo/workspace, zoom y apariencia por sitio, extensiones de Chrome, permisos de red local, agentes que manejan popups de login/pago, capturas guardadas como archivo.
- **Móvil**: rediseño de Inicio, hojas y listas; temas claro/oscuro; dictado con texto en vivo; app traducida; diagramas Mermaid e imágenes con zoom; soporte iPhone Duo.
- **Conectores (experimental, desactivado por defecto)**: Slack, Discord y Linear pueden iniciar y responder conversaciones con agentes.
- **WSL**: hosts WSL, mover proyectos a WSL, Git para Windows en proyectos de disco Windows, distros que se paran solas.
- **SSH y servidores**: reconectar al arrancar por host, redirecciones de puertos con diagnóstico, actualizar y recuperar servidores gestionados, abrir workspaces SSH en Cursor y Zed, cuentas Claude/Codex en el servidor remoto.
- **Editor**: visor de imágenes con zoom, vista previa de SVG, tipografía configurable, nuevos lenguajes (Groovy, CUDA, Glimmer, shebang).
- **Notificaciones y orquestación**: avisos de «necesita respuesta» separados de «terminado», latido de los workers configurable, `orca ports`, `tab create --split`.
