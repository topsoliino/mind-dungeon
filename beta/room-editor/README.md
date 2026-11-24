# Mind Dungeon – Room Atelier (V1)

**Editor aufrufen:** `/beta/room-editor/index.html` (GitHub Pages: `https://topsoliino.github.io/mind-dungeon/beta/room-editor/`).

**Wichtig für ChatGPT Work:** Dies ist ein vollständig isolierter Raumeditor. Der aktuelle Dungeon, alle bestehenden Greyboxen, der Random-Generator, der Wächter, die Gegner und deren Rendering-Pipeline sind *unverändert*. Bitte bei späterer Integration **kein vorhandenes `beta/index.html`, `beta/alley-generator.js` oder `beta/dungeon-isometric.js` überschreiben**. Stattdessen JSON-Vorlagen als optionale Raum-Templates importieren.


**Verbindliche Anleitung für ChatGPT Work:** [Room-JSON → Beta-Generator (README-GENERATOR-INTEGRATION.md)](README-GENERATOR-INTEGRATION.md). Vor jeder Template-Integration lesen: Schema, Koordinaten, unveränderliche Wände, Portale, exakte Quoten, Erreichbarkeit, aktuelle Generator-Schnittstellen und Abnahmetests. Die Anleitung beschreibt den Integrationsvertrag; die eigentliche Beta-Integration steht noch aus.

## Realistisch gerenderte Dark-Dungeon-Gefängnisgitter (Blender / Cycles)

Die beiden neuen Varianten `bars-full` und `bars-half` sind nicht länger
schematische Canvas-Stäbe. Ihre Erscheinung stammt aus vollständig
modelliertem, editierbarem **Blender-3D**:

- 2 m hohe und 1 m hohe reale Einzelstäbe mit abgeflachten, durch
  Handarbeit unregelmäßigen Profilen und angeschmiedeten Hülsen
- rostiges, geschwärztes Eisen, kalte abgeriebene Kanten, PBR-Mikrostruktur
  und Schlagschrauben; getrennte Ober-, Quer- und Sockelträger
- Beleuchtung durch die bestehende warme Schlüssel- und kühle Fülllichtquelle
  des Room Atelier, als 512px transparente Cycles-Renders

Die neue Datei `blender/dungeon-prison-bars.py` beschreibt die beiden
3D-Skulpturen. `blender/build-room-kit.py` rendert jede Gitterhöhe direkt
frontal (front-orthografisch). `blender/pack-room-kit.py` veröffentlicht
`assets/walls/prison-grille-full-front.png` und
`assets/walls/prison-grille-half-front.png` sowie das `wallViews`-Manifest.
Die 3D-Originale werden in `assets/source/room-kit.blend` gespeichert.

Der Editor lädt **nur die jeweils verwendeten Gitter-PNGs** nach Bedarf
und bildet den frontalen Render mit einer Canvas-Affintransformation direkt
auf die 1 m lange, perspektivisch korrekte Wandfläche ab. Dadurch bleiben
Gitter an Steinwand-Stößen bündig, ohne dass der Browser Blender ausführen
muss. Für unvollständig bereitgestellte Assets bleiben die alten Linien
als temporärer Fallback sichtbar. Die alten `bars`- und `gate`-Wall-IDs
werden nicht verändert, ebenso wenig die Spielphysik oder Hauptspiel-Beta.

## Gefängnisgitter: volle Wandhöhe und halbe Wandhöhe

Der Raumeditor unterstützt jetzt zwei neue, separat auswählbare Wandelemente:
`bars-full` (2,00 m, identisch zur Steinwandhöhe) und `bars-half` (1,00 m,
exakt halbe Steinwandhöhe). Beide bestehen aus geschmiedeten Stäben,
Querstreben und Nieten im bestehenden Dark-Dungeon-Look. Sie sind bewusst
**Wandsegmente** und keine verschiebbaren Möbelsprites: Sie nutzen die
isometrische 1-m-Wandkante, haben echte Durchblicke und bleiben korrekt
an die Wandachsen und angrenzende Gittersegmente gekoppelt.

