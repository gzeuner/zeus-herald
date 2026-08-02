# Konfiguration

Diese Datei beschreibt die wichtigsten Konfigurationsbereiche fuer Zeus Herald. Die konkrete lokale Konfiguration liegt in `.env` und darf nicht committed werden. Verwende in Beispielen ausschliesslich Platzhalter.

## Grundprinzip

Zeus Herald liest Konfiguration aus Umgebungsvariablen. Die NPM-Skripte verwenden Node.js mit `--env-file=.env`, sodass lokale Installationen ohne zusaetzliche Dotenv-Abhaengigkeit auskommen.

```bash
cp .env.example .env
```

`.env.example` ist die neutrale Vorlage. `.env` enthaelt echte Zugangsdaten und bleibt privat.

## Kamera-Ingest

Wichtige Variablen:

| Variable | Zweck |
| --- | --- |
| `CAMERA_TYPE` | `reolink` oder `upcam`; Standard ist `reolink`. |
| `CAMERA_ID` | Logischer Kameraname fuer Dateinamen und Metadaten. |
| `INGEST_MODE` | `files_only` schreibt Bilder; `direct_notify` sendet jede Aufnahme direkt. |
| `INGEST_TARGET_DIR` | Zielordner fuer empfangene Bilder, Standard `images/received`. |
| `INGEST_INTERVAL_MS` | Polling-Intervall im Dauerbetrieb. |
| `INGEST_TIMEOUT_MS` | HTTP-Timeout fuer Kameraabrufe. |
| `INGEST_WRITE_METADATA` | Schreibt optionale `.json`-Sidecars. |
| `INGEST_ONCE` | Fuehrt genau einen Abruf aus. |

## Reolink

Reolink kann ueber eine vollstaendige Snapshot-URL oder ueber Host, Port, Zugangsdaten und Pfadtemplate konfiguriert werden.

```env
CAMERA_TYPE=reolink
REOLINK_HOST=<camera-host-or-ip>
REOLINK_HTTP_PORT=80
REOLINK_USER=<camera-user>
REOLINK_PASSWORD=<camera-password>
REOLINK_CHANNEL=0
REOLINK_SNAPSHOT_PATH=/cgi-bin/api.cgi?cmd=Snap&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}
```

Alternativ:

```env
REOLINK_SNAPSHOT_URL=<full-snapshot-url>
```

Wenn ein Passwort Sonderzeichen wie `#` enthaelt, muss es in `.env` in Anfuehrungszeichen stehen.

### Reolink Burst Capture

```env
REOLINK_MOTION_STATE_PATH=/cgi-bin/api.cgi?cmd=GetMdState&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}
REOLINK_BURST_ENABLED=true
REOLINK_BURST_COUNT=4
REOLINK_BURST_INTERVAL_MS=250
REOLINK_BURST_REQUIRE_SIGNAL=true
```

Mit `REOLINK_BURST_REQUIRE_SIGNAL=true` fragt Zeus Herald zuerst den Kamera-Motion-State ab und speichert nur bei aktivem Kameraalarm eigene Snapshots. Burst Capture speichert dann mehrere kurz aufeinanderfolgende Snapshots pro Alarm, was die spaetere Bildauswahl und optionale Pixelpruefung stabilisiert.

## UpCam

UpCam-Unterstuetzung ist optional und nutzt entweder eine vollstaendige Snapshot-URL oder Host plus Basic-Auth-Werte.

```env
CAMERA_TYPE=upcam
UPCAM_SNAPSHOT_URL=<full-snapshot-url>
UPCAM_HOST=<camera-host-or-ip>
UPCAM_USER=<camera-user>
UPCAM_PASSWORD=<camera-password>
```

## Bewegungserkennung

Zeus Herald dekodiert JPEGs, skaliert sie, schneidet optional den oberen Bereich ab, wendet ROI-Polygone an und vergleicht Grauwert-Pixel mit dem vorherigen Frame.

| Variable | Zweck |
| --- | --- |
| `MOTION_RECEIVED_DIR` | Eingangsordner fuer neue Bilder. |
| `MOTION_FILTERED_DIR` | Zielordner fuer verworfene Frames. |
| `MOTION_SENT_DIR` | Zielordner fuer akzeptierte Frames. |
| `MOTION_POLL_MS` | Polling-Intervall. |
| `MOTION_NOTIFY` | Sendet akzeptierte Frames ueber den Notifier Hub. |
| `MOTION_IMAGE_DECODE_ENABLED` | Aktiviert JPEG-Dekodierung und Pixelvergleich. |
| `MOTION_RESIZE_WIDTH` | Arbeitsbreite vor dem Vergleich. |
| `MOTION_CROP_TOP_PX` | Pixel, die nach dem Resize oben entfernt werden. |
| `MOTION_PIXEL_DIFF_THRESHOLD` | Minimaler Grauwertunterschied pro Pixel. |
| `MOTION_SCORE_THRESHOLD` | Mindestanteil veraenderter Pixel. |
| `MOTION_CONFIRM_COUNT` | Anzahl bestaetigender Frames vor Versand. |
| `MOTION_COOLDOWN_MS` | Mindestabstand zwischen Ereignissen. |
| `MOTION_MAX_SENDS` | Maximalzahl Sendungen pro Ereignis. |

