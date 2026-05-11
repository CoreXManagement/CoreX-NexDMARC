#!/usr/bin/env bash
# CoreX NexDMARC — In-place update from latest GitHub release
set -euo pipefail

REPO="${NEXDMARC_REPO:-CoreXManagement/CoreX-NexDMARC}"
INSTALL_DIR="${NEXDMARC_DIR:-/opt/corex-nexdmarc}"
SERVICE_USER="nexdmarc"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root (sudo) ausführen."
  exit 1
fi

cd "$INSTALL_DIR"
FROM_VERSION=$(node -e "console.log(require('$INSTALL_DIR/package.json').version)" 2>/dev/null || echo "?")

TARGET_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
if [[ -z "$TARGET_TAG" ]]; then
  echo "Kein Release-Tag gefunden."
  exit 1
fi
echo "==> Update von $FROM_VERSION auf $TARGET_TAG"

git -C "$INSTALL_DIR" fetch --tags --quiet
git -C "$INSTALL_DIR" reset --hard --quiet "$TARGET_TAG"

sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund"

PREBUILT_OK=0
ASSET_URL="https://github.com/${REPO}/releases/download/${TARGET_TAG}/nexdmarc-next-${TARGET_TAG}.tar.gz"
CHECKSUM_URL="https://github.com/${REPO}/releases/download/${TARGET_TAG}/nexdmarc-checksums-${TARGET_TAG}.txt"
if curl -fsSL -o /tmp/next-build.tgz "$ASSET_URL" 2>/dev/null; then
  VERIFIED=0
  if curl -fsSL -o /tmp/next-checksums.txt "$CHECKSUM_URL" 2>/dev/null; then
    EXPECTED=$(awk '{print $1}' /tmp/next-checksums.txt | head -n1)
    ACTUAL=$(sha256sum /tmp/next-build.tgz | awk '{print $1}')
    [[ "$EXPECTED" == "$ACTUAL" ]] && VERIFIED=1
    rm -f /tmp/next-checksums.txt
  fi
  if [[ $VERIFIED -eq 1 ]]; then
    rm -rf "$INSTALL_DIR/.next"
    sudo -u "$SERVICE_USER" -H tar -xzf /tmp/next-build.tgz -C "$INSTALL_DIR"
    PREBUILT_OK=1
  fi
  rm -f /tmp/next-build.tgz
fi
if [[ $PREBUILT_OK -eq 0 ]]; then
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"
fi

systemctl restart corex-nexdmarc
echo "==> Update fertig: $FROM_VERSION → $TARGET_TAG"
