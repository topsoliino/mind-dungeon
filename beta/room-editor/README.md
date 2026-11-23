# Mind Dungeon – Room Atelier (V1)

**Editor aufrufen:** `/beta/room-editor/index.html` (GitHub Pages: `https://topsoliino.github.io/mind-dungeon/beta/room-editor/`).

**Wichtig für ChatGPT Work:** Dies ist ein vollständig isolierter Raumeditor. Der aktuelle Dungeon, alle bestehenden Greyboxen, der Random-Generator, der Wächter, die Gegner und deren Rendering-Pipeline sind *unverändert*. Bitte bei späterer Integration **kein vorhandenes `beta/index.html`, `beta/alley-generator.js` oder `beta/dungeon-isometric.js` überschreiben**. Stattdessen JSON-Vorlagen als optionale Raum-Templates importieren.

## Benutzung

* **V**: Möbel selektieren/ziehen, rechts Eigenschaften ändern.
* **B**: auf die Bodenfläche klicken, um die im Dropdown gewählte unveränderte Originaltextur für den gesamten Raum zu übernehmen; keine künstlichen Schmutzspuren.
* **W**: auf eine Kante klicken, um Steinwand, Gitter, Gittertür oder offenen Durchgang zu platzieren.
* **F**: Tisch oder Stuhl platzieren; Katalog links bestimmt den Typ.
* **E**: Möbel/Wand/Boden-Sondertile entfernen.
* **R**: selektiertes Möbel in 90°-Schritten rotieren.
* **Entf**: selektiertes Möbel löschen; **Strg+D**: duplizieren.
* **Strg+Z/Strg+Y**: rückgängig/wiederherstellen (bis zu 60 Änderungen).
* Mausrad: Zoom; mittlere Maustaste: Verschieben; **G**: Raster.
* **P** / „Spieltest“: unabhängige Kollisionsprobe mit WASD, Rechtsklick-Laufziel, Linksklick-Angriff und Leertaste; keine Änderungen am laufenden Spiel oder am Wächter. Möbel mit `vaultable` können übersprungen werden, andere nicht.
* **JSON exportieren / importieren**: lokaler Datentransfer. Änderungen werden außerdem im Browser per `localStorage` gesichert.

## Ordner

| Datei / Pfad | Zweck |
|---|---|
| `index.html` | Unabhängiger Editor-Einstieg |
| `editor.css` | Oberfläche |
| `catalog.js` | Boden-/Wand-Katalog und Möbel-Eigenschaften, vorinstallierte Gefängniszelle |
| `editor.js` | Projektion, Zeichenreihenfolge, Interaktionen, Undo, Kollision, Spieltest, Export |
| `editor-art.js` | Sechs Poly-Haven-Materialien auf isometrische Boden- und Wandflächen mit physikalisch sinnvoller Größe projizieren; originalen Wächter-Atlas als Referenz verwenden |
| `presets/prison-cell-01.json` | Eigenständig importierbare Gefängniszelle |
| `blender/build-room-kit.py` | **Tatsächliche 3D-Modelle**: Tisch, Stuhl; physische Bretter, Beine, Eisennägel, Material-/Lichtsetup |
| `blender/pack-room-kit.py` | Vier Ansichten je Möbelstück in 512×512 WebP + Manifest packen |
| `blender/build-prison-tiles.py` | Historische Blender-Wand- und Bodenfallbacks (nur CI-Kompatibilität), nicht der aktive Material-Look |
| `blender/build-floor-map.py` | Importiert drei originale Poly-Haven-Boden-PNGs ohne Bildverarbeitung |
| `blender/build-wall-maps.py` | Importiert drei originale Poly-Haven-Wand-PNGs ohne Bildverarbeitung |
| `blender/pack-prison-tiles.py` | Prüft sechs unveränderte Original-PNGs und dokumentiert Quelle, SHA-256, Orientierung und echten Maßstab im v4-Manifest |
| `assets/source/prison-tiles.blend` | Editierbare Modellquelle der Steinarchitektur |
| `assets/tiles/` | Originale hochauflösende Blender-Architekturbilder, nicht prozeduraler Runtime-Shader |
| `assets/source/room-kit.blend` | Render-Workflow erzeugt die editierbare Blender-Szene |
| `assets/furniture/table-{0,90,180,270}.webp` | Eingebackene Blender-Tischansichten |
| `assets/furniture/chair-{0,90,180,270}.webp` | Eingebackene Blender-Stuhlansichten |
| `assets/manifest.json` | Metadaten der Blender-Render |
| `.github/workflows/build-room-editor-art.yml` | Erstellt und veröffentlicht Blender-Assets automatisch; commit nur in `beta/room-editor/assets/` |

## Room JSON v1 (kompatibel für spätere Generator-Integration)

