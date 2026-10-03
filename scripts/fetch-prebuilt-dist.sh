#!/usr/bin/env bash
# HomePiBoard: Vorgebautes Frontend (dist/) von GitHub laden.
#
# Der Workflow .github/workflows/build.yml baut bei jedem Push auf main das
# Frontend und hängt es als "homepiboard-dist.tar.gz" an das Release
# "build-latest". Dieses Skript lädt das Paket und installiert es nur, wenn es
# exakt zum aktuell ausgecheckten Commit passt. So entfällt auf dem Pi das
# langsame und speicherhungrige `npm install && npm run build`.
#
# Exit-Code 0 = vorgebautes Frontend installiert, sonst lokal bauen.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR" || exit 1

if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
  echo "ℹ curl oder tar fehlt – baue lokal."
  exit 1
fi

COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
if [ -z "$COMMIT" ]; then
  echo "ℹ Kein Git-Repository – baue lokal."
  exit 1
fi

# GitHub-Repo aus dem origin-Remote ableiten (funktioniert auch für Forks)
REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
REPO_SLUG="$(printf '%s' "$REMOTE_URL" | sed -nE 's#^(https://|git@)github\.com[:/]([^/]+/[^/]+)/?$#\2#p' | sed -E 's#\.git$##')"
REPO_SLUG="${HOMEPIBOARD_REPO:-${REPO_SLUG:-Schello805/HomePiBoard}}"
ASSET_URL="https://github.com/${REPO_SLUG}/releases/download/build-latest/homepiboard-dist.tar.gz"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! curl -fsSL --retry 2 --connect-timeout 10 --max-time 90 -o "$TMP_DIR/dist.tar.gz" "$ASSET_URL"; then
  echo "ℹ Kein vorgebautes Frontend verfügbar – baue lokal."
  exit 1
fi

mkdir -p "$TMP_DIR/extract"
if ! tar -xzf "$TMP_DIR/dist.tar.gz" -C "$TMP_DIR/extract"; then
  echo "ℹ Vorgebautes Frontend beschädigt – baue lokal."
  exit 1
fi

BUILD_COMMIT="$(cat "$TMP_DIR/extract/dist/.build-commit" 2>/dev/null || true)"
if [ "$BUILD_COMMIT" != "$COMMIT" ]; then
  BUILD_SHORT="${BUILD_COMMIT:0:7}"
  echo "ℹ Vorgebautes Frontend gehört zu einer anderen Version (${BUILD_SHORT:-unbekannt} statt ${COMMIT:0:7}) – baue lokal."
  exit 1
fi

if [ ! -f "$TMP_DIR/extract/dist/index.html" ]; then
  echo "ℹ Vorgebautes Frontend unvollständig – baue lokal."
  exit 1
fi

rm -rf "$APP_DIR/dist.new" "$APP_DIR/dist.old"
mv "$TMP_DIR/extract/dist" "$APP_DIR/dist.new" || exit 1
if [ -d "$APP_DIR/dist" ]; then
  mv "$APP_DIR/dist" "$APP_DIR/dist.old" || exit 1
fi
if ! mv "$APP_DIR/dist.new" "$APP_DIR/dist"; then
  [ -d "$APP_DIR/dist.old" ] && mv "$APP_DIR/dist.old" "$APP_DIR/dist"
  exit 1
fi
rm -rf "$APP_DIR/dist.old"

echo "✓ Vorgebautes Frontend für ${COMMIT:0:7} installiert (kein lokaler Build nötig)."
exit 0
