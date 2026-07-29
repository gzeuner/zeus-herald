<p align="center">
  <img
    src="docs/assets/zeus-herald-hero.png"
    alt="Zeus Herald - local camera motion detection and mobile notifications"
    width="100%">
</p>

<p align="center">
  <strong>Deutsch</strong> ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/gzeuner/zeus-herald/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/gzeuner/zeus-herald?include_prereleases"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue"></a>
  <a href="https://github.com/gzeuner/zeus-herald/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/gzeuner/zeus-herald/actions/workflows/ci.yml/badge.svg"></a>
</p>

# Zeus Herald

Zeus Herald ist ein lokal betreibbarer Node.js-Dienst, der Kamera-Snapshots abruft, Bildbewegungen erkennt und akzeptierte Ereignisbilder ueber Telegram, ntfy oder beide Kanaele an mobile Geraete sendet.

Das Projekt ist der schlanke Nachfolger fuer Setups, die bisher auf `upcam-client`, SnapShotter oder WhatsApp-Web-Automation basierten. Zeus Herald verwendet offizielle HTTP/APIs, speichert Laufzeitdaten lokal und behandelt Zugangsdaten ausschliesslich ueber private Umgebungsvariablen.

A tiny-tool.de / TT utility.

## Warum Zeus Herald?

- Lokal betreibbar, ohne Cloud-Zwang fuer Kameraauswertung.
- Keine Browser-Automation, kein WhatsApp Web, kein Chromium-Prozess.
- Pixelbasierte JPEG-Auswertung statt reiner Byte-Stream-Vergleiche.
- Telegram Bot API und ntfy als unabhaengige Benachrichtigungskanaele.
- Gemeinsame Bildkompression vor der Uebertragung.
- Prozesssperren gegen doppelte `ingest`- oder `motion`-Worker.
- Konfigurierbares Cleanup fuer Bilder und Logs.
- Optionales ZIP-Deployment ohne `node_modules`.

## Funktionsweise

```text
Kamera
  -> npm run ingest
  -> images/received/
  -> npm run motion
  -> JPEG dekodieren, skalieren, zuschneiden, ROI anwenden, Pixel vergleichen
  -> images/filtered/ oder images/sent/
  -> Notifier Hub
  -> Telegram, ntfy oder beide
```

`ingest` und `motion` laufen bewusst als getrennte Prozesse. Die Bewegungserkennung entscheidet einmal pro Frame; alle aktivierten Notifier erhalten danach dasselbe komprimierte Bild.

## Funktionen

- Reolink-Snapshot-Ingest ueber HTTP-API inklusive optionaler Burst-Aufnahmen.
- Optionale UpCam-Snapshot-Unterstuetzung.
- Lokale Ordnerkonvention fuer empfangene, gefilterte und gesendete Bilder.
- JPEG-Dekodierung mit Resize, Crop, ROI-Polygonen und Grauwert-Pixelvergleich.
- Event-Bestaetigung, Cooldown und maximale Sendungen pro Ereignis.
- Telegram-Foto-Versand ueber Bot API.
- ntfy-Bildversand ueber HTTP PUT.
- One-shot-Versand des neuesten Bildes.
- Telegram-Chat-ID-Helfer fuer private Chats oder private Gruppen.
- Zentrale JPEG-Kompression vor Telegram-/ntfy-Upload.
- Health-Datei, strukturierte Logs und Decision-Sidecars.
- Prozess-Locks fuer Dauerprozesse.
- Konfigurierbares Runtime-Cleanup.
- ZIP-Paket fuer Deployment auf ein Zielsystem.

## Voraussetzungen

- Node.js 20 oder neuer.
- Eine vom Rechner erreichbare Kamera mit Snapshot-Endpunkt.
- Optional Telegram fuer Bot-Benachrichtigungen.
- Optional ntfy fuer topicbasierte Benachrichtigungen.
- Fuer Windows-Dauerbetrieb optional NSSM oder ein vergleichbarer Service-Wrapper.

