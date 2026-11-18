# Mind Dungeon Koop-Server

Der Node.js-Dienst betreibt Zwei-Spieler-Lobbys mit einer gemeinsamen Dungeon-Simulation. Er verifiziert Supabase-Login-Tokens und prüft Eingaben, Wegkollisionen, Ausdauer, Treffer, Quizantworten, Inventar, Handel und Loot. Gegner und Raumaufbau verwenden denselben Code wie Einzelspieler. Der Server simuliert mit 30 Schritten pro Sekunde und sendet bis zu 15 Zustandsupdates pro Sekunde über WebSockets. Die Browser zeigen Bewegung sofort an und gleichen sie mit dem Server ab.

Jeder serverbasierte Lauf beginnt mit der Startausrüstung der gewählten Klasse. Fortschritt und Ausrüstung gehören während der Partie zum jeweiligen Spielerkonto in dieser Lobby. Über „Partie fortsetzen“ oder den ursprünglichen Code können dieselben Konten nach einem Verbindungsabbruch, Neustart oder Render-Kaltstart wieder spielen. Der Server schreibt den Spielstand in Supabase beim Start, Ebenenwechsel, Verlassen und planmäßig alle zehn Sekunden während des Spiels. Ein abrupter Ausfall kann den Fortschritt seit dem letzten erfolgreichen Checkpoint verlieren. Solange nur eine Person auf einer Ebene spielt, gelten dort Solo-Gegner-LP. Die Rückkehr einer zweiten Person skaliert lebende Gegner proportional zur verbleibenden Gesundheit. Wer abwesend war, behält Ebene und Position und kann durch das bereits freigespielte Portal aufschließen.

## Auf Render einrichten

1. Wende die Migration für die autoritativen Koop-Checkpoints auf das bestehende Supabase-Projekt an. Setze einen zufälligen 32-Byte-Schlüssel als 64-stellige Hexfolge in der Render-Variable `MIND_COOP_STORAGE_TOKEN` und hinterlege dessen SHA-256-Hash in `mind_dungeon_checkpoints.credentials`.
2. Öffne [Deploy to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftopsoliino%2Fmind-dungeon) mit deinem Render-Konto. Die Vorlage im Repo wählt einen kostenlosen Webservice in Frankfurt. Server-Updates lassen sich in Render manuell ausrollen.
3. Warte auf einen erfolgreichen Deploy und kopiere den HTTPS-Ursprung des Dienstes. Öffne `/healthz` unter dieser Adresse. Der Dienst antwortet mit `"service":"mind-dungeon-coop"` sowie `"ready":true` und `"checkpoints":true`.
4. Trage den geprüften Ursprung als `window.MindDungeonCoopOrigin` in `beta/dungeon-server-config.js` ein und erhöhe dessen Versionsnummer in `beta/index.html`. Nach der Veröffentlichung auf GitHub Pages startet ein Aufruf des Titelscreens die Bereitschaftsabfrage im Hintergrund. **Online-Koop** öffnet dann die Server-Lobby. Ohne eingetragenen Ursprung verwendet GitHub Pages den bisherigen Browser-Koop.
5. Starte mit zwei Supabase-Konten eine Partie und prüfe im Render-Dashboard die ausgehende Bandbreite.

Render braucht für diesen Dienst den öffentlichen Supabase-Projektzugang aus `supabase/public-config.json`. Private Projekt- und Service-Role-Schlüssel sind dafür überflüssig. Der Server akzeptiert WebSockets vom in `MIND_ALLOWED_ORIGINS` konfigurierten GitHub-Pages-Ursprung. Die Spieldateien und Musik kommen von GitHub Pages.

## Lokal testen

```bash
npm --prefix backend ci
npm --prefix backend test
MIND_ALLOWED_ORIGINS=http://127.0.0.1:8000 npm --prefix backend start
```

Öffne das Repo in einem zweiten Terminal über `python3 -m http.server 8000 --bind 127.0.0.1`. Die lokale Beta unter `http://127.0.0.1:8000/beta/` verbindet sich per WebSocket mit Port 8787. Mit einem normalen Spielerkonto lässt sich die Anmeldung gegen Supabase prüfen. Der automatisierte Test startet einen lokalen Dienst mit einem Testanbieter für Login und Fragenpakete.

`backend/server.mjs` ist die frühere Spielstand-API. Die Beta verwendet für Cloud-Speicherslots Supabase.
