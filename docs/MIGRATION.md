# Migration von upcam-client / SnapShotter

Zeus Herald ersetzt typische `upcam-client`- und SnapShotter-Setups durch einen lokalen Node.js-Flow ohne WhatsApp Web und ohne Browser-Automation.

## Zielbild

- Reolink-Snapshot-Ingest ueber HTTP.
- Optionaler UpCam-Snapshot-Ingest.
- Pixelbasierte JPEG-Bewegungserkennung mit ROI-Unterstuetzung.
- Telegram und/oder ntfy als mobile Zielkanaele.
- Lokale Laufzeitdaten, private `.env`, keine Secrets im Repository.

## Empfohlener Ablauf

1. Zeus Herald installieren und `npm install` ausfuehren.
2. `.env.example` nach `.env` kopieren.
3. Kamera-Zugangsdaten in der lokalen `.env` konfigurieren.
4. Telegram, ntfy oder beide Kanaele konfigurieren.
5. Kameraabruf mit `npm run ingest:once` testen.
6. Mobilen Versand mit `npm run notify:latest` testen.
7. Dauerbetrieb mit `npm run ingest` und `npm run motion` starten.
8. Alte Java-/WhatsApp-Prozesse erst abschalten, wenn der neue Flow stabil laeuft.

## Konfigurationsmapping

| Legacy | Zeus Herald |
| --- | --- |
| `camera.type=REOLINK` | `CAMERA_TYPE=reolink` |
| `reolink.host` | `REOLINK_HOST` |
| `reolink.httpPort` | `REOLINK_HTTP_PORT` |
| `reolink.username` | `REOLINK_USER` |
| `reolink.password` | `REOLINK_PASSWORD` |
| `reolink.snapshotPath` | `REOLINK_SNAPSHOT_PATH` |
| `reolink.burst.enabled` | `REOLINK_BURST_ENABLED` |
| `image.local.store.rcv` | `INGEST_TARGET_DIR` und `MOTION_RECEIVED_DIR` |
| `image.local.store.snt` | `MOTION_SENT_DIR` |
| `prefilter.resizeWidth` | `MOTION_RESIZE_WIDTH` |
| `prefilter.cropTopPx` | `MOTION_CROP_TOP_PX` |
| `runtime.cooldownSeconds` | `MOTION_COOLDOWN_MS` |
| WhatsApp-Zielchat | `TELEGRAM_CHAT_ID` oder `NTFY_URL` |

## Reolink-Profil mit Platzhaltern

```env
CAMERA_TYPE=reolink
CAMERA_ID=front
INGEST_MODE=files_only
INGEST_TARGET_DIR=images/received
INGEST_INTERVAL_MS=3000
INGEST_TIMEOUT_MS=15000
REOLINK_HOST=<camera-host-or-ip>
REOLINK_HTTP_PORT=80
REOLINK_USER=<camera-user>
REOLINK_PASSWORD=<camera-password>
REOLINK_CHANNEL=0
REOLINK_SNAPSHOT_PATH=/cgi-bin/api.cgi?cmd=Snap&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}
REOLINK_BURST_ENABLED=true
REOLINK_BURST_COUNT=2
REOLINK_BURST_INTERVAL_MS=350
```

Passwoerter mit Sonderzeichen muessen in `.env` in Anfuehrungszeichen stehen.

## Motion-Unterschiede

SnapShotter enthielt ein groesseres Ereignis- und Zonenmodell. Zeus Herald nutzt aktuell einen pragmatischen lokalen Pixelvergleich:

1. JPEG dekodieren.
2. Auf Arbeitsbreite skalieren.
3. Optional oberen Bereich entfernen.
4. ROI-Polygone anwenden.
5. Grauwert-Pixel mit vorherigem Frame vergleichen.
6. Bestaetigungsframes, Cooldown und Maximalzahl pro Ereignis anwenden.

Details stehen in [CONFIGURATION.md](CONFIGURATION.md).

## Retire Legacy

- Keine WhatsApp-Sessiondaten in Zeus Herald uebernehmen.
- Alte Prozesse erst nach erfolgreichem Paralleltest abschalten.
- Legacy-Repositories koennen fuer Rollback oder Archivzwecke read-only bleiben.
- Neue Secrets ausschliesslich in der lokalen `.env` pflegen.
