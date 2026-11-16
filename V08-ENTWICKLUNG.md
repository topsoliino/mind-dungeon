# Mind Dungeon v0.8 – Entwicklungsbranch

Die produktive GitHub-Pages-Version bleibt auf `main`. Diese Änderungen liegen in `feature/rpg-inventory-supabase-v08`, bis Browser- und Performance-Tests erfolgreich sind.

## Neu
- Rasterinventar mit 30 Feldern und Hover-Inspektor
- Ausrüstungsfenster mit drei Slots, Charakterwerten und Gegenstandsdetails
- Fünf unterschiedliche gezeichnete Angriffsposen pro Gegnertyp sowie fünf Spieler-Angriffsposen. Dies sind **prozedural gezeichnete Einzelbilder**, noch keine professionell illustrierten Sprite-Sheets.
- Ausgelagerter Gegenstandskatalog in `catalog/items.json` mit lokalem Ersatzkatalog
- Supabase-SQL-Migrationen für Gegenstände und nutzergebundene Spielstände mit Row-Level-Security

## Supabase einrichten
1. Ein Supabase-Projekt erstellen.
2. SQL-Dateien in `supabase/migrations/` in Dateinamen-Reihenfolge über den SQL-Editor ausführen (oder Supabase CLI verwenden).
3. Unter Authentication einen Anmeldeanbieter konfigurieren.
4. **Nur** Project URL und Publishable/anon Key für den Browser vorsehen. **Nie** `service_role` oder andere Secrets im öffentlichen Repository ablegen.
5. Erst nach Einrichtung der Authentifizierung den Cloud-Speicheradapter anschließen und bestehende lokale Spielstände explizit migrieren.

**Wichtig:** Die Tabellen sind vorbereitet, aber derzeit ist weder ein Supabase-Projekt verbunden noch eine Online-Spielstand-Synchronisierung aktiviert. Ohne Projekt-URL und Publishable Key ist eine Bereitstellung nicht möglich.

## QA
Syntaxprüfung des Frontend-JavaScripts erfolgreich. Automatisierter Browser-Test war in dieser Sitzung durch Browser-Netzwerkrestriktionen blockiert; Animationen, Hover und FPS sind daher noch **nicht** in Chromium abgenommen. Nicht auf `main` zusammenführen, bevor diese Tests gelingen.