**Bedienung:** Im Panel *Steinwände & Gefängnisgitter* die hohe oder niedrige
Gitter-Vorschau wählen, dann **W** drücken und die gewünschte Wandkante
anklicken. Bestehende Wandsegmente können so auf die jeweilige Höhe
umgeschaltet werden. Beide Varianten blockieren im Editor-Spieltest die
Wächterbewegung; sie sind zunächst nicht überspringbar. Das bestehende
`bars`-Modell sowie `gate` bleiben ohne Datenmigration benutzbar.
Wandtypen überleben JSON-Import, -Export und lokale Speicherung. Die
kameraseitigen südlichen/östlichen Außenwände bleiben wie bisher ausgeblendet.

Regressionstest: `node beta/room-editor/tests/prison-bars.test.cjs`.
Keine Live-Spiel-Datei wurde für diese Erweiterung bearbeitet.

## Dark Dungeon art-direction revision — physically weathered architecture

The fourteen Gothic architecture models now receive a second **editable
Blender geometry** pass, instead of only changing the exported PNG brightness.
This deliberately breaks the previous clean, cuboid, toy-like silhouettes:
cold charcoal limestone; genuinely chipped/warped vertices; broad damp soot,
wet mineral deposits and layered roughness in the Cycles material graph; torn
oak fibres, broken ashlar pieces, embedded cracks, exposed iron oxidation,
shattered planks and deep undercuts. The knight and gargoyle have been
resculpted as faceted, organic stone forms, and the gargoyle's former
rectangular wings are replaced with **uneven Gothic wing membranes**.

`blender/dungeon-architecture.py` owns the base materials and sculpt shapes;
`blender/architecture-weathering.py` sculpts **14 asset-specific** damage
profiles and attaches every piece to the original model pivot, preserving
0°/90°/180°/270° views, room JSON positions and wall-mounted placement.
`blender/build-room-kit.py` gives *only* these 14 assets a tighter key light
and less ambient fill for physical depth; existing props and the prison-bar
renderer retain their previous lighting settings.

All new visuals are still four transparent, pre-rendered Blender/Cycles PNGs
per model; no extra browser-side 3D or runtime draw cost is added.
`tests/dungeon-architecture.test.cjs` guards the sculpt/patina setup.

## Gothic wall architecture and elevated dungeon floors

**14 new editable Blender meshes** are built in `blender/dungeon-architecture.py`
and rendered under the same Cycles warm-key/cool-fill conditions as the
Guardian and the existing prison furniture. Each has four actual 90° views
(0°, 90°, 180°, 270°), stored under `assets/furniture/` as transparent
512px PNGs. Architecture models are full-size metre-scale geometry rather
than shrunk furniture; the architecture camera uses `ortho_scale=3.5`.
Source geometry is saved with the other models in `assets/source/room-kit.blend`.

**Wandverzierungen** are a dedicated palette category with STRICT wall-only
placement (not ordinary loose furniture): projecting stone pilaster,
freestanding-looking masonry column, timber pillar, wooden wall ledge,
carved cornice, knight statue, gargoyle and broken masonry arch. A decoration
must be attached to an existing **solid** wall segment, referenced by
`wallRef: "h:x:y"` / `"v:x:y"` and `wallOffset`; orientation follows the
wall. It cannot float elsewhere or be freely rotated. On moving a decoration
near another wall it reattaches to that wall. Erasing the supporting wall
also erases its decorations. Invalid wall references are discarded on JSON
import, ensuring old rooms continue to load correctly.

**Bodenarchitektur** is a separate palette category with genuine height
metadata and playtest collisions:
stone dais (+.55 m, front steps), sunken floor (-.55 m, front steps),
raised wooden gangway (+.74 m, front steps), wooden stage (+.55 m, steps),
broken slab (low walkable ramp up to +.22 m), collapsed intermediate floor
(with a blocked central hole and traversable surviving edges). A timber
wall ledge also has an elevated surface at +1.33 m and can be vaulted onto
and off using Space when in range.

The wall-only and height system lives in **`architecture.js`** and is
composed with `placement.js` in the editor. The Guardian's screen position
uses animated height `hero.z`. The playtest prevents walking straight
through vertical platform sidewalls or across collapsed floor holes; the
user must approach visible stairs to reach elevated or sunken floors. The
continuous photographic floor is visually cut out below the sunken and
collapsed regions to show depth, with the Blender masonry rims/joists above.
Saved rooms retain architecture types, wall references, orientations and
height metadata through the catalogue without altering the live game Beta.

