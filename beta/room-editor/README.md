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
| `editor-art.js` | Acht feste 30-m-Bodenatlanten und neun 30-m-Wandatlanten UV-korrekt darstellen; echter Wächter-Atlas als Referenz |
| `presets/prison-cell-01.json` | Eigenständig importierbare Gefängniszelle |
| `blender/build-room-kit.py` | **Tatsächliche 3D-Modelle**: Tisch, Stuhl; physische Bretter, Beine, Eisennägel, Material-/Lichtsetup |
| `blender/pack-room-kit.py` | Vier Ansichten je Möbelstück in 512×512 WebP + Manifest packen |
| `blender/build-prison-tiles.py` | Historische Blender-Wand- und Bodenfallbacks (nur CI-Kompatibilität), nicht der aktive Material-Look |
| `blender/build-floor-map.py` | Importiert acht originale 2K-**Diffuse-/Albedo-JPGs** von Poly Haven statt Vorschaubildern |
| `blender/build-wall-maps.py` | Importiert neun echte, originale 2K-**Diffuse-/Albedo-JPGs** für Mauerflächen |
| `blender/build-floor-atlas.py` | Erstellt acht 30×30-m-Texturatlanten ohne sichtbaren 2-m-Raster-Wiederholungsbeginn |
| `blender/build-wall-atlas.py` | Erstellt neun fortlaufende 30×2-m-Fassadenatlanten mit korrekter Mauerorientierung |
| `blender/pack-prison-tiles.py` | Validiert sechs unveränderte Original-Diffuse-JPGs und sechs Atlanten samt SHA-256 im v6-Manifest |
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

Mauern und Möbel nutzen dieselbe 35,264°-orthografische Kamera, kontrastreiches Filmic, warmen Key, kühles Fill und physische Material-/Kantenmodelle. Alle acht Böden verwenden je einen unverändert ausgerichteten UV-Atlas über **30×30 Welteinheiten**. Die editorseitige isometrische UV-Transformation bewahrt die Größe jedes Kratzers und Steins bei 2×2, 7×5 oder 30×30 Feldern; kleinere Räume sehen einen **zentrierten Ausschnitt** und dehnen keine Textur. Die Schere ist die physische Grundrisspolygon-Grenze. Das Raster ist ausschließlich eine optionale UI-Ebene. Die drei Steinmauern nutzen fortlaufende UV-Streifen, die Möbel je vier unabhängig gerenderte Ansichten.

### 3D-Renderpipeline

`blender/build-room-kit.py` erzeugt die Möbel als **ungeskinnte Blender-Meshes**, mit aufwendigen separat modellierten Holz- und Eisenteilen, realen Bevels, gewichteten Normalen, prozeduralem Material-Noise und warm/kühlem Licht ähnlich der Wächter-Pipeline. Sie brauchen **kein Armature-Rig**. 4 Kamerawinkel (jeweils exakt 90° gedreht) werden per Cycles als transparente PNGs gerendert, danach verlustarm zu WebP gepackt. Zur Laufzeit wird **kein** neues WebGL/Three.js oder synchroner Texture-Upload benötigt: der Editor zeigt die fertigen WebP-Ansichten. Ohne bereits generierte Bilder wird eine deutlich als Vorschau gekennzeichnete, isometrische Geometrie verwendet.

Die automatisierte Veröffentlichung hat ausschließlich Schreibrechte auf `beta/room-editor/assets/`, ist gegen zwischenzeitliche Quellcode-Updates abgesichert und greift **niemals in den bestehenden Wächter- oder Dungeon-Code ein**.

**Hinweis:** Der Editor ist ein Layout-/Kollisions-Prototyp für einzelne Räume. Sein „Spieltest“ ist eine leichtgewichtige geometrische Probe und **keine** vollständige Reproduktion der bestehenden Phaser-Kampf-/Gegnerphysik. Die Daten lassen sich beim späteren Generator-Import auf die eigentlichen Spielregeln mappen.

