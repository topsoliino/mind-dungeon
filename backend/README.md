# Mind Dungeon Koop-Server

Der Node.js-Dienst betreibt Zwei-Spieler-Lobbys mit einer gemeinsamen Dungeon-Simulation. Er verifiziert Supabase-Login-Tokens und prüft Eingaben, Wegkollisionen, Ausdauer, Treffer, Quizantworten, Inventar, Handel und Loot. Gegner und Raumaufbau verwenden denselben Code wie Einzelspieler. Der Server simuliert mit 30 Schritten pro Sekunde und sendet bis zu 15 Zustandsupdates pro Sekunde über WebSockets. Die Browser zeigen Bewegung sofort an und gleichen sie mit dem Server ab.

Jeder serverbasierte Lauf beginnt mit der Startausrüstung der gewählten Klasse. Fortschritt und Ausrüstung gehören während der Partie zum jeweiligen Spielerkonto in dieser Lobby. Dieselben Konten können nach einem Verbindungsabbruch wieder einsteigen, solange der Prozess läuft. Ohne verbundene Spieler löscht der Prozess eine Lobby nach 30 Minuten. Ein Neustart, ein Deployment oder der Inaktivitätsstopp auf Render beendet die im Arbeitsspeicher gehaltenen Partien.

## Auf Render einrichten

1. Öffne [Deploy to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftopsoliino%2Fmind-dungeon) mit deinem Render-Konto. Die Vorlage im Repo wählt einen kostenlosen Webservice in Frankfurt. Server-Updates lassen sich in Render manuell ausrollen.
2. Warte auf einen erfolgreichen Deploy und kopiere den HTTPS-Ursprung des Dienstes. Öffne `/healthz` unter dieser Adresse. Der Dienst antwortet mit `"service":"mind-dungeon-coop"` und `"ready":true`.
3. Trage den geprüften Ursprung als `window.MindDungeonCoopOrigin` in `beta/dungeon-server-config.js` ein und erhöhe dessen Versionsnummer in `beta/index.html`. Nach der Veröffentlichung auf GitHub Pages startet ein Aufruf des Titelscreens die Bereitschaftsabfrage im Hintergrund. **Online-Koop** öffnet dann die Server-Lobby. Ohne eingetragenen Ursprung verwendet GitHub Pages den bisherigen Browser-Koop.
4. Starte mit zwei Supabase-Konten eine Partie und prüfe im Render-Dashboard die ausgehende Bandbreite.

Render braucht für diesen Dienst den öffentlichen Supabase-Projektzugang aus `supabase/public-config.json`. Private Projekt- und Service-Role-Schlüssel sind dafür überflüssig. Der Server akzeptiert WebSockets vom in `MIND_ALLOWED_ORIGINS` konfigurierten GitHub-Pages-Ursprung. Die Spieldateien und Musik kommen von GitHub Pages.

## Lokal testen

```bash
npm --prefix backend ci
npm --prefix backend test
MIND_ALLOWED_ORIGINS=http://127.0.0.1:8000 npm --prefix backend start
```

Öffne das Repo in einem zweiten Terminal über `python3 -m http.server 8000 --bind 127.0.0.1`. Die lokale Beta unter `http://127.0.0.1:8000/beta/` verbindet sich per WebSocket mit Port 8787. Mit einem normalen Spielerkonto lässt sich die Anmeldung gegen Supabase prüfen. Der automatisierte Test startet einen lokalen Dienst mit einem Testanbieter für Login und Fragenpakete.

`backend/server.mjs` ist die frühere Spielstand-API. Die Beta verwendet für Cloud-Speicherslots Supabase.
