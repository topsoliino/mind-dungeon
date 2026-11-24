# Mind Dungeon — Room-JSON → Beta-Generator
## Verbindliche Integrationsanleitung für ChatGPT Work

Stand: 24.11.2026 | Schema: `mind-dungeon-room/v1`

**Ziel:** Im Room Atelier gestaltete Räume als unveränderliche Architekturvorlagen in den tatsächlich spielbaren prozeduralen Beta-Dungeon integrieren. Diese Anleitung ist der Vertrag für die zukünftige Integration, **keine Behauptung, dass diese Integration bereits existiert**. Aktuell sind Portalbearbeitung, lokaler JSON-Import/-Export und lokale Portalprüfung implementiert. Die Beta lädt diese Raumvorlagen noch nicht.

### 0. Arbeitsauftrag und Grenzen

- Repository: `topsoliino/mind-dungeon`, aktuellen Branch/HEAD vor Änderungen prüfen.
- Lies zuerst [AGENTS.md](AGENTS.md), [Editor-README](README.md), die gelieferten Raum-JSONs und die aktuellen Generator-/Render-/Navigationsquellen. Der isolierte Editor-Workflow darf ausschließlich `beta/room-editor/**` schreiben. Änderungen an der spielbaren Beta sind ChatGPT Work im ausdrücklich beauftragten Integrationsworkflow vorbehalten.
- Keine vollständige Ersetzung bestehender Beta-Dateien durch einen neuen Demo-Generator. Baue einen kleinen, testbaren Template-Adapter und gezielte Integrationsstellen in die tatsächliche Beta. Erhalte Legacy-Generator, Titelbildschirm, Wächter, Gegner, Kämpfe, Wissensaltäre, Treppen, Fog of War, Loot und Persistenz.
- Keine Artwork-Neugenerierung, kein Ersatz von Möbeln oder Materialien durch Greyboxes, keine globalen Balanceänderungen.
- Vor der Integration benötigt Work die konkreten JSON-Dateien, ihre Freigaben und verbindlichen Stückzahlen. Fehlen diese, nicht raten oder die Musterzelle ungefragt in das Hauptspiel einbauen.

### 1. Tatsächliches Dateiformat

Vollständige Minimalvorlage (illustrativ; Freigaben separat):

```json
{
  "schema": "mind-dungeon-room/v1",
  "id": "example-room",
  "name": "Beispielraum",
  "width": 4,
  "height": 3,
  "floorStyle": "dungeon-ashlar",
  "wallStyle": "stone",
  "tiles": [],
  "walls": [
    {"x": 0, "y": 0, "edge": "north", "style": "stone"},
    {"x": 1, "y": 0, "edge": "north", "style": "stone"},
    {"x": 3, "y": 0, "edge": "north", "style": "stone"}
  ],
  "furniture": [],
  "portals": [
    {"side": "north", "offset": 2, "width": 1},
    {"side": "south", "offset": 1, "width": 2}
  ],
  "notes": ""
}
```

| Feld | Bedeutung / Vertrag |
|---|---|
| schema | Exakt mind-dungeon-room/v1. Unbekannte Version melden statt blind interpretieren. |
| id, name | Stabile Vorlagen-ID und Anzeigename. Jede platzierte Instanz erhält zusätzlich eine eindeutige Instanz-ID. |
| width, height | Ganze Rasterfelder, aktuell jeweils 2–30. Ohne floorCells vollständiges Rechteck, sonst Begrenzung der expliziten Zellmaske (Kapitel 13). |
| floorStyle | Standardmaterial des Bodens, Schlüssel aus catalog.floors. |
| wallStyle | Im Editor ausgewählter Standard-Wandtyp, NICHT eine implizite Umrandung. |
| floorCells | Optional: explizite begehbare Grundrisszellen {x,y}, siehe Kapitel 13. |
| tiles | Optionale Bodenmaterial-Overrides mit x, y, style; leeres Array bedeutet Standardboden, keine fehlenden Bodenzellen. |
| walls | Explizite, je ein Rasterfeld lange horizontale/vertikale Wandsegmente, einschließlich innerer Wände. |
| furniture | Objektinstanzen; Position, Rotation, Kollisions-/Interaktionsflags, ggf. Wandbindung. |
| portals | Explizit erlaubte Anschlüsse auf Außenkanten. |
| notes | Freitext, keine ausführbaren Anweisungen und kein Generator-Steuerfeld. |

