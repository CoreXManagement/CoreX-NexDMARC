#!/usr/bin/env bash
# CoreX NexDMARC — One-line install
# Usage: curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexDMARC/main/scripts/install.sh | sudo bash

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root ausführen (sudo)."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Nur Debian/Ubuntu wird unterstützt."
  exit 1
fi

REPO="${NEXDMARC_REPO:-CoreXManagement/CoreX-NexDMARC}"
INSTALL_DIR="${NEXDMARC_DIR:-/opt/corex-nexdmarc}"
DATA_DIR="${NEXDMARC_DATA_DIR:-/var/lib/corex-nexdmarc}"
SERVICE_USER="nexdmarc"
APP_PORT="${NEXDMARC_PORT:-3000}"
NODE_MAJOR=20

echo "==> CoreX NexDMARC Install"
echo "    Repo:    $REPO"
echo "    Install: $INSTALL_DIR"
echo "    Data:    $DATA_DIR"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git debian-keyring debian-archive-keyring apt-transport-https sudo sqlite3

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -c2-3)" != "${NODE_MAJOR}" ]]; then
  echo "==> Node.js ${NODE_MAJOR} installieren"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Caddy installieren"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "==> User $SERVICE_USER anlegen"
  useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Latest Release ermitteln"
TARGET_TAG="${NEXDMARC_TAG:-}"
if [[ -z "$TARGET_TAG" ]]; then
  TARGET_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
fi
if [[ -z "$TARGET_TAG" ]]; then
  echo "    (kein Release gefunden — fallback main)"
  TARGET_REF="main"
else
  echo "    Tag: $TARGET_TAG"
  TARGET_REF="$TARGET_TAG"
fi

echo "==> Repo clonen / aktualisieren ($TARGET_REF)"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --tags --quiet
  git -C "$INSTALL_DIR" reset --hard --quiet "$TARGET_REF" 2>/dev/null || git -C "$INSTALL_DIR" reset --hard --quiet "origin/$TARGET_REF"
else
  rm -rf "$INSTALL_DIR"
  git clone --quiet "https://github.com/${REPO}.git" "$INSTALL_DIR"
  git -C "$INSTALL_DIR" checkout --quiet "$TARGET_REF" 2>/dev/null || true
fi

mkdir -p "$DATA_DIR"
chmod +x "$INSTALL_DIR/scripts/"*.sh
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"

echo "==> Dependencies installieren"
sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund"

echo "==> Prebuilt .next/ versuchen (SHA256-verifiziert)"
PREBUILT_OK=0
if [[ -n "$TARGET_TAG" ]]; then
  ASSET_URL="https://github.com/${REPO}/releases/download/${TARGET_TAG}/nexdmarc-next-${TARGET_TAG}.tar.gz"
  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${TARGET_TAG}/nexdmarc-checksums-${TARGET_TAG}.txt"
  if curl -fsSL -o /tmp/next-build.tgz "$ASSET_URL" 2>/dev/null; then
    VERIFIED=0
    if curl -fsSL -o /tmp/next-checksums.txt "$CHECKSUM_URL" 2>/dev/null; then
      EXPECTED=$(awk '{print $1}' /tmp/next-checksums.txt | head -n1)
      ACTUAL=$(sha256sum /tmp/next-build.tgz | awk '{print $1}')
      if [[ -n "$EXPECTED" && "$EXPECTED" == "$ACTUAL" ]]; then
        VERIFIED=1
        echo "    SHA256 verifiziert."
      else
        echo "    ⚠ SHA256-Mismatch — verwerfe Prebuilt."
      fi
      rm -f /tmp/next-checksums.txt
    fi
    if [[ $VERIFIED -eq 1 ]]; then
      sudo -u "$SERVICE_USER" -H tar -xzf /tmp/next-build.tgz -C "$INSTALL_DIR"
      PREBUILT_OK=1
      echo "    Prebuilt aus Release übernommen — Build übersprungen."
    fi
    rm -f /tmp/next-build.tgz
  fi
  if [[ $PREBUILT_OK -eq 0 ]]; then
    echo "    Kein verifiziertes Prebuilt — baue lokal."
  fi
fi
if [[ $PREBUILT_OK -eq 0 ]]; then
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"
fi

SERVER_IP=$(curl -s4 ifconfig.me || echo "")
NEXTAUTH_SECRET=$(openssl rand -hex 32)

echo "==> systemd Unit"
cat > /etc/systemd/system/corex-nexdmarc.service <<EOF
[Unit]
Description=CoreX NexDMARC
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=NEXDMARC_DATA_DIR=$DATA_DIR
Environment=NEXDMARC_UPDATE_SCRIPT=$INSTALL_DIR/scripts/update.sh
Environment=NEXTAUTH_SECRET=$NEXTAUTH_SECRET
Environment=NEXTAUTH_URL=http://$SERVER_IP
ExecStart=$INSTALL_DIR/node_modules/.bin/tsx $INSTALL_DIR/server.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/sudoers.d/corex-nexdmarc <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: $INSTALL_DIR/scripts/update.sh
EOF
chmod 0440 /etc/sudoers.d/corex-nexdmarc

echo "==> Caddy Bootstrap-Config"
if [[ ! -f /etc/caddy/Caddyfile.nexdmarc.bak ]]; then
  cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.nexdmarc.bak 2>/dev/null || true
fi
cat > /etc/caddy/Caddyfile <<EOF
{
  email admin@example.com
}

:80 {
  reverse_proxy localhost:$APP_PORT
}
EOF

echo "==> CLI nach /usr/local/bin/nexdmarc verlinken"
ln -sf "$INSTALL_DIR/bin/nexdmarc" /usr/local/bin/nexdmarc
chmod +x "$INSTALL_DIR/bin/nexdmarc"

systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
systemctl enable --now corex-nexdmarc

echo ""
echo "==> Fertig!"
echo ""
echo "    Setup unter:  http://${SERVER_IP}/setup"
echo "    CLI:          nexdmarc help"
echo "    Logs:         nexdmarc logs"
echo ""
echo "    DNS für DMARC-Reports:"
echo "    _dmarc.<deine-domain>  TXT  \"v=DMARC1; p=none; rua=mailto:dmarc@<dein-server>\""
echo ""
