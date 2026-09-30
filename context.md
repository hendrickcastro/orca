# Contexto de la feature multi-repositorio de Orca

Fecha: 30 de septiembre de 2026.
Estado: primera implementación integrada en `hendrickcastro/orca:main`.
Este documento describe lo implementado y la evidencia disponible; no convierte las capacidades pendientes en funcionalidades existentes.

## 1. Objetivo y necesidad

Trabajar una misma feature de frontend y backend con un único agente que conozca ambos repositorios, manteniendo las herramientas de Orca para worktrees, sesiones y operaciones Git.

Los repositorios son independientes y pueden estar en carpetas o discos distintos, por ejemplo:

- Frontend: `D:\WebProjects\frontend`.
- Backend: `E:\Services\backend`.

No se debe exigir moverlos a una carpeta padre, convertirlos en monorepo ni permitir que dos agentes inventen contratos incompatibles sin contexto compartido. El usuario quiere aprovechar Orca, no sustituirlo por una terminal externa.

La solución implementada crea worktrees para la tarea y proporciona sus rutas a un único Claude Code. El prompt pide revisar productores y consumidores de la API antes de editar. No existe un validador automático de contratos ni una garantía de consistencia: las pruebas de integración de cada producto siguen siendo necesarias.

## 2. Repositorios, ramas e historial

| Elemento | Referencia |
| --- | --- |
| Repositorio original | https://github.com/stablyai/orca |
| Fork del usuario | https://github.com/hendrickcastro/orca |
| Rama de desarrollo | `feat/multi-repo-feature-workspaces` |
| Rama del fork con la feature integrada | `main` |
| Commit inicial publicado | `d88253b0f83ece5bef58caa59196946092a3ccca` |
| Actualización upstream integrada | `23a874a2a19b5e95f59647761836a7a11547eec7` |
| Merge publicado e integrado en main | `9b17b47d15d0af3d85b40e89ac75f6c9b6739407` |

El merge conservó la historia de la feature y la de upstream. No se hizo force push ni se sustituyeron nuestros cambios por el árbol original.

Se intentó abrir un PR hacia el repositorio original, pero la integración de GitHub devolvió `403 Resource not accessible by integration`. **No quedó creado un PR upstream por esa operación.** No inventar un número de PR.

## 3. Solicitud relacionada en upstream

https://github.com/stablyai/orca/issues/21118

Título: **[Feature]: Multi-repo workspaces with per-workspace worktrees (VS Code-style multi-root)**.
Creada el 17 de septiembre de 2026. Estaba abierta al consultarla el 30 de septiembre.

Solicita worktrees por repositorio para una tarea, un coordinador con acceso conjunto y vistas unificadas de archivos, búsqueda y cambios.

Nuestra implementación cubre parcialmente esa petición: creación coordinada y acceso del agente. **No implementa el explorador, búsqueda ni diffs agregados.** No usar `Fixes #21118` como si estuviera completamente resuelta.

## 4. Cómo se usa

1. Añadir a Orca los repositorios locales con el flujo de importación existente.
2. En la parte inferior de la barra lateral izquierda, pulsar el icono de carpeta con un signo +.
3. El tooltip y el diálogo se llaman **New multi-repository feature**.
4. Seleccionar al menos dos repositorios.
5. Rellenar:
   - **Feature name**: nombre visible de la tarea.
   - **New branch in every repository**: nombre de rama nuevo compartido.
   - **What should Claude implement?**: petición completa para los repositorios.
6. Pulsar **Create and start Claude**.

Ejemplo: nombre `Buscador de usuarios`, rama `feature/buscador-usuarios`, petición que describa tanto el endpoint del backend como su consumidor frontend.

Claude Code debe estar instalado, accesible y autenticado en el ordenador. El arranque utiliza la configuración de agente existente de Orca.

El botón pertenece a la barra lateral; no se añadió este flujo al diálogo habitual de creación de workspace.

## 5. Arquitectura y reutilización

El hallazgo clave durante la implementación fue que Orca ya dispone de grupos, folder workspaces y relaciones entre workspaces. Se reutilizan esas APIs y su representación existente en vez de crear un segundo sistema de persistencia.

| Pieza | Función |
| --- | --- |
| ProjectGroup | Agrupación de la tarea en Orca. |
| FolderWorkspace | Workspace del coordinador; termina apuntando al primer worktree. |
| Worktree por repositorio | Aislamiento Git y rama de feature en cada repositorio. |
| parentWorkspace / lineage | Vincula cada worktree con el workspace del coordinador. |
| Notas del FolderWorkspace | Guarda el prompt y las rutas de los miembros confirmados. |
| Claude con --add-dir | Proporciona contexto de directorios para todos los worktrees. |