Autoritative Asset-/Physikdefinitionen: [catalog.js](catalog.js) (MindRoomKit.catalog), [placement.js](placement.js), [architecture.js](architecture.js), [portals.js](portals.js), [assets/manifest.json](assets/manifest.json), [assets/tiles/manifest.json](assets/tiles/manifest.json). Vollständiges echtes Beispiel: [presets/prison-cell-01.json](presets/prison-cell-01.json).

### 2. Koordinatensystem und Wände (kritisch)

Raumlokale Grundrisskoordinaten, **nicht** Bildschirmkoordinaten: X wächst nach Osten/rechts im Grundriss, Y nach Süden/unten. Ursprung (0,0) ist Nordwest. Ein Rasterfeld entspricht ungefähr 1 m bzw. 48 Spieleinheiten. Die Editor-Projektion (42 px × 42/sqrt(3)) ist eine Darstellung, keine Welt-Skalierung.

Bodenzelle (x,y) belegt [x,x+1] × [y,y+1], 0 <= x < width, 0 <= y < height. Möbel x/y sind kontinuierliche Koordinaten des Fußabdruck-Zentrums, nicht Zellindizes.

Wandkoordinaten bezeichnen bereits die **geometrische Gitterlinie**:

| edge | Endpunkte | Gültige Koordinaten |
|---|---|---|
| north oder south | (x,y) → (x+1,y) | 0 <= x < width; 0 <= y <= height |
| west oder east | (x,y) → (x,y+1) | 0 <= x <= width; 0 <= y < height |

Der Editor normalisiert horizontale Segmente zu north und vertikale zu west. Deshalb ist beispielsweise eine Wand mit edge=north und y=height tatsächlich eine **Süd-Außenwand**. Kein zusätzliches +1 wegen des edge-Werts! Kanonischer Schlüssel: h:x:y oder v:x:y.

- Wandtyp pro Segment aus catalog.walls[style], insbesondere stone-Varianten, bars, bars-full, bars-half, gate, open. `open` hat solid=false und ist keine physische Mauer. Alle übrigen aktuellen Typen sind solid, einschließlich des halbhohen Gitters und der derzeit festen Zellentür gate.
- Wände nie schneiden, entfernen, verschieben, durch andere Stile ersetzen oder durch Siegeltore überdecken. Innenwände ebenfalls bewahren. Eine explizite open-Markierung nicht mit einer generierten festen Wand überschreiben.
- Süd-/Ost-Außenwände können im Editor durch die Kamera ausgeblendet sein. Trotzdem bleiben gespeicherte Segmente physisch vorhanden. Bei **alten Exporten**, die solche Wände noch nicht speicherten, lässt sich nicht rekonstruieren, ob sie gewollt waren. Fehlende Wände nicht erfinden; bei unklarer Raumabsicht vom Nutzer bestätigen oder neu exportieren lassen.
- Das äußere Rechteck allein ist keine Mauer. Keine automatisch geschlossene Standardumrandung um die Vorlage legen. Unbelegte Außenkante bedeutet keine authored Wand, aber noch keinen autorisierten Anschluss.
- Falls unmarkierte offene Außenkanten an andere begehbare Räume grenzen oder ungenutzte Portalöffnungen nach außen führen: keine unerlaubten Übergänge. Als Standard Platzierung mit nicht begehbarer Außenfläche oder alternativer Anordnung wählen. Ergänzende Abschlusswände auf **nicht** authored Kanten nur nach expliziter Freigabe; nie auf open-Segmenten oder durch vorhandene Architektur. Keine unsichtbaren willkürlichen Barrieren.

### 3. Portale: explizite Anschlusskanten

```json
{"side":"east","offset":2,"width":1}
```

Alle Angaben sind raumlokal, offset nullbasiert, width in ganzen Feldern. UI erlaubt derzeit 1–3; die Datenlogik akzeptiert 1–30, begrenzt durch die jeweilige Seitenlänge.

| side | Geometrisches Segment | Nach außen |
|---|---|---|
| north | (offset,0) bis (offset+width,0) | (0,-1) |
| south | (offset,height) bis (offset+width,height) | (0,+1) |
| west | (0,offset) bis (0,offset+width) | (-1,0) |
| east | (width,offset) bis (width,offset+width) | (+1,0) |

`offset >= 0`, `width >= 1`, `offset+width <= Seitenlänge`. Gleichartige überlappende Portale sind ungültig; angrenzende dürfen getrennt bestehen. Ein Portal ist eine **bereits freie Öffnung**, weder eine Tür noch ein Auftrag zum Wandabbau. Keine Öffnung an beliebiger anderer Kante suchen.