```json
{
  "schema": "mind-dungeon-room/v1",
  "id": "prison-cell-01",
  "name": "Gefängniszelle",
  "width": 7,
  "height": 5,
  "floorStyle": "dungeon-ashlar",
  "wallStyle": "stone",
  "tiles": [],
  "walls": [{"x": 3, "y": 0, "edge": "north", "style": "gate"}],
  "furniture": [{
    "id": "table-01", "type": "prison-table",
    "x": 1.65, "y": 1.75, "rot": 0,
    "destroyable": true, "vaultable": false,
    "blocksMovement": true
  }]
}
```

Alle Positionen sind in **Rasterkoordinaten** (1 Kachel = 48 Spieleinheiten), Möbel-Pivot liegt in der Fußabdruckmitte. Das Render-Raster benutzt **exakt dieselbe Grundprojektion wie `AlleyStudy`**: `stepX=42`, `stepY=42/sqrt(3)`, `footOffset=16`. Das Schema enthält noch **keine** Verbindung zu einem Dungeon-Stockwerk und keine Generatorschlüssel: diese kann Work bewusst und separat ergänzen.

Die isometrische Kamera blickt von der Seite positiver X/Y-Rasterwerte auf den Raum. **Nur Nord- und West-Außenwand (Rückwände) sind sichtbar und im Beispiel überhaupt vorhanden. Süd- und Ost-Außenwand sind Cutaways und werden beim Import verworfen, damit der Ritter und die Möbel nicht überdeckt werden.** Innere Wände, Gitter und Türen bleiben vollständig bearbeitbar.

Wanddaten definieren *physische Kanten* in Rasterkoordinaten. `north/south` gehen von `(x,y)` nach `(x+1,y)`; `west/east` nach `(x,y+1)`. `bars` und `gate` blockieren Bewegung in der Kollisionsvorschau; `open` ist begehbar. Die Tür hat zunächst keinen Öffnungsmechanismus im Editor-Spieltest (dafür im Generator später echte Interaktionslogik anhängen).

### Originaler Wächter und 3D-Renderpipeline

Im Editor-Spieltest wird kein neuer Wächter erzeugt. `editor-art.js` liest **`beta/art/player-study/guardian-frames.json`** plus die Originalbilder `guardian-body.webp`, `guardian-body-2.webp` und `guardian-weapon.webp`. Idle, Walk und Vault werden aus den tatsächlichen Frame-Metadaten abgespielt; das ist der bewährte günstige Sprite-Renderpfad des Spiels, aber ohne den laufenden 3D-Renderer.

Mauern und Möbel nutzen dieselbe 35,264°-orthografische Kamera, kontrastreiches Filmic, warmen Key, kühles Fill und physische Material-/Kantenmodelle. Die zwei Böden sind jeweils **eine** große top-down-authored 4096px-Karte über fest **32×32 Welteinheiten**. Die editorseitige isometrische UV-Transformation bewahrt die Größe jedes Kratzers und Steins bei 2×2, 7×5 oder 30×30 Feldern; kleinere Räume sehen einen **zentrierten Ausschnitt** und dehnen keine Textur. Die Schere ist die physische Grundrisspolygon-Grenze. Das Raster ist ausschließlich eine optionale UI-Ebene. Die Mauer ist **ein** Stil mit zwei Sichtprojektionen, die Möbel je vier unabhängig gerenderte Ansichten.

### 3D-Renderpipeline

`blender/build-room-kit.py` erzeugt die Möbel als **ungeskinnte Blender-Meshes**, mit aufwendigen separat modellierten Holz- und Eisenteilen, realen Bevels, gewichteten Normalen, prozeduralem Material-Noise und warm/kühlem Licht ähnlich der Wächter-Pipeline. Sie brauchen **kein Armature-Rig**. 4 Kamerawinkel (jeweils exakt 90° gedreht) werden per Cycles als transparente PNGs gerendert, danach verlustarm zu WebP gepackt. Zur Laufzeit wird **kein** neues WebGL/Three.js oder synchroner Texture-Upload benötigt: der Editor zeigt die fertigen WebP-Ansichten. Ohne bereits generierte Bilder wird eine deutlich als Vorschau gekennzeichnete, isometrische Geometrie verwendet.

Die automatisierte Veröffentlichung hat ausschließlich Schreibrechte auf `beta/room-editor/assets/`, ist gegen zwischenzeitliche Quellcode-Updates abgesichert und greift **niemals in den bestehenden Wächter- oder Dungeon-Code ein**.

**Hinweis:** Der Editor ist ein Layout-/Kollisions-Prototyp für einzelne Räume. Sein „Spieltest“ ist eine leichtgewichtige geometrische Probe und **keine** vollständige Reproduktion der bestehenden Phaser-Kampf-/Gegnerphysik. Die Daten lassen sich beim späteren Generator-Import auf die eigentlichen Spielregeln mappen.

### Original-Wächter als Editorreferenz

Die Schaltfläche **Spiel-Wächter** blendet den echten Originalatlas aus `../art/player-study/` im Bearbeitungsmodus ein oder aus. Im Spieltest bleibt dieselbe reale Spielfigur steuerbar. Fehlende Originaldaten zeigen einen Fehlerzustand, keine nachgebaute Ersatzfigur.

