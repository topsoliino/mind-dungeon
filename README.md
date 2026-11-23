# Mind Dungeon: Shadowbound

Browserbasiertes isometrisches Lern-Action-RPG mit Psychologie-Fragen.

## 🎮 Aktuelle Playtest-Version

### **[▶ Mind Dungeon jetzt playtesten](https://topsoliino.github.io/mind-dungeon/beta/latest.html)**

**Direktlink:** https://topsoliino.github.io/mind-dungeon/beta/latest.html

Dieser Link lädt die **neueste veröffentlichte Testversion**, inklusive frischer Skript-, Modell- und Animationsdateien, und bleibt auch bei künftigen Updates gleich. Auf dem Titelscreen zeigt das Spiel die lokale Build-ID, prüft den veröffentlichten Stand und bietet einen direkten Update-Button. GitHub Pages kann nach einem Commit noch kurz mit dem Deployment beschäftigt sein.

Die [Hauptversion](https://topsoliino.github.io/mind-dungeon/) ist nicht der aktuelle Playtest-Einstieg.

## Rocky-Coast-Generator

Die vier Innenebenen verwenden zehn reproduzierbare Durchläufe (`run=4147` bis `4156`). Jede Ebene hat einen Grundriss mit 15 Kammern plus Gängen. Die Stockwerke teilen diesen Grundriss. Zehn Wissensaltäre, fünf Goldtruhen, zwei versiegelte Türen, ein Brautisch und ein Fledermaushändler verteilen sich einmal pro Ebene auf die Stockwerke. Ebene 5 ist die offene Landschaft.

`beta/alley-level-sites.js` plant die Standorte nach der Treppenerzeugung. Die Interaktion läuft über E. Eine richtige Karteikartenantwort öffnet eine versiegelte Tür. Brautisch und Händler sind vorerst Platzhalter. Die Platzierung aller 40 Innenkarten prüft `node tools/check-alley-level-sites.cjs`. Den Sichtverlust, die Suchwege und die Rückkehr zum Wachposten prüft `node tools/check-alley-search.cjs`.

## Übergabe für KI und neue Mitwirkende

Die spielbare isometrische Version liegt in `beta/`. Der Einstieg `beta/index.html` setzt die Basis für relative Asset-URLs auf das Projektverzeichnis. Einen lokalen Webserver deshalb im Projektverzeichnis starten. Bei direkter Arbeit über GitHub einzelne Dateien am selben Commit lesen und Änderungen gegen den aktuellen Branch-Stand schreiben. Parallel können Blender-Jobs neue Assets auf `main` veröffentlichen.

- **Reproduzierbarer Spieltest.** Bühne und Gebäude über `szene=gasse&modus=generator&region=rocky-coast&level=4&run=4147&storey=2` wählen. `run` fixiert die Welt, `storey` zählt ab 1. `entry=down-stairs` startet am Kopf der Treppe vom Stockwerk darunter. `treppe=switchback-closed` bevorzugt eine Bauform, der Generator prüft, ob sie hineinpasst. Beim Fehlerbericht Seed, tatsächliche Bauform, Stockwerk, Bewegungsrichtung und Browser angeben.
- **Koordinaten und Physik.** `alley-stair-geometry.js` baut Stufen, Podeste und Wegpunkte in Zellen. Eine Zelle entspricht 48 Welteinheiten. `alley-vertical.js` beschreibt die Anschlüsse. `connectorsAt(i)` gehört zum Übergang vom nullbasierten Stockwerk i nach i+1. `state.floor` ist die lokale Seite des aktiven Übergangs. `alleyFloor` eines Gegners zählt dagegen absolut ab 0. Abfragen auf einem anderen Stockwerk erfolgen synchron über `atStorey`. Rendering, Wegsuche und Bewegung müssen denselben Anschluss verwenden.
- **Grafik.** `dungeon-isometric.js` stellt die Ebenen für Canvas und Phaser zusammen. Die Spielerfigur verwendet in beiden Fällen das Wächter-GLB. Beim Skelett ist `tools/build-isometric-skeleton.py` die Quelle für Geometrie und Posen. Die Workflows `build-guardian-enemy-rigs.yml` und `bake-skeleton-atlases.yml` erzeugen zuerst die GLBs und daraus die 32 Ansichten für den normalen Spielbetrieb. Eine geänderte Blender-Datei allein belegt noch keine öffentlich sichtbare Animation.
- **Abnahme.** Im Projektverzeichnis `node tools/check-rocky-coast-stairs.cjs`, `node tools/check-skeleton-specials.cjs` und `node tools/check-live-enemy-renderer.cjs` ausführen. Für sichtbare Fehler anschließend den veröffentlichten Build kalt öffnen. Modell, Überdeckung, Aufstieg und Abstieg im Bild prüfen. Bei Änderungen an geladenen Skripten die zugehörige Skriptversion aktualisieren. Bei der Übergabe Commit, getestete Fälle und offene Beobachtungen nennen.

## Steuerung

| Taste | Funktion |
|---|---|
| WASD / Pfeiltasten | Bewegung |
| Maus / Touchpad | Zielen; Mausklick greift an |
| F | Auf Tastatur-Zielmodus umschalten |
| Leertaste | Normaler Angriff |
| R | Fokusangriff (FP) |
| Shift | Ausweichen (Ausdauer) |
| E | Interaktion / Torprüfung / Truhe |
| I | Inventar (Gegenstände ausrüsten) |
| C | Ausrüstung und Waffendetails |
| L | Attribute / offene Levelpunkte |
| J | Lernjournal / JSON-Import |
| Q / Shift + Q | Schnellplatz verwenden / nächsten Schnellplatz wählen (Beta) |
| P | Pause |

Sobald Maus oder Touchpad bewegt werden, bleibt die Waffenrichtung bei WASD-Bewegung erhalten. Mit **F** wechselt man zurück zur Laufrichtungs-Zielsteuerung.

## Charakterentwicklung

Neun an Dark Souls III angelehnte Attribute: Vigor, Attunement, Endurance, Vitality, Strength, Dexterity, Intelligence, Faith, Luck. Pro Levelaufstieg kann ein Punkt vergeben werden. Waffen skalieren mit mehreren Attributen; Truhen und große Gegner geben Waffen und Ringe. Es gibt zwei Ringplätze, die Kampfboni gewähren. Gegner haben unterschiedlich große Varianten und zwei angekündigte Spezialattacken, denen man ausweichen sollte.

## Fragenpakete

Das KVT-III-Paket der [Beta](https://topsoliino.github.io/mind-dungeon/beta/latest.html) liegt in `questions/kvt3.json`. Es enthält 47 Textfragen und neun Bildkarten. Bildkarten öffnen sich auch direkt über **J → Bildkarten**.

### Ein neues Skript als Dungeon vorbereiten

1. Die prüfungsrelevanten Hauptthemen des Skripts bestimmen und in Unterkategorien gliedern, die sich jeweils mit eigenen Fragen prüfen lassen.
2. Hauptthemen und Unterkategorien mit festen IDs in `categories` erfassen. Jede Frage verweist über `categoryId` und `subcategoryId` darauf. Bestehende IDs bei Überarbeitungen beibehalten, damit Spiel- und Lernfortschritt zugeordnet bleiben.
3. Je Unterkategorie eine Frage zu einer Abbildung erstellen. Wenn die Folie keine Abbildung enthält, lässt sich der passende Vorlesungsausschnitt verwenden. Folie, Dokument und Alternativtext angeben. Externe Pakete können PNG, JPEG oder WebP als Base64-Daten direkt in `image.src` mitliefern. Hauseigene Bilddateien können unter `questions/figures/` liegen.
4. Die JSON-Datei über **P → Fragenpakete → JSON importieren** laden. Das Spiel verteilt die Hauptthemen auf die fünf Wissensräume und wechselt die aktive Unterkategorie mit der Tiefe. Deren Titel erscheint am Raum, und ihr Fragenpool wird am Altar verwendet. Bei mehr als fünf Hauptthemen verteilt das Spiel sie über die Tiefen. Sehr große Pakete können mehrere Themen in einem Raum bündeln. Jede Unterkategorie stellt außerdem eine Brauzutat bereit. Grundriss, Einrichtung und Kampfstil werden unabhängig davon generiert.

Beispiel für Schema 2:

```json
{
  "schemaVersion": 2,
  "packId": "beispiel",
  "title": "Mein Vorlesungsskript",
  "categories": [{
    "id": "trauma",
    "title": "Traumafokussierte Verfahren",
    "subcategories": [{"id": "diskrimination", "title": "Diskriminationstraining"}]
  }],
  "questions": [{
    "id": "beispiel-01",
    "categoryId": "trauma",
    "subcategoryId": "diskrimination",
    "difficulty": 2,
    "type": "free-text",
    "prompt": "Wie heißt die Unterscheidung zwischen damals und heute?",
    "answers": ["Diskriminationstraining"],
    "explanation": "Training zur Unterscheidung vergangener und aktueller Gefahr.",
    "source": {"document": "folien.pdf", "page": 17}
  }]
}
```

Für Auswahlfragen `type: "single-choice"`, `choices` und den bei null beginnenden `correctIndex` verwenden. Ein optionales Bild ist ein Objekt mit `src`, `alt` und optional `caption`. Ältere Pakete mit `topic` pro Frage können weiterhin importiert werden. Der Antwortvergleich für Freitext ignoriert Groß-/Kleinschreibung, Leerzeichen und Satzzeichen und toleriert je nach Antwortlänge kleine Tippfehler.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `/(root)`.

Der Spielstand bleibt im Browser-LocalStorage. Vor größeren Änderungen im Lernjournal exportieren.

## Quellen

- Vorlesungsskript `04_KVT_3_SKRIPT.pdf` (KVT III – Konfrontationsverfahren); Seitenangaben stehen bei jeder Frage.
- Attribute orientieren sich an Dark Souls III, die konkreten Kampfwerte sind eigenständig für Mind Dungeon balanciert.

## Grafik und Performance (v0.7)

Primärer Renderer: Phaser 3 (WebGL), geladen über jsDelivr. Die Dungeonkarte wird einmalig als Textur aufgebaut; Figuren, Gegner und Effekte werden als separate Grafikobjekte aktualisiert. Wenn Phaser nicht geladen werden kann, wird der bisherige Canvas-Renderer als Ersatz verwendet. **F3** zeigt den Renderer und die aktuelle FPS-Schätzung an.

Die Phaser-Integration ist eine erste Migration: Spiellogik, Inventar und Wissensprüfungen sind weiterhin im vorhandenen Spielcode enthalten. Die Grafik ist bewusst reduziert, um die Rendering-Last zu verringern.

## Spielstände und Koop-Server

GitHub Pages liefert das Spiel aus. Supabase verwaltet die Anmeldung, Cloud-Speicherslots und Fragenpakete. Der Node.js-Dienst unter `backend/coop/` simuliert gemeinsame Partien. Die [Einrichtung für Render und lokale Tests](backend/README.md) steht im Backend-Handbuch.