Verwende MindRoomPortals.inspect(room, portal, catalog, placement) als lokale Vorprüfung. Sie prüft Grenzen, Überlappungen, feste Wand-/Gittersegmente, in den 0,7-m-Innenbereich ragende querstehende Wände, nicht zerstörbare blockierende Möbel und Höhenflächen. Zerstörbare Möbel sind gemäß Nutzerregel zulässig. Die Prüfung ist bewusst konservativ und ersetzt keine interne Wegsuche. Der Editor blockiert momentan Portale auf gate, weil der Typ noch eine feste Wand darstellt; erst nach einer separat implementierten und geprüften dynamischen Türmechanik wäre das anders.

Importe ohne portals bzw. mit leerem Array sind gültige **Editor-Entwürfe**, aber keine freigegebenen Generator-Templates. Ungültige Portale nicht ignorieren oder eigenmächtig korrigieren. Die alte Datei bleibt unverändert. Im Editor C drücken, Durchgänge markieren (oder Vorschläge bestätigen), neu exportieren.

### 4. Verbindliche Regeln für Nachbarschaft

Die folgenden Regeln gelten für jedes gemeinsame **Teilsegment** der Kante, nicht pauschal für die gesamte Rechteckseite.

| Feste authored Wand A | Feste authored Wand B | Geometrische Nachbarschaft | Direkter Übergang |
|---|---|---|---|
| ja | ja | verboten, auch bei identischem Material | nein |
| ja | nein | erlaubt | nein |
| nein | ja | erlaubt | nein |
| nein | nein | erlaubt | nur bei autorisiertem gültigem Anschluss und begehbarer Geometrie |

Eine gemeinsame Endpunkt-Berührung zweier Wände ist keine doppelte Belegung. Keine überlappenden Raumflächen auf demselben Stockwerk. Diagonale Eckberührung ist kein Durchgang. Nicht nur die Kante zum gewählten Elternraum, sondern alle durch eine Platzierung entstehenden Nachbarschaften prüfen. Eine durchgehende kollidierende Kante macht die Platzierung ungültig, auch wenn an anderer Stelle ein Portal vorhanden ist.

Für direkten Anschluss zweier Templates: entgegengesetzte Außen-Normalen, deckungsgleiche Portalsegmente in Weltkoordinaten und gleiche Bodenhöhe. Für den ersten Integrationsschritt volle Übereinstimmung der Breiten und Endpunkte fordern (keine teilweise Portalnutzung); Korridore können verschiedene Breiten über eine kollisionsfreie Übergangsfläche verbinden. Legacy-Räume/Korridore erhalten kompatible Anschlusskanten im Adapter. Ihre automatische Wandgenerierung darf keine zweite feste Wand neben eine authored Wand stellen und keine authored Wand entfernen.

Jede Vorlage, die für denselben Scope freigegeben ist, darf unabhängig von Name oder Raumtyp mit anderen kompatiblen Vorlagen benachbart sein. Korridore sind ausdrücklich erlaubt und belegen eigene, kollisionsfreie Flächen. Öffnungen nur dort, wo der Anschlussplan sie vorsieht. Türen/Siegeltore sind eigenständige dynamische Spielobjekte in einem vorhandenen Durchgang; sie ersetzen niemals ein authored Segment.

### 5. Instanziierung und optionale Rotation

Klonen, nicht mutieren. Alle Bodenzellen, Materialien, Wandendpunkte, Portale, Möbelmittelpunkte, Fußabdrücke, Wandreferenzen und Höhengeometrien in **einer** gemeinsamen Transformation nach Weltkoordinaten überführen. Keine zufällige Umskalierung der Vorlage.

Erste Version: Translation und 0° reichen; Rotationen nur freigeben, wenn alle Asset-/Kollisions-/Höhenpfade die Drehung unterstützen. Kein Spiegeln als Default. Bei erlaubter Drehung im Uhrzeigersinn um 90° in Y-down-Koordinaten gilt für geometrische Punkte:
- 0°: (x,y)
- 90°: (H-y,x), neue Größe H×W
- 180°: (W-x,H-y)
- 270°: (y,W-x), neue Größe H×W

Zellen aus transformierten Eckpunkten rekonstruieren (nicht Zellindizes wie Punkte behandeln). Wand- und Portal-Endpunkte beide transformieren, anschließend normalisieren und neue side/offset/width aus der transformierten Außenkante ableiten. Für Möbelmittelpunkte dieselbe Transformation; rot=(rot+turn) mod 360, sofern die Renderer-Konvention dazu passt (an realen Asset-Views prüfen).

