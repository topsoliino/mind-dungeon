# Mind Dungeon – Room Atelier (V1)

**Editor aufrufen:** `/beta/room-editor/index.html` (GitHub Pages: `https://topsoliino.github.io/mind-dungeon/beta/room-editor/`).

**Wichtig für ChatGPT Work:** Dies ist ein vollständig isolierter Raumeditor. Der aktuelle Dungeon, alle bestehenden Greyboxen, der Random-Generator, der Wächter, die Gegner und deren Rendering-Pipeline sind *unverändert*. Bitte bei späterer Integration **kein vorhandenes `beta/index.html`, `beta/alley-generator.js` oder `beta/dungeon-isometric.js` überschreiben**. Stattdessen JSON-Vorlagen als optionale Raum-Templates importieren.

## Benutzung

* **V**: Möbel selektieren/ziehen, rechts Eigenschaften ändern.
* **B**: zusätzliche Schmutz-/Feuchtigkeitsspuren als weiche, lokal editierbare Akzente malen. Die eigentliche Bodenkarte ist ein zusammenhängendes Artwork.
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
| `blender/build-prison-tiles.py` | Ein vorhandener 512px-Referenzboden und zwei Blender-Maueransichten; in der App wird stattdessen die zusammenhängende 4096px-Bodenkarte verwendet |
| `blender/build-floor-map.py` | Erzeugt ein deterministisches, 4096×4096 Pixel großes, zusammenhängendes Kerkerboden-Artwork mit unregelmäßigen Steinflächen, Schlamm, Schmutz, Feuchtigkeit, Bruchkanten und Stroh |
| `blender/pack-prison-tiles.py` | Erzeugt und verpackt die 4096px-Bodenkarte und beide 512px-Blender-Maueransichten; die vorhandene Asset-CI wird ohne Workflow-Anpassung wiederverwendet |
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

Mauern und Möbel nutzen dieselbe 35,264°-orthografische Kamera, kontrastreiches Filmic, warmen Key, kühles Fill und physische Material-/Kantenmodelle. Der Boden ist dagegen **eine** große top-down-authored 4096px-Karte über fest **32×32 Welteinheiten**. Die editorseitige isometrische UV-Transformation bewahrt die Größe jedes Kratzers und Steins bei 2×2, 7×5 oder 30×30 Feldern; kleinere Räume sehen einen **zentrierten Ausschnitt** und dehnen keine Textur. Die Schere ist die physische Grundrisspolygon-Grenze. Das Raster ist ausschließlich eine optionale UI-Ebene. Die Mauer ist **ein** Stil mit zwei Sichtprojektionen, die Möbel je vier unabhängig gerenderte Ansichten.

### 3D-Renderpipeline

`blender/build-room-kit.py` erzeugt die Möbel als **ungeskinnte Blender-Meshes**, mit aufwendigen separat modellierten Holz- und Eisenteilen, realen Bevels, gewichteten Normalen, prozeduralem Material-Noise und warm/kühlem Licht ähnlich der Wächter-Pipeline. Sie brauchen **kein Armature-Rig**. 4 Kamerawinkel (jeweils exakt 90° gedreht) werden per Cycles als transparente PNGs gerendert, danach verlustarm zu WebP gepackt. Zur Laufzeit wird **kein** neues WebGL/Three.js oder synchroner Texture-Upload benötigt: der Editor zeigt die fertigen WebP-Ansichten. Ohne bereits generierte Bilder wird eine deutlich als Vorschau gekennzeichnete, isometrische Geometrie verwendet.

Die automatisierte Veröffentlichung hat ausschließlich Schreibrechte auf `beta/room-editor/assets/`, ist gegen zwischenzeitliche Quellcode-Updates abgesichert und greift **niemals in den bestehenden Wächter- oder Dungeon-Code ein**.

**Hinweis:** Der Editor ist ein Layout-/Kollisions-Prototyp für einzelne Räume. Sein „Spieltest“ ist eine leichtgewichtige geometrische Probe und **keine** vollständige Reproduktion der bestehenden Phaser-Kampf-/Gegnerphysik. Die Daten lassen sich beim späteren Generator-Import auf die eigentlichen Spielregeln mappen.

### Original-Wächter als Editorreferenz

Die Schaltfläche **Spiel-Wächter** blendet den echten Originalatlas aus `../art/player-study/` im Bearbeitungsmodus ein oder aus. Im Spieltest bleibt dieselbe reale Spielfigur steuerbar. Fehlende Originaldaten zeigen einen Fehlerzustand, keine nachgebaute Ersatzfigur.

### Schutz der Spiel-Beta

Alle Änderungen der Bodenkarte und des Editors liegen ausschließlich unter `beta/room-editor/`. Das eigentliche Spiel (`beta/index.html`, `beta/dungeon-guardian*.js`, `beta/dungeon-isometric.js`, Generator usw.) wird nicht geändert. Der schon bestehende Asset-Workflow darf weiterhin ausschließlich die Editor-Assets publizieren.

