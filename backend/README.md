# Mind Dungeon – Spielstand-API (Vorbereitung)

GitHub Pages kann keinen Node-Server ausführen. Die API ist separat und derzeit **nicht bereitgestellt**. Spielstände bleiben bis zur Einrichtung eines Servers lokal im Browser gespeichert.

## Lokal starten

```bash
MIND_SAVE_TOKEN="ein-langes-zufaelliges-token-mit-mindestens-24-zeichen" node backend/server.mjs
```

Endpunkte: `GET /api/health`, `GET /api/saves/:slot`, `PUT /api/saves/:slot`. Die Save-Endpunkte benötigen `Authorization: Bearer <TOKEN>`.

**Sicherheit:** Das Token darf nicht in öffentliches Frontend-JavaScript eingebaut werden. Vor der Aktivierung der Cloud-Synchronisierung ist eine nutzerbezogene Anmeldung und Autorisierung erforderlich. Die Datenbankanbindung erfolgt im nächsten Schritt.