Möbelbeispiel:
```json
{
  "id":"chair-01", "type":"prison-chair",
  "x":4.25, "y":2.65, "rot":270,
  "destroyable":true, "vaultable":true, "blocksMovement":true
}
```
Typ aus catalog.furniture, tatsächliche Fußabdrücke/HP/Höhen daraus beziehen, explizite Instanzflags haben Vorrang vor Defaults. Wandarchitektur enthält zusätzlich wallRef (h:x:y oder v:x:y) und wallOffset (Position entlang des kanonischen Wandsegments); diese Referenz samt Offset bei Endpunktumkehr transformieren (1-offset). Nicht frei versetzen. Für die vorhandenen Wandarchitektur-Assets gilt im Editor (Blender +Y als Vorderseite, Render-Z=90°−rot): horizontale Nord-Innenseite = rot 180, vertikale West-Innenseite = rot 90. Bei älteren JSONs mit horizontalem rot 0 die Wandbindung über architecture.refreshMount normalisieren, nicht die Architektur verschieben. Die jetzige Editor-Wandmount-Logik unterstützt nicht alle Orientierungen; daher Rotation für betroffene Templates deaktivieren, bis vollständige Unterstützung nachgewiesen ist. Ebenso Höhenzugang (Treppen-/Rampenseite, Loch) und Kollisionsgeometrie korrekt transformieren; aktuelle Editor-Höhenlogik ist nicht allgemein rotationsinvariant.

Instanzobjekt-ID z.B. dungeonId/level/storey/roomInstanceId/localObjectId; stabile IDs für Loot/Schäden/Persistenz und keine Duplikate zwischen Stockwerken. Möbel nicht nachträglich an freie Stellen verschieben. Die Vorlage ist das Original, die Spielinstanz trägt veränderlichen Zustand.

### 6. Freigabe und exakte Häufigkeiten

**Noch nicht Bestandteil des Editor-JSON-Schemas.** Keine automatische Interpretation von notes, Dateinamen oder room.id als Freigabe. Für die Integration die Nutzerangaben separat in einer Konfiguration festhalten. Beispiel eines vorgeschlagenen, noch nicht implementierten Manifestformats:

```json
{
  "scope": "rocky-coast-prison",
  "roomBudgetPerStorey": 15,
  "templates": [
    {
      "file": "room-editor/presets/prison-cell-01.json",
      "templateId": "prison-cell-01",
      "placements": [
        {"level": 2, "storey": 1, "count": 3},
        {"level": 3, "storey": 2, "count": 1}
      ],
      "allowedRotations": [0]
    }
  ]
}
```

**Beispielzahlen, keine tatsächliche Nutzerfreigabe.** Relative Pfade bezogen auf beta/; endgültige Speicherstelle bei Integration bestimmen.

Im aktuellen Rocky-Coast-Code ist level die Dungeon-Stufe (1–4 innen, 5 Außenwelt), storey das physische Stockwerk innerhalb einer Stufe (1-basiert im URL-Parameter). Es existieren je nach Seed 2–4 Stockwerke. Interne Floor-Indizes können 0-basiert sein oder einen lokalen Treppenstatus meinen; nicht mit level/storey vermischen. Der Legacy-Generator erzeugt derzeit 15 Räume (kind=raum), Startgasse und Gänge separat, und nutzt einen gemeinsamen Grundriss pro Stufe für deren Stockwerke.

Vor Freigabe klären, ob X exakt pro Stockwerk, insgesamt innerhalb einer Dungeon-Stufe oder für eine gesamte Run-Konfiguration gelten soll. Bei explizit ausgewähltem Stockwerk gilt X exakt dort. Für eine stufenweite Quote muss die Summe über alle tatsächlich existierenden Stockwerke X ergeben; keine Vervielfachung durch wiederverwendeten Grundriss. Nicht existierende Stockwerke nicht stillschweigend umdeuten. Falls verschiedene Stockwerke unterschiedliche Vorlagen/Quoten erhalten, muss die gemeinsame Layout-Struktur angepasst werden (stockwerkspezifische Geometrie, Objekte, Navigation und Treppenanschlüsse) oder die Konfiguration als aktuell nicht unterstützbar gemeldet werden.

- Nicht freigeschaltet = 0 Instanzen. X ist eine harte ganze Zahl, kein Gewicht und kein Maximum. Mehrere Vorlagenquoten addieren sich.
- Budget 15 (bzw. vom Nutzer konfigurierte N) zählt reguläre Räume inklusive Templates; Gänge und Startgasse zählen im heutigen Generator nicht dazu. Beispiel: 3 Vorlageninstanzen + 12 Legacy-Räume, nicht 3 zusätzliche Räume.
- Budgetüberschreitung, fehlende Dateien, doppelte Vorlagen-IDs, unzulässiger Scope oder unlösbare Platzierung: expliziter Fehler mit seed/level/storey/templateId/erwarteter und erreichter Quote. Keine leeren Räume, anderen Templates oder stillen Quotenänderungen als Ersatz.