### Fotorealistische Bodenkarte (V2)

`blender/build-floor-map.py` verwendet **echte fotografische Oberflächenaufnahmen**, statt Steinpolygone zu simulieren. Die Grundlage stammt aus drei CC0-Texturen: [Monastery Stone Floor](https://polyhaven.com/a/monastery_stone_floor), [Stone Floor](https://polyhaven.com/a/stone_floor), [Rock Embedded Floor](https://polyhaven.com/a/rock_embedded_floor). Als kombinierte 4096×4096-WebP-Datei werden die Fotos aus überlappenden, weich maskierten Bereichen gesetzt; danach folgen zurückhaltende, großräumige Feuchtigkeits- und Schmutzmasken. Steinmaßstab und UV-Projektion ändern sich zwischen kleinen und großen Räumen nicht.

**Assetquelle:** [Poly Haven](https://polyhaven.com/) – [CC0](https://polyhaven.com/license). Die API wird ausschließlich beim offline GitHub-Asset-Build mit eigenem User-Agent genutzt; der eigentliche Browser lädt ausschließlich die bereits gebackene Datei aus dem Editorordner. Quelle auch im Editor vermerkt. Das Foto ist **kein Rendering des Wächters** und kein Ersatz-Charakter.

Der Build sollte nach einer Änderung an `beta/room-editor/blender/**` durch den bereits existierenden Workflow ausgelöst werden. Validierung: In `assets/tiles/manifest.json` muss anschließend `floorPixelDimensions: [4096, 4096]` stehen. Bei ausbleibendem Build läuft der zusammenhängende Editor-Vorschauboden weiter.

### Zweite Bodenmap und zwei fotografische Mauerarten

**Böden (Dropdown links `Kerkerboden-Oberfläche`):**
- `dungeon-ashlar` / `floor-prison-01.webp`: schmutziger, unregelmäßiger alter Kerkerboden aus fotografischen Poly-Haven-Stein- und Erdmaterialien
- `dungeon-cut-stone` / `floor-prison-02.jpg`: festerer rechteckiger Quadersteinboden aus den fotografischen CC0-Materialien [Rectangular Paving](https://polyhaven.com/a/rectangular_paving), [Stone Tiles](https://polyhaven.com/a/stone_tiles) und [Cobblestone Floor 02](https://polyhaven.com/a/cobblestone_floor_02). Er bleibt eine einzige 4096×4096-Karte für bis zu 32×32 Rasterfelder und wird für kleine Räume lediglich beschnitten

**Mauern (Dropdown links `Bauteil zum Platzieren`, danach `W` und Wandkante anklicken):**
- `stone` / `wall-masonry-01.jpg`: raue mittelalterliche Steinmauer, CC0-Fototextur [Medieval Wall 02](https://polyhaven.com/a/medieval_wall_02)
- `stone-cut` / `wall-masonry-02.jpg`: größere, solide, stark verwitterte Quader, CC0-Fototextur [Stone Block Wall](https://polyhaven.com/a/stone_block_wall)

Die Fotomauern sind **4096×1024** große zusammenhängende Fassaden für **32×2 Welteinheiten**; der Editor projiziert bei jedem Segment den zum Weltkoordinatenwert passenden Ausschnitt als isometrische Wandfläche. Benachbarte Segmente erhalten auf derselben Achse keine zufälligen Neuanfänge. Die optionale Struktur `room.wallStyle` bestimmt das aktuell gewählte Material, `room.walls[].style` speichert den Typ jeder bereits gesetzten Wand. Die Wandkollisionen bleiben unverändert; ältere JSONs mit `stone`/ `dungeon-ashlar` funktionieren weiter. Im Editor werden Stiloptionen über Dropdown und Materialvorschau angeboten.

**Bauen:** `blender/build-floor-map.py --variant dirt` und `--variant cut-stone` sowie `blender/build-wall-maps.py` laufen über `blender/pack-prison-tiles.py` im bestehenden Editor-Art-Workflow. Dabei werden neben den drei bestehenden WebP-Dateien drei **JPEGs** geschrieben (keine zusätzlichen WebP-Dateien), damit der vorgegebene, unveränderte Workflow weiterhin exakt drei WebP-Dateien erwartet. Das Manifest enthält dann `floorVariants`, `wallVariants`, `floorMaterial` und `wallMaterial` sowie beide Generator-Hashes. Der Browser nutzt die neue Fotofassade ausschließlich bei passendem Manifest, sonst die vorhandenen rein editorlokalen Vorschaudarstellungen.

**Sicherheitsgrenze:** ausschließlich `beta/room-editor/**` wird verändert, keine Hauptspiel-Beta-Dateien und kein CI-Workflow unter `.github/`.
