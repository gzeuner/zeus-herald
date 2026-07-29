# Architektur

Zeus Herald ist ein lokaler Node.js-Dienst fuer Kamera-Snapshots, Bewegungserkennung und mobile Benachrichtigungen. Die Architektur priorisiert einfache Betriebsfuehrung, offizielle APIs und klare Trennung zwischen Aufnahme, Entscheidung und Versand.

## Prinzipien

1. Lokaler Betrieb vor externer Abhaengigkeit.
2. Offizielle Schnittstellen statt Browser-Automation.
3. Einmalige Motion-Entscheidung, danach Fan-out an aktive Notifier.
4. Keine Secrets im Repository.
5. Kleine, testbare Module ohne Build-Schritt.
6. Laufzeitdaten bleiben maschinenlokal.

## Komponenten

| Komponente | Verantwortung |
| --- | --- |
| Ingest | Holt Snapshots von Reolink oder optional UpCam und schreibt Bilder plus Metadaten. |
| Motion | Liest neue Bilder, berechnet Pixel-Deltas, bewertet Ereignisse und verschiebt Dateien. |
| Notifier Hub | Sendet akzeptierte Frames an Telegram, ntfy oder beide Kanaele. |
| Runtime Supervisor | Fuehrt Queue-, Health- und Shutdown-Logik. |
| Cleanup | Entfernt alte Bilder, JSON-Sidecars und Logs anhand konfigurierbarer Grenzwerte. |
| Deployment Script | Erstellt ein ZIP-Paket ohne Dependencies und Runtime-Daten. |

## Datenfluss

```text
Camera
  -> Ingest
  -> images/received/ + optional metadata
  -> Motion decision
  -> images/filtered/ or images/sent/ + decision sidecar
  -> Notifier Hub
  -> Telegram / ntfy
```

## Notifier-Kontrakt

Notifier implementieren denselben logischen Vertrag:

```ts
interface Notifier {
  readonly name: string;
  send(payload: { imagePath: string; caption?: string; metadata?: object }): Promise<SendResult>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}
```

Ein Ereignis gilt als erfolgreich zugestellt, wenn mindestens ein aktivierter Notifier erfolgreich sendet. Fehler einzelner Kanaele werden protokolliert, blockieren aber andere Kanaele nicht.

## Nicht-Ziele

- WhatsApp Web, Puppeteer, Playwright oder andere Browser-Automation als Runtime-Abhaengigkeit.
- SaaS- oder Multi-Tenant-Betrieb.
- Zertifizierte Alarmanlage oder garantierte Echtzeitueberwachung.
- Schwere ML-Modelle im aktuellen Stand.

## Relevante Dokumente

- [Konfiguration](CONFIGURATION.md)
- [Betrieb](OPERATIONS.md)
- [Migration](MIGRATION.md)
- [Discontinuation Notice](DISCONTINUATION.md)