### 7. Tatsächliche Integrationsstellen in der Beta

Geprüfte Quellen (Stand dieses Dokuments; bei späterer Arbeit aktuellen Code lesen):

- [../index.html](../index.html): Script-Reihenfolge, lädt den Generator als klassisches Script.
- [../alley-generator.js](../alley-generator.js): `generate(n)`, `makeShape`, rooms/cells/occ/doors, parent/exits, openings, walls/wallBlocks/wallIndex, extend(map), roomAt, blocked, containsGround, path/prewarm/clearNavigation. Öffnet heute zufällige Kanten, verhindert zusätzliche Nachbarschaften, skaliert die Layoutzellen anschließend um 2 bzw. 2.4 und baut automatisch Umrandungen und Innenwände. Für Templates müssen alle diese Pfade die authorisierten Daten respektieren.
- [../rocky-coast-prison.js](../rocky-coast-prison.js): URL-Parameter region, level, storey, run/seed, Übergänge. Rocky Coast Stufe 5 ist kein Innen-Dungeon.
- [../alley-study-map.js](../alley-study-map.js), [../alley-study.js](../alley-study.js), [../dungeon-isometric.js](../dungeon-isometric.js): tatsächliche Boden-/Wand-/Objektdarstellung und Spielintegration; vorhandene Kamera-/Depth-Sort-Pipeline weiterverwenden.
- [../alley-vertical.js](../alley-vertical.js), [../alley-stair-navigation.js](../alley-stair-navigation.js), [../alley-level-sites.js](../alley-level-sites.js): Stockwerke/Treppen, pro Ebene platzierte Altäre/Truhen/Türen/Händler/Brautische, Kollisionsintegration. Nicht nur den Grundriss ändern und diese Verbraucher vergessen.

**Spezifische Fallstricke:**
1. Das bestehende post-hoc-Expandieren um 2/2.4 nicht auf authored 1-m-Raumdaten anwenden. Vorzugsweise gemeinsame endgültige Rasterkoordinaten vor der Platzierung festlegen; Legacy-Masken vorab expandieren, Templates maßhaltig instanziieren. Rendering und Navigation müssen dieselbe Einheit (48 Spieleinheiten/Feld) verwenden.
2. Bestehende automatische Grenzwände, Innenwände, Außen-Ausgangssuche, Treppen-/Site-Reservierung dürfen Templates nicht überformen. Für Templates nur ihre tatsächlichen Wände und autorisierten Anschlüsse übernehmen; weitere Einbauten nur an nachweislich zulässigen Stellen (standardmäßig in Legacy-Räumen/Korridoren). Authored freie Zugänge nicht durch Altäre/Truhen blockieren.
3. Template-Portale nicht mit generator.portals verwechseln: Letzteres bezeichnet im jetzigen Generator Außen-Eingang/-Ausgang. Adapter verwendet z.B. templatePortals und leitet gültige Verbindungen in bestehende doors[].edges über. Dort sind edges Paare benachbarter **Bodenzellindizes**, nicht Endpunkte einer Wand.
4. Der alte Generator nutzt rooms[id] und parent-basierte Tiefen. Eindeutige kompatible Raum-IDs/Indexierung und Elternbaum erhalten; zusätzliche Rundwege nachträglich als weitere exits/doors hinzufügen, ohne parent-Zyklen.
5. Stockwerkspezifische Kollisions-/Render-/Nav-Caches korrekt trennen. Nach Öffnen/Zerstören dynamischer Hindernisse clearNavigation bzw. äquivalente Invalidierung auslösen. Statische Wände bleiben unverändert.
6. JSON und Katalog laden, bevor synchron erzeugende Generatorlogik ausgeführt wird. Über bestehenden Loader oder einen expliziten asynchronen Bootstrap; keine Race Conditions, keine Fetches pro Frame. Relative GitHub-Pages-Pfade unter beta/room-editor/ verwenden und Fehler sichtbar machen. Legacy-Modus ohne freigegebene Templates muss weiterhin starten.

### 8. Empfohlener Generatorablauf (Algorithmus)

