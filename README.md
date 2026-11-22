# Mind Dungeon: Shadowbound

Browserbasiertes isometrisches Lern-Action-RPG mit Psychologie-Fragen.

## 🎮 Aktuelle Playtest-Version

### **[▶ Mind Dungeon jetzt playtesten](https://topsoliino.github.io/mind-dungeon/beta/latest.html)**

**Direktlink:** https://topsoliino.github.io/mind-dungeon/beta/latest.html

Dieser Link lädt die **neueste veröffentlichte Testversion**, inklusive frischer Skript-, Modell- und Animationsdateien, und bleibt auch bei künftigen Updates gleich. Auf dem Titelscreen zeigt das Spiel die lokale Build-ID, prüft den veröffentlichten Stand und bietet einen direkten Update-Button. GitHub Pages kann nach einem Commit noch kurz mit dem Deployment beschäftigt sein.

Die [Hauptversion](https://topsoliino.github.io/mind-dungeon/) ist nicht der aktuelle Playtest-Einstieg.

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