No hay una nueva entidad persistida de tipo MultiRepoWorkspace ni nuevos canales IPC. La clase de creación compone operaciones ya existentes.

El grupo se crea inicialmente con `parentPath` del primer repositorio. Esto no significa que los demás repositorios deban ser descendientes de esa carpeta. Se relacionan mediante los identificadores de workspace y sus rutas reales.

## 6. Archivos de implementación

| Archivo | Responsabilidad |
| --- | --- |
| `src/renderer/src/components/sidebar/SidebarToolbar.tsx` | Botón de entrada y apertura del diálogo. |
| `src/renderer/src/components/new-workspace/MultiRepoWorkspaceDialog.tsx` | Selección, formulario, progreso, errores y reintento. |
| `src/renderer/src/lib/multi-repo-workspace-creation.ts` | Validación, creación secuencial, seguimiento de miembros y notas. |
| `src/renderer/src/lib/multi-repo-coordinator-launch.ts` | Resolución del shell, actualización del store y activación del coordinador. |
| `src/shared/multi-repo-coordinator-startup.ts` | Construcción del comando Claude y argumentos literales. |
| `docs/reference/multi-repository-features.md` | Guía breve de uso, recuperación y alcance. |

Antes de editar, leer `AGENTS.md` y, para interfaz, `docs/STYLEGUIDE.md`. Reutilizar componentes y servicios existentes. Mantener la consideración de Windows, macOS, Linux, SSH y folder workspaces sin afirmar soporte no implementado.

## 7. Flujo de creación en detalle

`MultiRepoRequest` contiene nombre, rama, lista de repositorios y prompt.
`MultiRepoMember` contiene el repositorio y el worktree confirmado.

El constructor de `MultiRepoWorkspaceCreation`:

- Exige nombre y rama no vacíos.
- Exige al menos dos IDs de repositorio distintos.
- Rechaza repositorios no elegibles.
- Recorta nombre y rama y copia los objetos de repositorio.

El diálogo también exige un prompt no vacío. No confundir esa validación de interfaz con una validación adicional del constructor.

`create()` realiza:

1. Crear el grupo si aún no existe.
2. Crear el folder workspace si aún no existe.
3. Obtener la clave con `folderWorkspaceKey(workspace.id)`.
4. Recorrer los repositorios secuencialmente, omitiendo miembros ya confirmados.
5. Crear cada worktree con:
   - `branchNameOverride`: rama solicitada.
   - `baseBranch`: `repo.worktreeBaseRef`.
   - `parentWorkspace`: clave del coordinador.
   - `displayNameKind: 'user'`.
   - `setupDecision: 'skip'`.
6. Registrar cada resultado confirmado en `members`.
7. Actualizar `folderPath` al primer worktree y `comment` con el prompt/rutas.
8. Repetir la escritura final de metadatos para poder reparar una escritura fallida al reintentar.

La ubicación física de cada worktree la determina el mecanismo existente de Orca. No se introduce una carpeta común obligatoria ni se cambia la ubicación original de los repositorios.

## 8. Coordinador y argumentos de Claude

`launchMultiRepoCoordinator()` comprueba que existan el workspace y todos los miembros antes del lanzamiento.

Resuelve el shell mediante `resolveLocalWindowsAgentStartupShell`; toma PowerShell como alternativa en Windows y POSIX fuera de Windows. Rechaza explícitamente la selección de shell WSL contemplada por su comprobación.

Respeta `settings.agentCmdOverrides.claude`. Refresca grupos, folder workspaces, worktrees y lineage; después activa el workspace mediante `activateAndRevealFolderWorkspace`, pasando el plan de arranque y un token nuevo.

El comando resultante equivale conceptualmente a:

```text
claude --add-dir "<worktree-front>" --add-dir "<worktree-back>" -- "<prompt>"
```

El quoting real depende del shell y se obtiene con `quoteStartupArg`.

**Hallazgo importante:** `--add-dir` puede consumir argumentos adicionales. El separador `--` evita que el prompt se trate como otra carpeta. Las rutas con espacios, apóstrofes, dólares o backticks deben conservarse literalmente, sin ejecutarse ni expandirse.

El prompt incluye un bloque JSON de nombre de repositorio, ruta del worktree y rama. Pide:

- Trabajar en los worktrees de feature.
- Leer las instrucciones de cada repositorio.
- Examinar productores y consumidores de la API.
- Acordar rutas, métodos, estructuras de request/response y errores.
- Verificar la integración y mantener Git separado por repositorio.
- No hacer merge, push ni PR salvo petición.