Regression: `node beta/room-editor/tests/dungeon-architecture.test.cjs`.
After packing, there are **43 furniture/architecture types and 172
isometric sprite views** (29 existing +14 new, 116 +56 rotations).

## Wall-flush placement and on-demand loading

Room Atelier places **all furniture and floor clutter down to 0.01 world metres
from wall planes**. The previous artificial 0.1m perimeter inset is removed.
`placement.js` computes the 0/90/180/270-degree rotated footprints, clamps
objects to the room border and snaps them to nearby north/west or internal
solid-wall faces. A drag cannot jump through an internal wall; walk-through
decorations still cannot be positioned across a solid wall. Only real blocking
objects obstruct the Guardian in Playtest. Objects near the wall are snapped
off the .25m grid exactly; the JSON sanitizer preserves their coordinates
to .001m on save/reload. Property inputs allow .01m increments.

Startup is **demand-driven**, not a 116-sprite preload:

- `editor.js` requests only the currently drawn furniture *type + orientation*.
  Further 90-degree views load on first rotation, and the four images stay in
  the browser HTTP cache on subsequent use.
- Palette thumbnails request only 0-degree assets near the scrolling viewport
  via IntersectionObserver, with a native lazy-image fallback.
- `editor-art.js` validates the material manifest but loads only the active
  floor atlas and *wall styles actually visible* in the room.
- Material swatches show a CSS colour until hovered, focused, or clicked;
  this avoids downloading all 17 photograph previews and their remote
  fallbacks on startup.
- Guardian animation metadata loads once; the original body/weapon atlas
  sheets are fetched only when a visible animation frame requires them.

Images are served through **same-origin GitHub Pages static paths**, not
through GitHub's rate-limited REST/raw endpoints. The user's existing room
files and the main dungeon code remain unchanged.

Regression cases are in `tests/placement-and-loading.test.cjs`, covering
wall flush, interior wall collisions, 90-degree rotation, decoration
collision and zero eager material/sprite downloads.

## Abandoned dungeon: 10 Blender floor clutter props (2026-11-24)

Ten **physically modeled**, dark PBR environmental groups in
`blender/abandoned-floor-clutter.py`, loaded into the same orthographic,
Guardian-scaled Blender/Cycles pipeline as the room furniture:

- `floor-rubble`: angular fractured stone, mortar chips — **blocks walking**
- `floor-bones`: skulls, curved ribs and yellowed loose bones — walk-through
- `floor-rug`: tattered oxblood carpet with fringe, ragged mesh holes — walk-through
- `floor-chains`: real toroidal iron links, shackles and cuffs — walk-through
- `floor-wood`: heavy rotting beams and splinters — **blocks walking**
- `floor-moss`: physical moss patches, creeping roots and fungus caps — walk-through
- `floor-scrolls`: discarded scrolls, manuscript pages, ancient books — walk-through
- `floor-puddles`: irregular shallow glossy water meshes, damp stone margins — walk-through
- `floor-pottery`: broken stoneware jug, shards and green glass — walk-through
- `floor-cloth`: lumpy burlap sacks and draped ripped linen — walk-through

Every asset has its own floor-centred root, `modelScale=.45`,
`editorSpriteScale=.5`, measured footprint, and four **true Blender**
0°/90°/180°/270° renders as transparent 512×512 PNG files. They are
grouped under *Bodendekoration* in the editor palette; no dark generic
furniture shadow is stamped over puddles or carpets. Existing room layouts
and saved JSON remain compatible. A room can mix small nonblocking debris
with large blocking furniture in the same area. Room Atelier exports keep
each prop's placement, rotation and `blocksMovement` state.

The collection increases from 19 to **29 unique props / 116 rendered
directions**, retaining the eight original legacy WebP directions.
The source is saved along with all other modeled props to
`assets/source/room-kit.blend`. The main dungeon remains untouched.

## Torture chamber expansion: 10 original Blender props

Ten independent dark medieval prop meshes are constructed in
`blender/torture-chamber-furniture.py`, instantiated by the existing
`alchemy-furniture.py` entrypoint and rendered with the shared orthodox
35.26-degree Cycles camera. The set includes:

1. Hanging **iron cage** with iron bars, chain suspension and gallows support
2. **Interrogation chair** with distinct tall iron-bound back and empty cuffs
3. **Tool table** with physical hanging medieval implements and leather mat
4. Modular standing **chain wall** (movable furniture prop, not actual room wall)
5. Closed Gothic **iron maiden** cabinet with external iron bands
6. **Ember brazier** with actual charcoal geometry and warm ember material
7. Empty wooden **pillory** with iron-banded stocks
8. Free-standing upright **wheel** with real spokes and wheel bearings
9. Compact rectangular **prison transport cage**, distinct from hanging cage
10. Dungeon **stone washbasin** with wooden bucket and drainage channel

These are unoccupied environmental props, not character animation or gore.
The furniture catalogue now includes **19 objects** (2 old, 17 newer), each
with a corresponding collision footprint and four transparent 512 x 512
pre-rendered isometric PNG views at 0, 90, 180 and 270 degrees: **76
views in total**. New models use Guardian-relative `modelScale=.45`, with
the usual double-density camera and `editorSpriteScale=.5`. No main game
files are edited and existing room JSON remains compatible.

## Dungeon furniture pack: armoury, library, torture chamber (2026-11-24)

In the standalone Room Atelier, the previously generated compact brew table is now
**30% larger (Blender object .36 → .468)**, and the alchemist's writing/work table
**10% larger (.45 → .495)**. The footprint, inspector height and real Blender mesh
scale are adjusted together. Previously placed room instances keep their IDs and
automatically receive updated dimensions.

Three new fully modeled, editable Blender props join the shared dark-dungeon PBR set:

- **Weapon rack** (\`dungeon-weapon-rack\` / \`weapon-rack\`): separate ash spear,
  axes, long swords, oak armoury posts and iron mounts.
- **Bookshelf** (\`dungeon-bookshelf\` / \`bookshelf\`): gothic oak library case
  with physical shelves, grimoires, book spines, bindings and pointed crest.
- **Torture bench** (\`dungeon-torture-bench\` / \`torture-bench\`): empty medieval
  rack with two heavy winding drums, winch, iron strapping and restraints;
  no occupants are depicted.

All models are built in \`blender/alchemy-furniture.py\`, composed in
\`blender/build-room-kit.py\`, stored in the editable source
\`assets/source/room-kit.blend\`, and pre-rendered in Cycles as **4 actual camera
angles, 0/90/180/270°**, each as transparent 512px PNG. The existing asset
pipeline publishes the seven new furniture entries together with the two original
prison props, for **9 catalog types / 36 views**. The render is cached and the
browser only blits pre-rendered pixels, with no live Blender/WebGL cost. All room
JSON stays compatible with existing saved rooms; new pieces have proper footprints,
rotations and movement collisions. No main-game files are modified.

## Neue mittelalterliche Alchemie-Möbel (Blender)

Der Möbelkatalog enthält zusätzlich zum bestehenden Gefängnistisch und -stuhl vier
**eigenständige Blender-3D-Modelle**: einen Werk-/Alchemietisch, einen
kompakten Brautisch mit dominanter Kupferdestille, einen Hochlehnstuhl und einen
Armstuhl. **Alle vier neuen Möbel sind 55 % kleiner als ihre bisherigen
Editor-Render;** der Brautisch behält zusätzlich den ursprünglichen 0,8-Faktor.
Die Kollisionen schrumpfen entsprechend. Die zwei älteren Gefängnismöbel
werden unverändert beibehalten. Sämtliche Möbel sind in der isolierten Editor-Szene platzierbar,
verschiebbar, in **0° / 90° / 180° / 270°** drehbar und mitsamt Kollisionsdaten
als Raum-JSON exportierbar.

- `blender/alchemy-furniture.py` modelliert das neue Set als editierbare Blender-Meshes
  (Eichenbretter, Schmiedeeisen, Kupfer, Textilien, Glasgefäße, Kerzen usw.).
- `blender/build-room-kit.py` rendert alle sechs Modelle aus derselben 35,26°-
  Orthokamera mit Cycles, warmem Key und kühlem Fill. Die Quelle wird als
  `assets/source/room-kit.blend` gespeichert.
- `blender/pack-room-kit.py` liefert für die vier neuen Modelle je vier
  **transparente 512×512 PNGs** und ergänzt `assets/manifest.json`. Die zwei
  vorhandenen Möbel behalten ihre acht WebP-Dateien; das ist wichtig, weil der
  unveränderte GitHub-Actions-Workflow exakt acht alte WebPs validiert.
- Die vier neuen Assets werden mit **halbiertem Blender-Kameraausschnitt**
  gerendert und im Editor bei **50 % Sprite-Ausgabegröße** gezeichnet: hohe
  Quellbilddetails bei korrektem kleineren Maßstab relativ zum Original-Wächter.
  Der sichtbare Kessel ist größer modelliert, Holz und Metall sind dunkler
  abgestimmt; die Backlog-/Asset-Daten bleiben für spätere Spielintegration
  unabhängig von der Hauptspiel-Pipeline.
- Die neue Asset-Liste mit sechs Modellen hat insgesamt 24 Blickrichtungen.
  Bis ein Render-Build veröffentlicht ist, zeichnet der Editor nur eine
  geometrische Vorschau. Es werden **keine** Chat-Bilder als falsche
  Blender-Assets ausgegeben.

Der Brautisch trägt im Editor die Metadaten `interaction: 'brew'`; die
Brauinteraktion im eigentlichen Spiel wird dadurch **noch nicht aktiviert**.
Die Dateien des Hauptspiels bleiben absichtlich unverändert.

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

## Generator-Verbindungspunkte

Werkzeug **Verbindung (C)**: freie Außenkante anklicken, Breite 1–3 Felder wählen. Erneuter Klick oder Listeneintrag entfernt nur die Markierung. Grün = gültiger Zugang, rot = Konflikt. `Freie Kanten vorschlagen` ergänzt nach Bestätigung eine geeignete 1-m-Öffnung je noch nicht markierter Seite. Alte JSON-Dateien bleiben ohne automatische Architekturänderung importierbar.

Additives Feld `portals` in `mind-dungeon-room/v1`: `{ "side": "north", "offset": 0, "width": 1 }`. Side ist north/east/south/west; offset zählt nullbasiert entlang X (Nord/Süd) oder Y (West/Ost), width in ganzen Rasterfeldern. Nord y=0, Süd y=height, West x=0, Ost x=width. Markierungen sind keine Türen und ändern keine Wände. Prüfung: Grenzen, Überlappung, feste Wände/Gitter (inkl. noch fester Zellentür), unzerstörbare Möbel und Höhenflächen im 0,7-m-Zugangsbereich. Zerstörbare Möbel sind zulässig. Vollständige interne und Dungeon-Erreichbarkeit muss der spätere Generator prüfen. Kameraseitige Wände bleiben gespeichert und werden nur im Rendering ausgeblendet. Bei Größenänderungen bleiben Seite/Offset erhalten; Konflikte werden markiert. Entwurfsexport ohne gültige Portale erfordert Bestätigung. Keine Änderung des Beta-Generators oder Ebenenquoten.

Test: `node beta/room-editor/tests/portals.test.cjs`.

## Wandverzierungen: korrigierte Blickrichtung

Die vorhandenen Blender-Modelle sind mit der Vorderseite in Blender +Y modelliert; die vier Render-Views verwenden Z = 90° − rot. Im Editor ist daher **Nordwand (horizontal, h:...) = 180°**, **Westwand (vertikal, v:...) = 90°**. `architecture.js` berechnet diese Zuordnung sowohl beim Anbringen/Verschieben als auch beim Laden und Export alter JSONs. Position, Wandreferenz und Kollisionsmaße bleiben unverändert. Die bisher sichtbaren Nord-/West-Innenseiten und entsprechend orientierten Innenwände werden unterstützt; keine neue Montage auf den kameraseitigen Außenwänden.

## Freie Grundrisse: Boden-Brush

N / Boden + malt seitlich angrenzende Felder, M / Boden − entfernt Felder. Mit gedrückter linker Maustaste ziehen; Undo/Redo pro Strich. Der Rand wächst bis 30×30 automatisch in alle vier Richtungen, bestehende Wände und Möbel bleiben an ihrer Weltposition. Entfernen ist nur bei zusammenhängender Restfläche und ohne verwaiste Wände/Möbel möglich. Das Materialwerkzeug B bleibt unverändert. JSON: optional `floorCells` als Zellliste; ohne Liste Rechteck. Portale an Einbuchtungen verwenden zusätzlich `line`; vorhandene Portale werden nicht verschoben oder gelöscht, sondern bei Konflikten als ungültig angezeigt. Siehe [Integrationsvertrag](README-GENERATOR-INTEGRATION.md#13-erweiterung-frei-gezeichnete-grundrisse-floor-brush).

## Crypt Environment v3 — Beleuchtung, organische Deko, Bodenarchitektur

- Originale IDs `prison-table` und `prison-chair`: Blender-Geometrie auf .76 bzw. .72 skaliert, dunkles feuchtes Holz und geschwärztes Eisen; Tisch mit modelliertem menschlichem Schädel, einzelnen Zähnen, drei Wachskerzen und Wachstropfen. Kollisionsmaße angepasst.
- **Beleuchtungsquellen:** 3 Wandfackeln (Platte, Ring, gotische Konsole) sowie Einzelkerze, Kerzengruppe und Kandelaber. Die Fackeln verwenden `wallMounted` und reguläre `wallRef`/`wallOffset`-Daten. Ein gemeinsamer WebGL-Fragmentshader animiert Feuer bei 24 Hz; Canvas-Fallback, warmer radialer Lichtschein, kein physikalischer Schattenwurf. Flammenpositionen stehen als lokale Blender-Koordinaten in `catalog.js` (`lights`).
- **Bodendekoration:** vier Pilzvarianten sowie vier Moosvarianten (feucht, dicht, gelbe und weiße Wildblüten). Alle 14 neuen statischen Props werden als echte Blender-Meshes in vier Richtungen gerendert; PNG-Veröffentlichung durch den bestehenden Editor-Art-Workflow.
- **Ambient-Leben:** zwei platzierbare Emitter `ambient-roaches` und `ambient-flies`. Schaben laufen als versetzte Gruppe auf einem gecachten, kollisionsgeprüften Rasterpfad; Fliegen wandern entlang desselben Pfadprinzips mit individuellen Flugbahnen. Nicht blockierend, keine Inventargegenstände. Kein neuer Sprite-Download pro Insekt.
- **Bodenarchitektur v3:** sechs neu modellierte Bodenobjekte mit maßhaltiger orthografischer Projektion und eigener Render-Rotationskonvention (`Z=-90-rot`); lokale Höhenprofile für Deck, Treppen, Rampe, abgesenkten Boden und tatsächliches Loch. Überlappende Höhenflächen werden bei der Platzierung verhindert. Keine alten frei schwebenden Dekor-Risse. Die neu gerenderten Assets und die Editor-Physik müssen gemeinsam visuell getestet werden.

`environment.js` enthält die Runtime-Vorschau, `blender/crypt-environment.py` die editierbaren Modelle. JSON enthält wie bisher Typ/Position/Rotation; Licht- und Ambientparameter werden aus dem Katalog gelesen. Nur im Room Atelier implementiert; keine Hauptspiel-Änderung. Test: `node beta/room-editor/tests/crypt-environment.test.cjs`.

### Schaben: Boden-Renderpass
Schaben werden nach den Bodentexturen und flachen Boden-Dekorationen, aber vor sämtlichen Wänden, Möbeln, Höhenobjekten und dem Wächter gerendert. Fliegen behalten ihren separaten Luftpass. Die bestehende Pfadfindung und Kollision bleiben unverändert.

### Artwork-Laden und Lichtzustand
Der Sprite-Loader lädt die aktuelle Manifest-Revision, nutzt versionierte Sprite-URLs und wiederholt fehlgeschlagene Bildanfragen begrenzt. `Artwork neu laden` prüft das Manifest und lädt die benötigten Ansichten erneut. Fehlende Ansichten werden mit Dateinamen gemeldet; bei noch fehlendem Träger wird kein losgelöstes Feuer angezeigt. Die Eigenschaft `lit` (optional, Standard true) schaltet Flammen und Glow aus, nicht den Basis-Sprite. Sie bleibt beim Import, Export und Verschieben erhalten. Keine neuen Asset-IDs nötig.