```text
load configuration + exact template files
strictly validate schema, ids, material/type references, authored geometry, portals
resolve level/storey scope, exact quotas and room budget
normalize legacy and authored geometry into final common world grid

for bounded deterministic seeded placement attempts:
    select exact room multiset for scope
    plan connected graph, including mandatory stair/entrance/exit reservations
    place templates (most constrained first), then compatible legacy rooms/corridors
    check footprint overlap and every shared boundary segment
    connect only compatible portals / planned legacy openings
    if dead end: undo placement (backtracking) or restart with deterministic attempt seed
    add optional valid shortcuts; no forced linear chain
    build authored walls, legacy walls, floors, objects and actual collision index
    reserve/place dynamic doors/seals and gameplay sites on valid free positions
    validate actual traversal and progression including floor links
    verify exact quotas and all authored geometry against source
    if all checks pass: publish layout atomically and spawn runtime objects
fail with explicit diagnostic; do not publish partial or invalid layout
```

Kein unendliches rerollen auf dem Hauptthread. Seed + Konfiguration + Template-Version sollen reproduzierbare Layouts ergeben. Begrenztes Backtracking, räumliche Indizes für Kanten-/Flächenprüfung, Caches; beim Lauf keine wiederholte Vollprüfung der kompletten Welt. Testmodus und Feature-Flag empfohlen; bei deaktiviertem Flag bleibt der Legacy-Generator unverändert.

### 9. Erreichbarkeit ist mehr als ein Raumgraph

Der Pflichtgraph muss vom tatsächlichen Eintritt/Spawn des jeweiligen Stockwerks aus alle normalen Räume erreichen. Auf oberen Stockwerken ist das ggf. die Treppenlandung, nicht die Startgasse. Graphkanten existieren ausschließlich bei physisch nutzbaren Verbindungen. Alle zulässigen Portale und internen Teilflächen über reale Kollisionsgeometrie (inkl. Spieler-Kollisionsradius, Höhe, Wände und Objekt-Fußabdrücke) prüfen. Kein Raum gilt als erreichbar, wenn lediglich sein Portal erreichbar ist, aber der beabsichtigte Nutzbereich oder ein notwendiger Ausgang durch eine feste Innenwand abgetrennt ist. Gewollt unzugängliche Dekorflächen separat deklarieren lassen; nicht automatisch als begehbar werten.

Zwei Prüfungen:
- **Strukturell:** feste Wände, nicht zerstörbare Objekte und unpassierbare Höhen bleiben blockierend; wirklich zerstörbare/öffnungsfähige Hindernisse dürfen hypothetisch überwunden werden. Keine Bewegung durch Void, Death Zones, zu steile Kanten oder ungültige Treppen.
- **Progression:** benötigte Schlüssel, Wissensaltar-/Siegelbedingungen und Interaktionen müssen aus dem aktuellen erreichbaren Bereich tatsächlich erfüllbar sein. Ein Schlüssel hinter seiner eigenen verschlossenen Tür ist unzulässig, wenn kein anderer legaler Zugang existiert. Prüfe iterativ erreichbare Bereiche, erfüllbare Bedingungen, freigeschaltete Hindernisse. Ein Objektflag allein garantiert keine funktionierende Zerstörbarkeit im Live-Spiel. Falls dynamische Siegeltore erst entsiegelt und danach zerstört werden können, beide Schritte abbilden.

Zusätzliche Rundwege/Abkürzungen nur nach Sicherung der Pflichtverbindungen. Ein optionaler unbenutzter Portalmarker verlangt nicht zwingend einen Nachbarraum, aber seine unverbundene Außenkante darf keinen unerlaubten Ausgang in Void oder fremde Räume erzeugen. Kein globales Blockieren sämtlicher Wege als Reparatur.

### 10. Rendering, Assets, Performance

Benutze die tatsächlich bestehenden Editor-Materialmaps und vier vorgerenderten Möbelansichten gemäß Katalog und Manifest; nicht nur ähnliche Texturen. Rotation, Fußpunkt und Maßstab gegen den Original-Wächter prüfen. Bodenmaterial kontinuierlich projizieren; individuelle Wandmaterialien und Höhen (inkl. Gitter) beibehalten. Sichtbarkeits-Cutaway ist rein visuell: auch nicht gezeichnete Wände bleiben in Kollisions- und Navigationsdaten. Authored Höhenobjekte benötigen echte passende Begehbarkeit, nicht nur ein Sprite. Falls ein Typ im Live-Spiel noch nicht vollständig unterstützt wird, Integration dieses Templates ablehnen oder den Typ zuerst sauber adaptieren, nicht still weglassen.

Deduplizierter Asset-Cache nach Typ/Orientierung/Material, bedarfsgerechtes Laden. Keine Blender-Ausführung im Browser. Behalte räumlichen Wall-Index, Depth-Sort und Fog-of-War-Raumzuordnung bei. Ziel aus dem Projekt: mindestens 30 FPS im realistischen Kampfplaytest; tatsächliche Messung angeben, nicht garantieren ohne Messung.

