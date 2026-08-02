# Betrieb

Diese Datei beschreibt den Betrieb von Zeus Herald auf einem Zielsystem. Sie enthaelt keine Zugangsdaten und keine privaten Pfade.

## Prozessmodell

Zeus Herald nutzt fuer den Kamera-Flow zwei getrennte Prozesse:

```bash
npm run ingest
```

```bash
npm run motion
```

`ingest` ruft Kamera-Snapshots ab und schreibt sie in `images/received/`. Bei Reolink kann vorher der kameraeigene Motion-State abgefragt werden; eigene Snapshots werden dann nur waehrend eines Kameraalarms als Burst gespeichert. `motion` verarbeitet neue Bilder, liest optionale Ingest-Sidecars, verschiebt sie nach `images/filtered/` oder `images/sent/` und sendet akzeptierte Frames ueber den Notifier Hub.

## Single-Shot-Kommandos

```bash
npm run ingest:once
npm run motion:once
npm run notify:latest
npm run telegram:chat-id
```

- `ingest:once` prueft den Kameraabruf.
- `motion:once` verarbeitet vorhandene Eingangsframes einmalig.
- `notify:latest` sendet das neueste Bild aus dem konfigurierten Ordner.
- `telegram:chat-id` zeigt Telegram-Chats, die der Bot ueber `getUpdates` sieht.

## Health-Datei

Der Notifier-Hub schreibt eine Health-Datei, standardmaessig:

```text
state/health.json
```

Der Pfad ist ueber `HEALTH_FILE` konfigurierbar. Die Datei enthaelt Laufzeitstatus, Queue-Informationen und Notifier-Health. Sie ist Runtime-Datenbestand und wird nicht committed.

## Logs und Decision-Sidecars

Zeus Herald nutzt strukturierte JSON-Logs auf stdout/stderr. Optional kann ein Decision-Log aktiviert werden:

```env
DECISION_LOG=1
DECISION_LOG_FILE=logs/decisions.ndjson
```

Bei Verdacht auf ein Speicher- oder Ressourcenproblem kann temporaer zusaetzliche Telemetrie aktiviert werden:

```env
TECHNICAL_LOGGING=1
```

Dann wird bei jedem Heartbeat ein `runtime_telemetry`-Eintrag mit RSS/Heap/externem Speicher, Queue, aktiven Handle-Typen, Requests und Prozessressourcen geschrieben. Nach der Analyse wieder auf `0` setzen.

Ingest kann `.json`-Sidecars neben empfangenen Bildern schreiben. Bei Reolink enthalten diese optional den Kamera-Motion-State. Motion liest diese Sidecars und schreibt nach der Verarbeitung `.decision.json`-Sidecars neben verschobenen Bildern. Diese Dateien helfen beim Tuning und werden mit dem Bild-Cleanup entfernt, wenn `.json` in `CLEANUP_IMAGE_EXTENSIONS` enthalten ist.

## Bildordner

Die Standardordner images/received, images/filtered und images/sent werden automatisch angelegt, sobald Ingest oder Motion sie erstmals benoetigt. Sie sind Runtime-Daten und werden nicht committed.

## Prozess-Locks

`ingest` und `motion` verwenden Lock-Dateien unter `.lock/`. Dadurch wird verhindert, dass derselbe Worker mehrfach parallel startet. Falls ein Prozess hart beendet wurde, entfernt Zeus Herald veraltete Locks, sofern der gespeicherte Prozess nicht mehr laeuft.

## Cleanup

Cleanup startet automatisch in den langlebigen `ingest`- und `motion`-Prozessen.

Standardwerte:

```env
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_LOGS_MAX_AGE_HOURS=48
CLEANUP_INTERVAL_MS=300000
```

Damit werden alte Bilder, JSON-Sidecars und Logs regelmaessig entfernt. Bei Bedarf kann Cleanup komplett deaktiviert werden:

```env
CLEANUP_ENABLED=false
```

## ZIP-Deployment

Auf dem Quellsystem:

```powershell
npm run deploy:zip
```

Das ZIP wird in `dist/` erstellt. Es enthaelt standardmaessig die lokale `.env`, aber nicht `node_modules`, `.git`, `images`, `state`, `logs`, `.lock`, `dist`, Build-Ordner oder Legacy-Browser-Sessions.

Auf dem Zielsystem:

```powershell
Expand-Archive zeus-herald-deploy-<timestamp>.zip -DestinationPath <target-folder>
cd <target-folder>
npm install
npm run lint
npm test
npm run ingest:once
npm run notify:latest
```

Das ZIP ist privat, weil es `.env` enthaelt. Es darf nicht committed oder oeffentlich gespeichert werden.

## Windows-Dauerbetrieb mit NSSM

Beispiel fuer zwei NSSM-Services:

```text
Service: zeus-herald-ingest
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run ingest
```

```text
Service: zeus-herald-motion
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run motion
```

Start, Stop und Status erfolgen ueber NSSM oder die Windows-Serviceverwaltung.

## Update-Ablauf

1. Services stoppen.
2. Neues ZIP entpacken oder Repository aktualisieren.
3. `.env` pruefen, falls sich `.env.example` geaendert hat.
4. `npm install` oder bei Lockfile-basiertem Deployment `npm ci` ausfuehren.
5. `npm run lint` und `npm test` ausfuehren.
6. `npm run ingest:once` und `npm run notify:latest` testen.
7. Services wieder starten.

## Troubleshooting

| Symptom | Pruefung |
| --- | --- |
| Keine Bilder in `images/received/` | Kamera-URL, Zugangsdaten, Netzwerk, `npm run ingest:once`. |
| Telegram sendet nicht | Bot-Token, `TELEGRAM_CHAT_ID`, Bot wurde gestartet oder in Gruppe angeschrieben. |
| ntfy sendet nicht | `NTFY_URL`, Topic, optional `NTFY_TOKEN`, Netzwerkerreichbarkeit. |
| Zu viele Meldungen | `MOTION_SCORE_THRESHOLD`, `MOTION_CONFIRM_COUNT`, ROI und Cooldown erhoehen. |
| Keine Meldungen bei Bewegung | Kamera-Motion-State, `REOLINK_BURST_REQUIRE_SIGNAL`, ROI, `images/filtered/` und Decision-Sidecars pruefen. |
| Worker startet nicht | `.lock/` pruefen und sicherstellen, dass kein zweiter Prozess laeuft. |

## Datenschutz

Kamerabilder koennen personenbezogene Daten enthalten. Speicherdauer, Zugriff auf Zielsysteme, Telegram-Gruppen, ntfy-Topics und Backup-Prozesse muessen entsprechend der lokalen Anforderungen bewertet werden.