Empfindliche Startwerte fuer Reolink-Snapshots:

```env
MOTION_IMAGE_DECODE_ENABLED=true
MOTION_RESIZE_WIDTH=512
MOTION_CROP_TOP_PX=24
MOTION_PIXEL_DIFF_THRESHOLD=12
MOTION_SCORE_THRESHOLD=0.012
MOTION_CONFIRM_COUNT=1
MOTION_COOLDOWN_MS=1000
MOTION_MAX_SENDS=20
```

## ROI-Polygone

`MOTION_ROI_POLYGONS_JSON` enthaelt ein JSON-Array von Polygonen. Koordinaten beziehen sich auf das skalierte und zugeschnittene Arbeitsbild.

```env
MOTION_ROI_POLYGONS_JSON=[[{"x":10,"y":10},{"x":120,"y":10},{"x":120,"y":90},{"x":10,"y":90}]]
```

Nutze echte Frames aus dem Einsatzort, um ROIs zu pruefen und Schwellwerte anzupassen. Dokumentiere keine privaten Bildinhalte oder exakten Kamerastandorte.

## Telegram

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
```

Fuer Benachrichtigungen an mehrere Personen kann ein privater Telegram-Gruppenchat verwendet werden. Lade den Bot in die Gruppe ein, schreibe eine Nachricht in die Gruppe und ermittle die Gruppen-ID mit:

```bash
npm run telegram:chat-id
```

Der Helper gibt Chat-IDs aus, aber nicht den Bot-Token.

## ntfy

```env
NTFY_ENABLED=true
NTFY_URL=https://ntfy.sh/<long-private-topic>
```

Optional fuer private oder selbst gehostete ntfy-Server:

```env
NTFY_TOKEN=<bearer-token>
```

Ein oeffentliches `ntfy.sh`-Topic ohne Token ist nur so privat wie der Topic-Name. Fuer staerkere Zugriffskontrolle einen privaten Server oder Token verwenden.

## Bildkompression und Bildtext

```env
NOTIFIER_IMAGE_COMPRESSION_ENABLED=true
NOTIFIER_IMAGE_MAX_WIDTH=1920
NOTIFIER_IMAGE_JPEG_QUALITY=88
NOTIFIER_CAPTION_DEBUG=false
NOTIFIER_CAPTION_LOCALE=
NOTIFIER_CAPTION_TIME_ZONE=
```

Die Kompression erfolgt zentral, bevor Telegram oder ntfy das Bild erhalten. Wenn Kompression fehlschlaegt, wird das Originalbild verwendet, damit die Benachrichtigung nicht allein am Encoder scheitert.

Der Standard-Bildtext unter jedem Bild ist der Erstellungszeitpunkt mit Datum und Uhrzeit. Ohne `NOTIFIER_CAPTION_LOCALE` und `NOTIFIER_CAPTION_TIME_ZONE` verwendet Node.js die automatisch ermittelte Runtime-Locale und Zeitzone. Bei Bedarf koennen feste Werte wie `de-DE` und `Europe/Berlin` gesetzt werden.

`NOTIFIER_CAPTION_DEBUG=true` erweitert den Bildtext um technische Daten fuer Analyse und Feintuning: Kamera, Quelle, Dateiname, Motion-Grund, Score, geaenderte und verglichene Pixel, Helligkeit, Zonenstatus, Bild-/Arbeitsgroesse, ROI-Werte, Kamera-Motion-Signal, Burst-Position und urspruengliche interne Caption.

## Cleanup

```env
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MS=300000
CLEANUP_IMAGES_ENABLED=true
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_IMAGE_DIRS=images/received,images/filtered,images/sent
CLEANUP_IMAGE_EXTENSIONS=.jpg,.jpeg,.png,.webp,.json
CLEANUP_LOGS_ENABLED=true
CLEANUP_LOGS_MAX_AGE_HOURS=48
CLEANUP_LOG_DIRS=logs
CLEANUP_LOG_EXTENSIONS=.log,.ndjson,.txt
```

Standardmaessig werden Bilder und JSON-Sidecars nach 36 Stunden entfernt. Logs werden nach 48 Stunden entfernt.

## Runtime-Hardening

| Variable | Zweck |
| --- | --- |
| `QUEUE_MAX_SIZE` | Maximale Groesse der Sendewarteschlange. |
| `QUEUE_DROP_POLICY` | Verhalten bei voller Warteschlange. |
| `HEARTBEAT_MS` | Intervall fuer Health-Datei-Aktualisierung. |
| `HEALTH_FILE` | Pfad zur Health-Datei. |
| `SHUTDOWN_TIMEOUT_MS` | Zeit fuer geordneten Shutdown. |
| `DECISION_LOG` | Aktiviert optionales NDJSON-Decision-Log. |
| `DECISION_LOG_FILE` | Pfad fuer das Decision-Log. |
| `TECHNICAL_LOGGING` | Aktiviert optionales Ressourcen-Telemetrie-Logging bei jedem Heartbeat (Speicher, Queue, aktive Handles/Requests und Prozessressourcen). Standardmaessig deaktiviert. |
| `INGEST_MAX_IMAGE_BYTES` | Maximale Größe eines Kamera-Response-Bodys; größere Antworten werden verworfen. Standard: 10 MiB. |