### 11. Tests und Abnahmekriterien (Pflicht vor Release)

Editor-Regressionsstart: `node beta/room-editor/tests/portals.test.cjs`. Dieser Test prüft lokale Portalgeometrie und JSON-Erhalt, nicht die Live-Integration. Bestehende Tests im Repository ebenfalls laufen lassen. Für die neue Integration mindestens folgende automatisierte Fälle ergänzen:

| Fall | Erwartung |
|---|---|
| Vorlage importieren und instanziieren | alle authored Segmente, Materialien, Möbel, IDs (lokale Herkunft), Flags, Wandbindungen und Portale erhalten |
| Süd-/Ost-Wände und innere Trennwand | bleiben gespeichert und physisch blockierend, trotz Cutaway |
| doppelte Wand auf einer gemeinsamen Teilkante | Platzierung abgelehnt |
| einzelne Wand auf gemeinsamer Kante | Nachbarschaft erlaubt, dort keine Traversierung |
| wandlose Kante ohne markiertes Portal | kein unerlaubter Anschluss |
| passend ausgerichtete Portale | vollständige nutzbare Öffnung, doors[].edges korrekt |
| unpassende Breiten, Gitter, gate oder blockierter Zugang | Verbindung abgelehnt, kein Wandabbau |
| Durchgang mit zerstörbarem Möbel/Tür | strukturell erreichbar; zur Laufzeit erst nach echter legaler Interaktion |
| getrennte Innenfläche / Schlüssel hinter eigenem Tor | fehlgeschlagene Erreichbarkeitsprüfung |
| Rotation (falls erlaubt) | asymmetrische Vorlage inklusive Wandoffset und Höhenzugang bleibt korrekt, vier Vierteldrehungen = Original |
| 3 Instanzen bei N=15 | genau 3 Templates und 12 Legacy-Räume im gewählten Scope, keine Vervielfachung über Stockwerke |
| ungültige Quote / fehlende Datei / unlösbares Layout | erklärender Fehler, kein stiller Ersatz |
| mehrere Seeds und Stockwerke | deterministische gültige Layouts, alle Pflichtwege/Treppen erreichbar, keine Leaks zwischen Stockwerken |
| Templates deaktiviert | Legacy-Beta startet und funktioniert wie zuvor |

Zusätzlich in der tatsächlich spielbaren Beta mit dem originalen Wächter testen: Import sichtbar, Mausbewegung durch Anschluss in beide Richtungen, Gegnerpfad/Kampf, Tür/Siegel-Interaktion, Loot, Altäre, Kamera-Cutaway, Treppenwechsel, Rückweg, Nebel und Performance. Bei reproduzierbarem Fehler Seed/level/storey und URL dokumentieren. Anzahl erfolgreicher/fehlgeschlagener Tests, Commit und nicht überprüfte Aspekte nennen. Keine Behauptung "fertig", wenn nur der Room Editor oder ein statischer Screenshot getestet wurde.

### 12. Kurzer Arbeitsauftrag zum Kopieren

> Lies beta/room-editor/README-GENERATOR-INTEGRATION.md und AGENTS.md sowie die aktuellen Beta-Quellen. Integriere ausschließlich die von mir freigegebenen Room-JSON-Dateien mit exakt vereinbarten Stückzahlen je vereinbartem Level/Storey-Scope in den echten Beta-Generator. Bewahre authored Geometrie, Materialien, Möbel und Portale vollständig. Verwende die dokumentierte segmentweise Nachbarschaftsprüfung, reale Erreichbarkeit einschließlich Progression und deterministisches Backtracking. Verändere keine anderen Gameplay-Systeme. Teste die Integration automatisiert und in der spielbaren Beta; dokumentiere Commit, Test-Seeds, Quoten und verbleibende Grenzen. Falls die Vorgaben nicht erfüllbar sind, melde den konkreten Konflikt statt Wände oder Quoten zu verändern.

**Aktueller Status:** Dieses Dokument definiert den zukünftigen Vertrag. Kein Generatorcode wurde für diese README geändert. Quotenmanifest, Template-Adapter, vollständige Navigation und Integration in die Beta stehen noch aus.


### 13. Erweiterung: frei gezeichnete Grundrisse (Floor Brush)