Estas son instrucciones al agente, no un sandbox de filesystem. `--add-dir` no elimina las políticas de permisos de Claude. Tampoco se crean subagentes automáticamente.

## 9. Recuperación y límites de atomicidad

El diálogo bloquea envíos duplicados y mantiene la instancia de creación en un ref. Una vez iniciada la creación, bloquea los campos para que un reintento conserve la misma solicitud.

Si falla un repositorio posterior, los worktrees confirmados se conservan. **Retry remaining steps** continúa desde ese estado mientras el diálogo permanece abierto.

Si falla el lanzamiento después de crear los worktrees, se pueden reintentar los pasos restantes sin recrear los miembros confirmados.

Cerrar el diálogo o reiniciar Orca pierde el estado de reintento en memoria. Permanecen los datos persistidos y las notas que se hayan guardado correctamente. No se implementó un gestor persistente de operaciones incompletas.

No existe una transacción atómica entre todos los repositorios. La recuperación cubre resultados confirmados; no debe asumirse idempotencia frente a un fallo ambiguo ocurrido después de que el servidor cree algo pero antes de devolver su respuesta.

No hay rollback destructivo automático, limpieza conjunta ni commits atómicos entre repositorios.

## 10. Alcance actual y pendientes

Implementado:

- Dos o más repositorios Git locales en rutas independientes.
- Una rama con el nombre solicitado en cada worktree, usando la base propia de cada repositorio.
- Un coordinador Claude con acceso a todos los worktrees.
- Relaciones y herramientas Git existentes por repositorio.
- Progreso, errores y reintento de pasos confirmados.

No implementado:

- SSH, runtimes remotos o repositorios WSL.
- Directorios sin Git como miembros.
- Explorador multi-root, búsqueda conjunta o panel de diffs agregado.
- Otros agentes como coordinador seleccionable.
- Ejecución de setup scripts durante este flujo.
- Recuperación persistente del proceso de creación tras reinicio.
- Orquestación automática de varios agentes ni verificación automática de contratos API.

La selección local comprueba `repo.kind`, `connectionId`, el host de ejecución y rutas UNC de WSL. No ampliar soporte remoto simplemente quitando esas guardas: requiere diseño de ejecución, rutas, permisos y recuperación por host.

## 11. Pruebas y evidencia

| Archivo de pruebas | Cobertura |
| --- | --- |
| `src/renderer/src/lib/multi-repo-workspace-creation.test.ts` | Bases por repo, lineage, reintento, metadatos, hosts y prompt. |
| `src/renderer/src/lib/multi-repo-workspace-real-git.test.ts` | Dos repos Git reales, aislamiento de originales y normalización del workspace. |
| `src/shared/multi-repo-coordinator-startup.test.ts` | Argumentos PowerShell/cmd/POSIX, caracteres especiales y shell POSIX real. |
| `src/renderer/src/components/new-workspace/MultiRepoWorkspaceDialog.test.tsx` | Validación de formulario, selección local, orden de lanzamiento y fallo/reintento. |
| `src/renderer/src/lib/multi-repo-workspace-test-fixtures.ts` | Fixtures compartidas para las pruebas. |

Resultados registrados:

- 15 pruebas en 4 archivos pasan; se repitieron después de integrar upstream.
- Typecheck frontend y gate de calidad de cambios pasaron antes del merge upstream.
- Typecheck frontend después del merge terminó con código 137; no se afirma que pasara.
- Typecheck Node también fue terminado con código 137 en este entorno.
- El wrapper habitual de tests falló preparando node-pty por un error de extracción/fchown de node-gyp. Las pruebas focalizadas se ejecutaron directamente con Vitest.
- No hubo validación visual completa de Electron ni una sesión real de Claude de extremo a extremo por parte del agente.
- El usuario confirmó que arrancó la aplicación en Windows. No equivale a verificar todos los flujos.
- El usuario encontró un fallo de empaquetado por dependencias móviles ausentes; se dio la corrección detallada abajo. No consta en este documento una prueba completa del instalador final.

Comando de pruebas focalizadas en PowerShell:

```powershell
$env:ORCA_BACKGROUND_LAUNCH = "1"
pnpm.cmd exec vitest run --config config/vitest.config.ts src/renderer/src/lib/multi-repo-workspace-creation.test.ts src/renderer/src/lib/multi-repo-workspace-real-git.test.ts src/shared/multi-repo-coordinator-startup.test.ts src/renderer/src/components/new-workspace/MultiRepoWorkspaceDialog.test.tsx
Remove-Item Env:ORCA_BACKGROUND_LAUNCH
```

La prueba con Git real usa fixtures que invocan Git; no sustituye una prueba del flujo IPC completo de Electron.

