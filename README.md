# Mind Dungeon: Shadowbound v0.6

Browserbasiertes Top-down-Lern-RPG mit KVT-III-Fragen zu Konfrontationsverfahren.

**Spielen:** https://topsoliino.github.io/mind-dungeon/

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
| Q | Lernjournal / JSON-Import |
| P | Pause |

Sobald Maus oder Touchpad bewegt werden, bleibt die Waffenrichtung bei WASD-Bewegung erhalten. Mit **F** wechselt man zurück zur Laufrichtungs-Zielsteuerung.

## Charakterentwicklung

Neun an Dark Souls III angelehnte Attribute: Vigor, Attunement, Endurance, Vitality, Strength, Dexterity, Intelligence, Faith, Luck. Pro Levelaufstieg kann ein Punkt vergeben werden. Waffen skalieren mit mehreren Attributen; Truhen und große Gegner geben Waffen und Ringe. Es gibt zwei Ringplätze, die Kampfboni gewähren. Gegner haben unterschiedlich große Varianten und zwei angekündigte Spezialattacken, denen man ausweichen sollte.

## Fragenpakete

Das offizielle Fragenpaket liegt **außerhalb des Spielcodes** in `questions/kvt3.json`. Es enthält **47 Aufgaben**: 37 Multiple-Choice-Aufgaben und 10 Freitextfragen (je 2 pro Themenbereich). Neue Pakete können über das Lernjournal importiert werden.

JSON-Schema für Freitext:

```json
{
  "schemaVersion": 1,
  "packId": "beispiel",
  "questions": [{
    "id": "beispiel-01",
    "topic": "PTBS",
    "difficulty": 2,
    "type": "free-text",
    "prompt": "Wie heißt die Unterscheidung zwischen damals und heute?",
    "answers": ["Diskriminationstraining"],
    "explanation": "Training zur Unterscheidung vergangener und aktueller Gefahr.",
    "source": {"document": "folien.pdf", "page": 17}
  }]
}
```

Antwortvergleich ignoriert Groß-/Kleinschreibung, Leerzeichen, Satzzeichen und toleriert je nach Antwortlänge kleine Tippfehler. Bei offenen Antworten ist dies eine **regelbasierte** Prüfung gegen hinterlegte Varianten, keine semantische KI-Bewertung.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `/(root)`.

Der Spielstand bleibt im Browser-LocalStorage. Vor größeren Änderungen im Lernjournal exportieren.

## Quellen

- Vorlesungsskript `04_KVT_3_SKRIPT.pdf` (KVT III – Konfrontationsverfahren); Seitenangaben stehen bei jeder Frage.
- Attribute orientieren sich an Dark Souls III, die konkreten Kampfwerte sind eigenständig für Mind Dungeon balanciert.