**Aktuelle Schema-Erweiterung (abwärtskompatibel):** `floorCells` ist optional und enthält explizite `{ "x": 0, "y": 0 }`-Bodenfelder. Ohne Feld gilt wie zuvor das vollständige Rechteck. Mit Feld gilt ausschließlich die aufgezählte, nichtleere, orthogonal zusammenhängende Zellmenge. `width`/`height` begrenzen das Raster (2–30), sind aber nicht die begehbare Fläche. `tiles` bleibt Material-Metadaten, nicht Occupancy. Nutze [shape.js](shape.js) als Referenz. L-/U-Formen und Aussparungen dürfen nicht durch automatische Rechteckfüllung geschlossen werden. Render-/Collision-/Fog-/Pathfinding- und Treppenprüfung auf tatsächlicher Zellmenge durchführen. Bei Rotation jede Zelle aus ihren transformierten Ecken rekonstruieren. Wände müssen an mindestens ein Bodenfeld grenzen; niemals automatisch abbauen.

Portale können nun zusätzlich `line` enthalten: feste Koordinate der Kante (bei north/south Y, bei west/east X). Fehlt `line`, gelten die bisherigen Außenlinien 0 bzw. width/height. Beispiel `{"side":"south","line":2,"offset":3,"width":1}` beschreibt (3,2)→(4,2), mit Boden nördlich der Kante und ohne Boden südlich. Für jedes Teilsegment des Portals muss auf der inneren Seite eine belegte Zelle und auf der äußeren Seite keine belegte Zelle liegen. `side` ist die Außen-Normale, nicht zwingend die Seite des Begrenzungsrechtecks. Portale an Einbuchtungen sind zulässig. Bei Brush-Erweiterung bleiben bestehende Portalpositionen durch explizite `line` erhalten; werden sie zu Innenkanten, sind sie ungültig und müssen vom Nutzer angepasst werden. Vollständige Integration in den Beta-Generator bleibt ein separater Auftrag.


### 14. Aktive Integration von Raumpaket 1

In der isometrischen Beta ist das Paket für Rocky Coast, Dungeon-Ebene 1, Seeds 4147–4156 aktiviert. Die sieben Exporte sind in `../room-packs/rocky-coast-1.js` unter ihrem ursprünglichen Dateistamm gebündelt. Die identischen Editor-IDs dienen weiterhin ausschließlich dem Editor. Das Budget beträgt 15 reguläre Räume je Stockwerk. Jede Vorlage erscheint auf genau einem Stockwerk pro Ebene. Die übrigen Instanzen des gemeinsamen Grundrisses sind Platzhalter.

`../alley-room-pack.js` schließt die Räume nach der Skalierung der Legacy-Geometrie über einen freien Gang an. Das erste Paket nutzt die Originalorientierung und einfeldbreite Portale. Eine neue Vorlage mit breiteren Anschlüssen erfordert eine entsprechende Erweiterung der Ganggeometrie. `../alley-room-pack-art.js` verwendet die Materialien, Kollisionsmaße und vorgerenderten Ansichten aus dem Editor-Katalog. Das Öffnen eines Siegeltors folgt der bestehenden Spielmechanik. Monster verwenden die reguläre Wegsuche. Zu den Spielobjekten gehören genau ein Brautisch mit großem Kessel, ein Händler, fünf Truhen, zehn Wissensaltäre und zwei Siegeltore auf der Ebene.

Regression aus dem Repository-Stamm ausführen mit `node tools/check-rocky-room-pack.cjs`.

### 14. Crypt Environment v3

Neue Katalogkategorien `lighting` und `ambient-life`; Wandmontage ist über `wallMounted:true` (nicht nur category) erkennbar. Erhalte `wallRef`/`wallOffset`, instanziiere die Lichtparameter aus `catalog.js` (`lights`: lokale Blender-x/y/z, Flammenhöhe, Lichtradius); `environment.js` dokumentiert die Umrechnung. Die Shader-/Glow-Vorschau ist editorlokal, keine Hauptspiel-Lichtengine. `ambient-roaches` / `ambient-flies` sind nicht blockierende Runtime-Emitter ohne statische PNGs; Pfade müssen im realen Dungeon pro Raum/Stockwerk die tatsächliche Kollisionsgeometrie nutzen. Bodenarchitektur v3 verwendet lokale +Y-Stufenrichtung und Render-Z=-90-rot (nur `arch-*`), genaue Höhenprofile in `architecture.js`; übrige Assets behalten die alte Konvention. Rotation der sechs Bodentypen wurde logisch geprüft; Live-Integration und visuelle Kontrolle bleiben separat erforderlich.

Für die Live-Integration: Schaben (`ambient-roaches`) in den Boden-Renderpass zwischen flacher Boden-Deko und allen aufstehenden Objekten/Spieler einordnen. Nicht als Overlay nach dem Depth-Sort zeichnen. Fliegen behalten ihren Luftpass.
