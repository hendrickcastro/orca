#!/bin/bash
# Installs or updates Orca knwr on macOS from the latest fork release.
# Why the local re-sign: fork builds have no Apple Developer ID, so Gatekeeper blocks the
# downloaded app until its quarantine flag is cleared and it carries a local ad-hoc signature.
#
#   curl -fsSL https://github.com/hendrickcastro/orca/releases/latest/download/install-macos.sh | bash
set -euo pipefail

REPO="hendrickcastro/orca"
APP_NAME="Orca knwr.app"
case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) echo "Unsupported Mac architecture: $(uname -m)" >&2; exit 1 ;;
esac

WORK_DIR="$(mktemp -d)"
DMG="$WORK_DIR/orca-knwr.dmg"
MOUNT="$WORK_DIR/mount"
cleanup() {
  hdiutil detach "$MOUNT" -quiet 2>/dev/null || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "Downloading Orca knwr ($ARCH)..."
curl -fL --progress-bar \
  "https://github.com/$REPO/releases/latest/download/orca-knwr-macos-$ARCH.dmg" -o "$DMG"

echo "Mounting the disk image..."
mkdir -p "$MOUNT"
hdiutil attach "$DMG" -nobrowse -quiet -mountpoint "$MOUNT"

if pgrep -xq "Orca knwr"; then
  echo "Closing the running Orca knwr..."
  osascript -e 'quit app "Orca knwr"' 2>/dev/null || true
  sleep 3
fi

echo "Installing to /Applications..."
rm -rf "/Applications/$APP_NAME"
cp -R "$MOUNT/$APP_NAME" /Applications/
xattr -rc "/Applications/$APP_NAME"
codesign --force --deep --sign - "/Applications/$APP_NAME"

echo "Launching..."
open "/Applications/$APP_NAME"
echo "Done."