### Schutz der Spiel-Beta

Alle Änderungen der Bodenkarte und des Editors liegen ausschließlich unter `beta/room-editor/`. Das eigentliche Spiel (`beta/index.html`, `beta/dungeon-guardian*.js`, `beta/dungeon-isometric.js`, Generator usw.) wird nicht geändert. Der schon bestehende Asset-Workflow darf weiterhin ausschließlich die Editor-Assets publizieren.

### Nasskerker-Materialien – sechs originale Poly-Haven-Fotos (V5)

Die sechs Bilder stammen direkt aus Poly Havens **Primary Preview PNGs**. Sie werden durch den Asset-Build bytegenau kopiert, **nicht** nachgefärbt, gedreht, gespiegelt, verwaschen, mit künstlichem Schmutz überzeichnet oder skaliert. Die Texturen erscheinen im Browser auf korrekt orientierten, isometrischen Boden-/Wandflächen; die Raumgeometrie selbst wird nicht verändert. Alle Materialien sind [CC0](https://polyhaven.com/license).

| Raum-Auswahl / gespeicherte ID | Originalquelle | Datei | Physischer Maßstab |
|---|---|---|---|
| Dark Rock 02 · `dungeon-ashlar` | [Dark Rock 02](https://polyhaven.com/a/dark_rock_02) | `floor-prison-01.png` | Originalhöhe 2 m, bei 2:1-Vorschau Breite 4 m |
| Coast Sand Rocks 02 · `dungeon-coast-rocks` | [Coast Sand Rocks 02](https://polyhaven.com/a/coast_sand_rocks_02) | `floor-prison-02.png` | 15 m breit, 7,5 m hoch |
| Cobblestone Floor 09 · `dungeon-cut-stone` | [Cobblestone Floor 09](https://polyhaven.com/a/cobblestone_floor_09) | `floor-prison-03.png` | 2,2 m breit, 1,1 m hoch |
| Rock Wall 17 · `stone` | [Rock Wall 17](https://polyhaven.com/a/rock_wall_17) | `wall-masonry-01.png` | 1,8 m breit, 0,9 m hoch |
| Rock Wall 16 · `stone-cut` | [Rock Wall 16](https://polyhaven.com/a/rock_wall_16) | `wall-masonry-02.png` | 2 m breit, 1 m hoch |
| Old Stone Wall · `stone-old` | [Old Stone Wall](https://polyhaven.com/a/old_stone_wall) | `wall-masonry-03.png` | 2 m breit, 1 m hoch |

**Maßstab:** Im Editor entspricht ungefähr **ein Rasterfeld einem Meter**, abgestimmt auf die zweifeldhohen Wände und den originalen Wächter. Eine fotobasierte Fläche behält in 2×2-, 7×5- und 30×30-Räumen **dieselbe Körnung und Steingröße**. Der Boden beginnt mit seiner Original-X-Achse an der Raum-X-Achse. Das Material wird über die gesamte sichtbare Fläche im Weltkoordinatensystem wiederholt; es wird nicht auf Raumgröße verzerrt.

**Wandorientierung:** Eine Wand ist zwei Rastereinheiten hoch. Das Originalfoto wird in horizontaler Wandrichtung und vertikal nach unten gemappt, **ohne Rotation/Spiegelung**. Verbindende Wandsegmente nehmen den richtigen durchgehenden Bildausschnitt, und die Fotohöhe wird mit korrekt kalibriertem Maßstab wiederholt statt auf die doppelte Höhe gestreckt. Süd-/Ostwände zur Kamera bleiben wie bisher ausgeblendet. Wände und Gitter behalten ihre bisherigen Kollisionsflächen.

**Benutzung:** Links zwischen drei Böden wählen, um die Bodenfläche des gesamten Raums umzuschalten. Für die drei Wände entweder das Dropdown oder die neuen Bildvorschauen verwenden, dann `W` drücken und eine Kante auswählen. Bestehende Raum-JSONs mit `dungeon-ashlar`, `dungeon-cut-stone`, `stone` und `stone-cut` bleiben gültig; ihre Materialabbildung wurde bewusst auf die neuen Originale aktualisiert.

**Build/Veröffentlichung:** `blender/pack-prison-tiles.py` importiert über `blender/build-floor-map.py` und `blender/build-wall-maps.py` alle sechs Fotos nach `assets/tiles/`. Das Manifest `assets/tiles/manifest.json` verwendet `mind-dungeon-room-tiles/v4` mit Dateinamen, echten Bildabmessungen, SHA-256-Hashes, Weltbreiten und der Kennzeichnung `original-photo-byte-identical`. Drei ältere WebPs bleiben nur wegen des unveränderten Editor-Art-Workflows bestehen; die Runtime lädt sie für die sechs neuen Materialoptionen nicht.

**Hauptspielschutz:** Ausschließlich `beta/room-editor/**` wurde geändert. Keine Änderungen an Wächter, Hauptspiel-Beta, Gegnern, Generatoren oder `.github/**`.
