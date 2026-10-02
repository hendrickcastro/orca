#!/bin/bash
# Writes the Markdown notes of a fork release: what the fork added since the previous release,
# and the upstream (stablyai/orca) commits that came in through syncs.
#
#   release-notes.sh <previous-tag|""> <head-sha> <upstream-ref> <repo> > notes.md
set -euo pipefail

PREVIOUS_TAG="${1:-}"
HEAD_SHA="$2"
UPSTREAM_REF="$3"
REPO="$4"

upstream_in_head="$(git merge-base "$HEAD_SHA" "$UPSTREAM_REF")"
if [[ -n "$PREVIOUS_TAG" ]] && git rev-parse -q --verify "refs/tags/$PREVIOUS_TAG" >/dev/null; then
  base="$PREVIOUS_TAG"
else
  # First release: everything the fork has on top of upstream.
  base="$upstream_in_head"
fi

# Fork-only commits: in this release, not in upstream.
fork_commits="$(git log --no-merges --format='%s%x09%h' "$base..$HEAD_SHA" --not "$UPSTREAM_REF")"
# Upstream commits merged since the previous release.
upstream_commits="$(git log --no-merges --format='%s%x09%h' "$base..$upstream_in_head" 2>/dev/null || true)"

section() {
  local title="$1" grep_flags="$2" pattern="$3" lines
  lines="$(grep "$grep_flags" "$pattern" <<<"$fork_commits" || true)"
  if [[ -n "$lines" ]]; then
    echo "### $title"
    while IFS=$'\t' read -r subject sha; do
      echo "- ${subject} ([${sha}](https://github.com/${REPO}/commit/${sha}))"
    done <<<"$lines"
    echo
  fi
}

echo "## Novedades de esta versión"
echo
if [[ -z "$fork_commits" ]]; then
  echo "Sin cambios propios del fork en esta versión."
  echo
else
  section "Nuevas funciones" -E '^feat(\(|:)'
  section "Correcciones" -E '^fix(\(|:)'
  section "Otros cambios" -vE '^(feat|fix)(\(|:)'
fi

if [[ -n "$upstream_commits" ]]; then
  count="$(wc -l <<<"$upstream_commits" | tr -d ' ')"
  echo "### Sincronizado con stablyai/orca (${count} cambios)"
  echo
  echo "<details><summary>Ver la lista</summary>"
  echo
  while IFS=$'\t' read -r subject sha; do
    echo "- ${subject} (${sha})"
  done <<<"$upstream_commits"
  echo
  echo "</details>"
  echo
fi

echo "## Instalación"
echo
echo "**macOS** (build sin firma), instalar o actualizar con:"
echo
echo '```'
echo "curl -fsSL https://github.com/${REPO}/releases/latest/download/install-macos.sh | bash"
echo '```'
echo
echo "**Windows**: ejecuta \`orca-knwr-windows-setup.exe\`; las instalaciones existentes se actualizan solas desde la app."