## Schnellstart

```bash
git clone https://github.com/gzeuner/zeus-herald.git
cd zeus-herald
npm install
cp .env.example .env
```

Danach `.env` lokal bearbeiten. Verwende nur neutrale Platzhalter in Dokumentation und Commits.

```bash
npm run lint
npm test
npm run check:banned
```

Erste Funktionstests:

```bash
npm run ingest:once
npm run notify:latest
npm run motion:once
```

## Basiskonfiguration

Die wichtigsten Variablengruppen in `.env` sind:

- Kamera-Ingest: `CAMERA_TYPE`, `INGEST_TARGET_DIR`, `REOLINK_*`, optional `UPCAM_*`.
- Bewegungserkennung: `MOTION_*`, insbesondere Schwellwerte, ROI und Ordner.
- Benachrichtigung: `TELEGRAM_*`, `NTFY_*`.
- Bildkompression: `NOTIFIER_IMAGE_*`.
- Cleanup: `CLEANUP_*`.
- Laufzeit: Queue-, Timeout-, Health- und Decision-Log-Werte.

Details stehen in [docs/CONFIGURATION.md](docs/CONFIGURATION.md). Die vollstaendige neutrale Vorlage ist [.env.example](.env.example).

## Betrieb

Dauerbetrieb erfolgt mit zwei Prozessen:

```bash
npm run ingest
```

```bash
npm run motion
```

Nuetzliche Einzelbefehle:

```bash
npm run ingest:once
npm run motion:once
npm run notify:latest
npm run telegram:chat-id
npm run deploy:zip
```

Details zu Health-Datei, Decision-Sidecars, Prozess-Locks, Cleanup, ZIP-Deployment, NSSM und Updates stehen in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Sicherheit

- `.env` niemals committen oder veroeffentlichen.
- Bot-Tokens, Chat-IDs, ntfy-Topics, Passwoerter und echte Kameraadressen nicht dokumentieren.
- Ein ntfy-Topic auf `ntfy.sh` ist ohne zusaetzliche Authentifizierung im Wesentlichen ein geteiltes Geheimnis. Fuer staerkere Zugriffskontrolle einen privaten oder selbst gehosteten ntfy-Server mit Token verwenden.
- Private Telegram-Gruppen koennen fuer Benachrichtigungen an mehrere Personen genutzt werden. Die Zielgruppe wird ueber `TELEGRAM_CHAT_ID` konfiguriert.
- ZIP-Deployments enthalten standardmaessig die lokale `.env`; solche ZIP-Dateien privat behandeln und nicht in Cloud- oder Public-Storage ablegen.
- Runtime-Daten wie `images/`, `logs/`, `state/`, `.lock/` und `dist/` gehoeren nicht ins Repository.

## Projektstruktur

```text
src/                         Anwendungscode
src/ingest/                  Kamera-Snapshot-Ingest
src/motion/                  Bewegungserkennung und Routing
src/notifiers/               Telegram, ntfy und gemeinsamer Notifier-Code
scripts/                     Wartungs- und Deployment-Skripte
test/                        Node.js-Tests
docs/                        Projekt-, Konfigurations- und Betriebsdokumentation
docs/assets/                 Branding- und README-Assets
.github/workflows/ci.yml     GitHub Actions CI
```

## Entwicklung und Qualitaetssicherung

```bash
npm run lint
npm test
npm run check:banned
git diff --check
```

Die Tests verwenden den Node.js-Test-Runner. Der Banned-Stack-Check verhindert die Wiedereinfuehrung von WhatsApp-Web-, Puppeteer- oder Playwright-Runtime-Abhaengigkeiten.

## Migration

Hinweise fuer Nutzer frueherer `upcam-client`- oder SnapShotter-Setups stehen in [docs/MIGRATION.md](docs/MIGRATION.md).

## Lizenz

Zeus Herald ist unter der [MIT License](LICENSE) veroeffentlicht.
