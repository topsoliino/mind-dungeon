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
| `editor-art.js` | Original-Blender-Wandbilder und eine durchgehende 4096px-Bodenkarte sowie ORIGINALEN vorgerenderten Wächter-Atlas laden; kein Three.js und kein neues Rig |
| `presets/prison-cell-01.json` | Eigenständig importierbare Gefängniszelle |
| `blender/build-room-kit.py` | **Tatsächliche 3D-Modelle**: Tisch, Stuhl; physische Bretter, Beine, Eisennägel, Material-/Lichtsetup |
| `blender/pack-room-kit.py` | Vier Ansichten je Möbelstück in 512×512 WebP + Manifest packen |
| `blender/build-prison-tiles.py` | Ein vorhandener 512px-Referenzboden und zwei Blender-Maueransichten; in der App wird stattdessen die jeweils zusammenhängenden 4096px-Bodenkarten verwendet |
| `blender/build-floor-map.py` | Importiert die beiden originalen Poly-Haven-Vorschau-PNGs ohne Bildverarbeitung |
| `blender/build-wall-maps.py` | Importiert die beiden originalen Poly-Haven-Mauer-PNGs ohne Bildverarbeitung |
| `blender/pack-prison-tiles.py` | Prüft vier Original-PNGs und protokolliert Dateigröße, Quelle und SHA-256 im Manifest; CI-Fallbacks bleiben erhalten |
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

### Original-Fotomaterialien (V4) – ohne jegliche Nachbearbeitung

**Wichtig:** Es werden die **exakten Poly-Haven-Vorschaubilder (Primary Previews)** heruntergeladen und als unveränderte PNG-Bytes im isolierten Raumeditor gespeichert. Die vorherigen zusammengesetzten Texturen mit künstlichen Rissen, Schmutz, Feuchtigkeit, Kontrastanpassungen und Filtermasken sind **nicht mehr der aktive Renderpfad**. Der Download wird bytegenau per SHA-256 im Manifest nachgewiesen; er ist **keine Neugenerierung** von Texturen.

| Materialauswahl | Unveränderte PNG-Datei | Originalreferenz |
|---|---|---|
| Boden I · Monastery Stone Floor | `assets/tiles/floor-prison-01.png` | [Monastery Stone Floor](https://polyhaven.com/a/monastery_stone_floor) |
| Boden II · Rectangular Paving | `assets/tiles/floor-prison-02.png` | [Rectangular Paving](https://polyhaven.com/a/rectangular_paving) |
| Steinmauer I · Medieval Wall 02 | `assets/tiles/wall-masonry-01.png` | [Medieval Wall 02](https://polyhaven.com/a/medieval_wall_02) |
| Steinmauer II · Stone Block Wall | `assets/tiles/wall-masonry-02.png` | [Stone Block Wall](https://polyhaven.com/a/stone_block_wall) |

Quelle [Poly Haven](https://polyhaven.com/) unter [CC0-Lizenz](https://polyhaven.com/license). Die Dateien aus dem Poly-Haven-CDN werden mit `?height=2048&quality=95` angefragt und **unverändert** als PNG gespeichert. Ihre tatsächlichen Pixelmaße stehen im generierten `assets/tiles/manifest.json`, nicht in einer geratenen 4096er-Grenze. Für eine stabile Bildzuordnung lädt der Browser ausschließlich diese vier lokalen Editor-Dateien, wenn `textureMode: "original-photo-byte-identical"` und zugehörige Prüfsummen vorliegen.

**Im Editor:** Boden I und II werden links im Boden-Dropdown **für den gesamten Raum** umgeschaltet (kein Übermalen einzelner Felder mit künstlichem Schmutz). Die Mauern werden links im Wand-Dropdown ausgewählt, danach mit `W` an einer Kante gesetzt oder ersetzt. Die bestehenden Wand- und Möbel-Kollisionen bleiben gleich, alte Raum-JSON-IDs (`dungeon-ashlar`, `stone`) bleiben kompatibel.

**Projektion und Skalierung:** Die unveränderten Bilder werden lediglich auf die geometrischen isometrischen Flächen gemappt. Ein Bodenbild deckt bei 2:1-Seitenverhältnis 12×6 Rastereinheiten ab; bei großen Räumen wiederholt der Renderer dieses **unveränderte** Originalbild, statt eine andere Bodenkarte zu erzeugen. Mauerbilder werden abschnittsweise über vier durchgehende Wandsegmente gelegt (2 Welteinheiten hoch), ohne zusätzliche Fugen, gemalte Risse oder dunkle Überlagerungen. Ein einfaches, einfarbiges Ersatzmaterial zeigt fehlende Dateien an, niemals die alten künstlichen Texturen.

**Build:** Der vorhandene und unveränderte Editor-Art-Workflow ruft über `blender/pack-prison-tiles.py` die beiden Downloader `blender/build-floor-map.py` und `blender/build-wall-maps.py` auf. Die drei bisherigen Blender-WebP-Dateien bleiben nur für Kompatibilität mit der CI-Prüfung bestehen, werden aber **nicht** zur Darstellung der neuen Original-Materialien herangezogen.

**Hauptspielschutz:** Änderungen ausschließlich unter `beta/room-editor/**`; keine Veränderung von `beta/index.html`, `beta/dungeon-isometric.js`, Wächter-/Gegnerdateien oder `.github/**`.