### Original-Wächter als Editorreferenz

Die Schaltfläche **Spiel-Wächter** blendet den echten Originalatlas aus `../art/player-study/` im Bearbeitungsmodus ein oder aus. Im Spieltest bleibt dieselbe reale Spielfigur steuerbar. Fehlende Originaldaten zeigen einen Fehlerzustand, keine nachgebaute Ersatzfigur.

### Schutz der Spiel-Beta

Alle Änderungen der Bodenkarte und des Editors liegen ausschließlich unter `beta/room-editor/`. Das eigentliche Spiel (`beta/index.html`, `beta/dungeon-guardian*.js`, `beta/dungeon-isometric.js`, Generator usw.) wird nicht geändert. Der schon bestehende Asset-Workflow darf weiterhin ausschließlich die Editor-Assets publizieren.

### UV-Reparatur: Boden-Wiederholungen und schiefe Mauerfugen (V6)

**Fehlerursache:** Die vorherige Version verwendete die Poly-Haven-`primary`-Vorschaubilder als Spieltexturen. Diese sind 1600×800-Pixel-**Präsentationen des Materials**, keine flachen, nahtlosen UV-Texturmaps. Ihr perspektivisch gezeigtes Material wurde nochmals auf die isometrischen Wände projiziert. Zusätzlich wiederholte `createPattern` die kleine 2,2-m-Pflasteraufnahme über alle Räume hinweg, was ein sehr sichtbares regelmäßiges Bildraster erzeugte.

**Reparatur (nur Editor):**

- `blender/build-floor-map.py` und `build-wall-maps.py` laden die **originalen 2K Diffuse/Albedo JPGs** über `https://api.polyhaven.com/files/{asset_id}` herunter und speichern ihre Bytes unverändert. Die Vorschau-URLs werden nicht mehr als Texturquelle benutzt.
- `blender/build-floor-atlas.py` erzeugt aus jeder ursprünglichen, physisch korrekt skalierten Aufnahme eine **30 × 30 Weltmeter große, 4096² Pixel umfassende Weltbodenkarte**. Drei unterschiedlich versetzte Abtastungen der Originaldiffuskarte werden durch weich verlaufende großräumige Auswahlmasken kombiniert. Es werden **keine künstlichen Steine/Fugen/Schmutzflecken** hinzugefügt. Alle ursprünglichen Diffuse-JPGs bleiben separat erhalten.
- `blender/build-wall-atlas.py` erstellt pro Mauer **einen 30 m breiten und 2 m hohen Fassadenstreifen (4096×768)** aus der flachen, vertikal korrekt ausgerichteten Diffuse-Map. Damit entfallen die Neustarts der Mauerfugen nach jedem Segment.
- `editor-art.js` zeichnet pro Raum **genau ein** Bodenatlas-Bild im festen Maßstab. Für kleine Räume wird ein mittiger Ausschnitt gezeigt; 30×30 ist die maximale Raumgröße. Es gibt kein Runtime-`createPattern('repeat')` für Böden.
- Bei Wänden stimmt die Textur-U-Achse mit der horizontalen Mauerlänge und V mit der **senkrechten Welt-Höhe** überein. Segment `x` liest den auf Segment `x+1` direkt folgenden Teil des 30-m-Wandbildes. Nord- und Westwände werden entlang ihrer jeweiligen **Weltkante**, nicht entlang eines bereits fotografisch verzerrten Musterbildes, projiziert.