## 12. Instalación y compilación en Windows

Ruta de trabajo del usuario: `D:\_ALGORITXIA\orca`.
El package.json consultado declara Node.js 24 y pnpm 12.0.0.
Los módulos nativos pueden necesitar Python 3 y Visual Studio Build Tools con desarrollo de escritorio C++.

Para clonar desde cero:

```powershell
Set-Location D:\_ALGORITXIA
git clone https://github.com/hendrickcastro/orca.git
Set-Location .\orca
npm install -g pnpm@12.0.0
```

Para actualizar un clon existente sin cambios locales incompatibles:

```powershell
Set-Location D:\_ALGORITXIA\orca
git fetch origin
git switch main
git pull --ff-only origin main
```

Instalar **ambos** conjuntos de dependencias:

```powershell
Set-Location D:\_ALGORITXIA\orca
pnpm.cmd install --frozen-lockfile
Set-Location .\mobile
pnpm.cmd install --frozen-lockfile
Set-Location ..
```

`mobile/` tiene workspace y lockfile propios y está excluido de la instalación raíz. El empaquetado de escritorio incluye su bundle web, aunque el destino sea Windows.

Desarrollo:

```powershell
pnpm.cmd dev
```

Compilar y abrir la compilación:

```powershell
pnpm.cmd build
pnpm.cmd start
```

Generar instalador:

```powershell
pnpm.cmd build:win
```

Ejecutar los comandos uno a uno y continuar solo si el anterior termina correctamente.

Ubicación esperada del instalador: `dist\orca-windows-setup.exe`.
El directorio desempaquetado habitual es `dist\win-unpacked\`.
`pnpm dev` no genera instalador.

## 13. Incidencias de compilación observadas

### Ventana emergente y ausencia de ejecutable

El usuario observó que el proceso se mostraba en otra ventana. Eso por sí solo no demuestra un problema del lanzador ni una compilación correcta. Se sugirió usar `pnpm.cmd` y guardar logs para ver el final.

```powershell
pnpm.cmd build:win *> .\build-win.log
Get-Content .\build-win.log -Tail 60
```

### 426 errores de dependencias móviles

El log llegó hasta la compilación del bundle móvil y mostró errores de resolución de `react-native-web`, `expo-router` y `react-native-safe-area-context`.

Causa identificada: faltaba instalar las dependencias del workspace `mobile/`.
Solución: ejecutar allí `pnpm.cmd install --frozen-lockfile` y repetir `pnpm.cmd build:win` desde la raíz.

El aviso de chunks mayores de 500 kB no era el error que detenía esa compilación.

Para localizar ejecutables generados:

```powershell
Get-ChildItem .\dist -Filter *.exe -Recurse -ErrorAction SilentlyContinue |
    Select-Object FullName, LastWriteTime
```

## 14. Sincronización diaria y detección de soporte nativo

Se configuró una automatización de ChatGPT para sincronizar `stablyai/orca:main` hacia `hendrickcastro/orca:main`, diariamente alrededor de las 08:00, zona Europe/Madrid, a partir del 1 de octubre de 2026.

**No es un workflow de GitHub Actions ni código incluido en este repositorio.** Depende del servicio de automatizaciones y de su acceso a GitHub.

Instrucciones de la rutina:

- Preservar las modificaciones del fork.
- Usar merge o fast-forward, nunca reset ni force push.
- Si hay conflictos o verificaciones bloqueadas, avisar sin publicar una resolución incierta.
- Revisar si upstream incorpora soporte equivalente a nuestra feature.
- Confirmar la implementación en código/PRs fusionados; una issue cerrada no basta.
- Avisar de soporte parcial o completo con enlaces y explicar qué falta.
- No retirar automáticamente nuestra implementación.

## 15. Continuación recomendada

1. Validar el instalador y el flujo real en Windows con dos repositorios de prueba.
2. Capturar evidencia visual antes/después para un eventual PR upstream.
3. Ejecutar las comprobaciones completas de tipos, lint, tests y build en un entorno adecuado.
4. Revisar fallos ambiguos, persistencia de recuperación y el comportamiento al reabrir sesiones.
5. Evaluar mejoras de UX y localización siguiendo las convenciones actuales del proyecto.
6. Considerar soporte remoto o explorador agregado como trabajos separados.
7. Antes de ampliar o retirar esta feature, comparar con el estado actual de upstream y la issue #21118.

Este documento es contexto técnico y de continuidad, no sustituye las instrucciones de AGENTS.md ni autoriza a borrar cambios del usuario o a publicar modificaciones futuras sin atender a la petición vigente.
