# CoreX NexDMARC

Self-hosted DMARC-Report-Aggregator mit eingebautem Mail-Security-Check. Holt DMARC-Aggregate-Reports per IMAP aus einem Postfach, parst sie, visualisiert sie im Dashboard und alarmiert bei Fail-Spikes. Plus Live-DNS-Audit pro Domain (SPF / DKIM / DMARC / MTA-STS / TLS-RPT / BIMI / DNSSEC / PTR / Open-Relay / DNSBL) mit Klartext-Erklärungen für Nicht-Profis.

## Features

- **One-Line Install** auf Debian/Ubuntu (Caddy + Node + systemd)
- **IMAP-Pull**: holt sich DMARC-Reports alle 5 Minuten ausm Postfach
- **DMARC-Parser**: aggregate XML (.xml / .xml.gz / .zip), RFC 7489
- **Dashboard**: Total Volume + Sparkline, Top Sources (rDNS), Reporting Orgs, Header-From, Country-Map, SPF/DKIM/DMARC-Alignment Donuts, Pass/Fail Time-Series
- **Mail-Security-Check** pro Domain: SPF, DKIM-Selectors, DMARC, MTA-STS, TLS-RPT, BIMI, DNSSEC, MX-PTR, Open-Relay-Test, DNSBL-Lookup
- **Klartext-Erklärungen** + Copy-Paste-Fixes für Laien
- **Alarme**: Mail + Webhook (Slack/Discord/ntfy/Ticket) bei Fail-Spike, neuer Source, Volume-Spike, Policy-Drift
- **REST-API** mit Token-Auth
- **Multi-Domain / Multi-User**
- **Self-Update** via GitHub-Releases
- **Auto-HTTPS** via Caddy

## Installation

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexDMARC/main/scripts/install.sh | sudo bash
```

Setup unter `http://<server-ip>/setup`.

## DNS-Setup für DMARC-Reports

Pro überwachter Domain im DNS:

```
_dmarc.example.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@dein-server"
```

`dmarc@dein-server` ist das Postfach, das NexDMARC per IMAP abholt.

## Stack

- Next.js 15 + TypeScript + TailwindCSS + Radix UI + Recharts
- better-sqlite3 (`/var/lib/corex-nexdmarc/nexdmarc.db`)
- Caddy (Auto-HTTPS)
- imapflow + mailparser + fast-xml-parser

## Lokale Entwicklung

```bash
git clone https://github.com/CoreXManagement/CoreX-NexDMARC
cd CoreX-NexDMARC
npm install
npm run dev
```

Setup unter `http://localhost:3000/setup`.

## Lizenz

[MIT](LICENSE)