**Maßstäbe:** Etwa 1 m pro Editor-Rasterfeld; Dark Rock 02 ca. 2×2 m pro diffuse Quelle, Coast Sand Rocks 02 ca. 15×15 m, Cobblestone Floor 09 ca. 2,2×2,2 m. Die drei Mauertexturen sind 1,8 bzw. 2 m breit. Die Originale werden nicht auf 30 m gestreckt; nur ihre Diffuse-Daten werden auf eine **30-m-UV-Fläche** gebacken. Alle sechs Materialien stammen weiterhin von [Poly Haven](https://polyhaven.com/) und sind [CC0](https://polyhaven.com/license).

**Veröffentlichungsprüfung:** `assets/tiles/manifest.json` muss `mind-dungeon-room-tiles/v6`, `textureMode: uv-ready-polyhaven-diffuse`, drei `floorAtlases` und drei `wallAtlases` sowie für jede Ausgabe ein SHA-256 und die Quelldatei enthalten. Die generierten Dateinamen heißen `floor-albedo-0{1,2,3}.jpg`, `wall-albedo-0{1,2,3}.jpg`, `floor-atlas-0{1,2,3}.jpg` und `wall-atlas-0{1,2,3}.jpg`. Die ursprünglichen drei Blender-WebPs bleiben einzig zur Wahrung des unveränderten, separat laufenden Editor-Art-CI-Checks erhalten.

**Hauptspielschutz:** Alle Writes bleiben strikt auf `beta/room-editor/**` begrenzt. Weder `beta/index.html`, `beta/dungeon-isometric.js`, Gegner-/Wächter-/Generator-Dateien noch `.github/**` werden verändert.

**UV-Regressionstest:** `node beta/room-editor/tests/uv-mapping.test.js` prüft alle sechs Materialien, konstante 30-m-Boden-UVs unabhängig von der Raumgröße sowie unmittelbar aufeinanderfolgende Wandtexturabschnitte für beide isometrischen Wandrichtungen.

### V7: Fünf weitere Bodenmaterialien – acht insgesamt

Die bisherigen drei Böden bleiben unverändert auswählbar. Neu sind:

| ID / Auswahl | Poly-Haven-Original | Breite der gescannten Original-Diffuse-Map | Runtime-Atlas |
| --- | --- | ---: | --- |
| `dungeon-mossy-cobbles` – Feuchtes Moospflaster | [Cobblestone Floor 04](https://polyhaven.com/a/cobblestone_floor_04) | 1,5 m | `floor-atlas-04.jpg` |
| `dungeon-ruined-cobbles` – Verwittertes Pflaster | [Cobblestone Floor 03](https://polyhaven.com/a/cobblestone_floor_03) | 2,4 m | `floor-atlas-05.jpg` |
| `dungeon-aged-paving` – Altes Steinpflaster | [Stone Floor](https://polyhaven.com/a/stone_floor) | 1,8 m | `floor-atlas-06.jpg` |
| `dungeon-rustic-slate` – Abgetretene Schieferplatten | [Slate Floor 02](https://polyhaven.com/a/slate_floor_02) | 2,0 m | `floor-atlas-07.jpg` |
| `dungeon-wet-mud` – Nasser Kerkerlehm | [Brown Mud 03](https://polyhaven.com/a/brown_mud_03) | 1,3 m | `floor-atlas-08.jpg` |

**Pipeline:** Die Originale werden als unveränderte 2048px-Diffuse-JPGs importiert (`floor-albedo-04.jpg` bis `floor-albedo-08.jpg`); die 4096²-Atlanten werden per bestehender, stochastischer Phasenmischung aufgebaut, ohne bemalte Fugen, Schmutz-Overlays oder veränderte Steingrößen. Alle acht Atlasbilder umfassen 30×30 Weltmeter und werden vom Raumeditor jeweils in **einem** `drawImage` projiziert – auch für 2×2- und 30×30-Räume. Der originalgetreue Wächter, die Mauerkollisionen und drei Wandstile bleiben gleich.

**Publikation:** `assets/tiles/manifest.json` ist ab Version `mind-dungeon-room-tiles/v7` gültig, mit genau acht `floorVariants` und acht `floorAtlases` sowie drei `wallVariants` und drei `wallAtlases`. Der Browser akzeptiert während der Build-Umstellung noch das vorangegangene v6-Manifest und lädt die acht Bodenbilder unabhängig voneinander; ein fehlender neuer Atlas darf die bisherigen drei nicht blockieren.

**Regression:** `node beta/room-editor/tests/uv-mapping.test.js` prüft die acht Bodenstile, ihre Quellhashes, Maßstäbe und die isometrische Projektion sowie die weiterhin zusammenhängenden drei Wandtypen. Alle Dateien und Asset-Publikationen bleiben ausschließlich unter `beta/room-editor/**`.

### V8 – Sechs zusätzliche mittelalterliche Mauerarten

Zu den bestehenden drei Wänden kommen **sechs weitere** fotorealistische Materialien hinzu. Alle sind echte, ungedrehte Poly-Haven-Diffuse-Maps mit CC0-Lizenz und werden in derselben UV-korrekten 30×2-m-Atlas-Pipeline wie Rock Wall 17, Rock Wall 16 und Old Stone Wall verwendet:

| Stil-ID (in alten Raumdateien kompatibel) | Material | Scanbreite | 2K-Diffuse / Runtime-Atlas |
|---|---|---:|---|
| `stone-rough-12` | [Rock Wall 12](https://polyhaven.com/a/rock_wall_12) | 1,6 m | `wall-albedo-04.jpg` / `wall-atlas-04.jpg` |
| `stone-rough-13` | [Rock Wall 13](https://polyhaven.com/a/rock_wall_13) | 2,0 m | `wall-albedo-05.jpg` / `wall-atlas-05.jpg` |
| `stone-rough-14` | [Rock Wall 14](https://polyhaven.com/a/rock_wall_14) | 1,8 m | `wall-albedo-06.jpg` / `wall-atlas-06.jpg` |
| `stone-rough-15` | [Rock Wall 15](https://polyhaven.com/a/rock_wall_15) | 1,9 m | `wall-albedo-07.jpg` / `wall-atlas-07.jpg` |
| `stone-castle-slates` | [Castle Wall Slates](https://polyhaven.com/a/castle_wall_slates) | 2,5 m | `wall-albedo-08.jpg` / `wall-atlas-08.jpg` |
| `stone-castle-aged` | [Castle Wall Variation](https://polyhaven.com/a/castle_wall_varriation) | 2,0 m | `wall-albedo-09.jpg` / `wall-atlas-09.jpg` |

**Fix für die zuvor nicht ladenden fünf neuen Böden und leere Vorschaubilder:** Die Editor-UI ist vor der zeitaufwendigen GitHub-Action zur Veröffentlichung neuer Materialatlanten online gegangen. Darum verweisen die Vorschauen zunächst auf noch nicht erzeugte JPGs. Ab V8 sind die fünf neuen Böden und sechs Wände **sofort sichtbar**, wenn GitHub Pages deren HTML/JS veröffentlicht: Die Thumbnails verwenden das jeweilige echte 1K-Poly-Haven-Diffuse als Bild-Fallback, und der Canvas-Renderer versucht bei fehlendem 30-m-Atlas die echte 2K-Diffuse-Map direkt nachzuladen. Während dieses Übergangs wiederholt der Browser das Originalmaterial im korrekten Maßstab; wenn GitHub Actions die 30-m-Atlanten publiziert, bevorzugt der Editor automatisch den großen lokal gebackenen Atlas. Der Fallback wird in der Materialstatuszeile angezeigt und blockiert weder vorhandene Bodenmaterialien noch die übrigen Wände. Das ist ein Material-Lade- und Veröffentlichungsfix, **kein** Eingriff in Hauptspiel-/Wächter-/Generatordateien.

**Dateien:** `blender/build-floor-map.py`, `build-wall-maps.py`, `build-floor-atlas.py`, `build-wall-atlas.py` und `pack-prison-tiles.py` bleiben ausschließlich unter `beta/room-editor/`. `manifest.json` veröffentlicht Version `mind-dungeon-room-tiles/v8` mit genau acht Böden und neun Steinmauern; die Runtime toleriert beim Rollout auch v6/v7 und lädt fehlende Dateien unabhängig nach. `tests/uv-mapping.test.js` enthält eine Regression für ein veraltetes Manifest.
