# Mind Dungeon — wiederverwendbare Welt- und Landschaftsarchitektur

Status: **Konzept & Implementierungs-Timeline, keine Landschaftsgenerierung** (22.11.2026).
Die erste Landschaft ist `rocky-coast`. Weitere elf Landschaften bekommen dieselben Schnittstellen und eigene Konfigurationen/Assets.

## 1. Welt-Hierarchie und Begriffe

- **Welt:** genau zwölf Gebiete mit zwölf eigenständigen Landschaftsidentitäten.
- **Landschaft / Region:** zusammenhängendes Außenareal mit Topographie, Wegesystem, Wetterregeln, Biom, Wildtieren, Besonderheiten und optional mehreren Gebäuden.
- **Dungeon:** spielbare Folge verknüpfter Dungeon-Ebenen über Innenräume, Gebäude, Außenbereiche und große Höhenwechsel. Ein Dungeon kann ein oder mehrere Gebäude enthalten. Er ist nicht zwingend auf eine Gebäudestruktur begrenzt.
- **Dungeon-Ebene:** Fortschritts- und Streaming-Einheit; *nicht* zwangsläufig identisch mit einem Gebäudestockwerk. Kann vollständig innen, vollständig draußen oder gemischt sein.
- **Gebäude:** 1..N Räume, gruppiert in 1..N Stockwerken; Stockwerke sind physikalisch verbunden (Treppe, Leiter, Abgrund, Aufzug usw.).
- **Raum:** kleinste Innenraum-Generationseinheit. Raumgraph, Portale/Türen, Abmessungen, Kollision, sichtbarer Bereich und semantische Funktion sind getrennte Daten.
- **Landschafts-Chunk:** kleinste Außenraum-Streaming-Einheit. Anders als Innenräume nicht zwangsläufig durch Wände begrenzt.

### Trennung von Daten und Darstellung

`WorldDefinition -> RegionDefinition -> DungeonDefinition -> DungeonLevel -> (Building/Room | LandscapeChunk)`

`TerrainHeightfield -> TerrainMesh + CollisionSurface + Navmesh + DerivedNormalMap`

Eine **Normalmap** allein enthält keine Höhengeometrie. Höhenkarte oder Terrain-Mesh liefern echte Höhen/Kollisionen; Normalmaps leiten daraus visuelle Beleuchtung ab. Navigation darf nicht aus der Normalmap abgelesen werden.

Künftige Landschaften dürfen dieselben Loader, Generatoren, Renderer, Speicher-/Teleport-Schnittstellen und Streaming-Budgets verwenden, während Assets, Material-/Shader-Presets und Konfigurationsdaten austauschbar sind.

## 2. Konfigurationsvertrag für Landschaften

Erforderliche Felder (konzeptionell; noch keine neue Runtime-API):

- `regionId`, `displayName`, `seed`
- `topography`: `flat`, `hills`, `mountains-v`, `mountains-u`
- `traversability`: `narrow-routes`, `wide-routes`, `open`
- `routePattern`: `single`, `branching`, `crossing`, `nested`
- `heightfield`, `terrainMaterials`, `normalMaps`, `terrainShaders`, `waterBodies`
- `navmesh`, `routeGraph`, `terrainObstacles`, `bridgesOrCrossings`
- `weather.allowed`: Regen, Schnee, Sonne, Glut, Gewitter, Nebel; außerdem Wind/Kälte/Intensität und mögliche Kombinationen
- `biome`, `vegetationSet`, `wildlifeSet`, `propSet`, `soundscape`
- `dungeonIds`, `buildingIds`, `exitPortals`, `chunkStreamingPolicy`
- `qualityBudgets`: CPU, GPU, Sichtweite, LOD, Objekt-Dichte, Partikel und Ambient-Simulation

Wildlife-/Vegetation-Sets müssen pro Landschaft eigenständig sein; geringe Überschneidungen sind möglich, aber kein überall kopiertes Standard-Biom. Die Routenanzahl beschreibt eine **Graph-Topologie**, nicht die Anzahl einzelner Bodenstreifen. Offene Flächen können durch Brücken oder Bergpässe zu punktuellen Engstellen übergehen.

## 3. Verbindliche Eckdaten — Rocky Coast

- **Region:** `rocky-coast`, Entwicklungsname: **Rocky Coast**.
- **Dungeon:** **Rocky Coast Prison Dungeon**, genau fünf Dungeon-Ebenen.
- **Gebäude:** genau eines: **Rocky Coast Prison**; vorerst keine weiteren Gebäude in der Landschaft.
- **Level 1–4:** Innenräume des Gefängnisses; Fortschritt **von unten nach oben**.
- **Level 5:** die freie Landschaft **Rocky Coast** über den Gefängnisräumen.
- **Architektur:** Das große Gefängnis schmiegt sich von der Brandungszone des Ozeans entlang der Klippe nach oben.
- **Topographie außen:** hügelig; grundsätzlich **offen begehbar**.
- **Besonderheit:** ein **breiter Fluss** im Landschaftsabschnitt. Ob/wie er überquert wird, ist noch nicht festgelegt.
- **Klima/Wetter:** regnerisch, stürmisch, kalt, neblig. Wetterzustände dürfen sich kombinieren.
- **Biom:** gemäßigtes Grasland; gestalterische Referenz Nordirland.
- **Noch nicht festgelegt:** Größe und genaue Bauform aller Räume, Außengebiet-Ausdehnung, Vegetations-/Wildtierarten, Schilder/Karren, Flussübergänge und konkretes Routennetz. Diese Details werden abschnittsweise entworfen.

## 4. Entwicklungs-Timeline (Meilensteine statt unbegründeter Zeitangaben)

| Schritt | Rocky Coast konkret | Wiederverwendbares Ergebnis / Abnahmekriterium |
|---|---|---|
| **0 · Technischer Vertrag** | Level-/Region-IDs und Zugangsknoten definieren | Region/Dungeon/Building/Room/Chunk-Datenschema, persistente IDs, Tests |
| **1 · Dungeon-Graph** | Fünf Ebenen und Aufwärtsfortschritt festlegen | Verbindungen/Übergänge sind eigene Daten, kein in Szenencode eingebauter Sonderfall |
| **2 · Gefängnis-Greybox** | Raumgruppen und Stockwerke von Ebene 1–4, zunächst ohne dekorative Landschaft | 1..N Räume und 1..N Stockwerke; Generator + Türen + Kollisionen bleiben vollständig begehbar |
| **3 · Klippen-Architektur** | Gefängnis wächst vertikal von den Meereswellen die Klippe hinauf | Physische Höhen, Treppen/Leitern, Occlusion, richtige Tiefensortierung und Streaming |
| **4 · Außen-Übergang** | Ebene 4 -> Ebene 5: Gefängnis verlassen, erste Außenfläche | Nahtloser Gebäude-/Landschaftswechsel, Persistenz der Position, Rückweg möglich |
| **5 · Terrain-Basis** | Hügel, Küstenkante, breiter Fluss: Heightfield, Collision Mesh, Normalmaps | Generische Heightmap->Mesh->Normalmap-Pipeline, replizierbare Seeds |
| **6 · Begehbarkeit & Wege** | Offenes Grasland, Fluss als Barriere; Übergänge erst nach genauer Entscheidung | Navmesh-/RouteGraph-Generator für offen/schmal/breit und vier Routengraph-Typen |
| **7 · Wetter, Wasser, Shader** | Sturm, Regen, Nebel, Kälte, Wellen, Fluss | Wetter-State-Machine, austauschbare Shader, korrekte Sichtweiten und niedrige GPU-Kosten |
| **8 · Biom-Lebendigkeit** | Eigenständiges Küstengrasland, später passende Pflanzen, Windreaktionen | Datengetriebene Vegetations-/Wildtier-Sets mit LOD, Culling und räumlicher Verteilung |
| **9 · Requisiten & Interaktion** | Erst nach Absprache Besonderheiten wie Schilder, Karren, Flussüberquerung | Prop-Registry, Collider, Interaktion, zerstörbare Elemente, Spawn-Regeln |
| **10 · Integrierter Dungeon-Test** | Von Gefängnis Ebene 1 bis zum Außenabschnitt Ebene 5 und zurück | Reproduzierbarer Playtest, Seed-Tests, Speicherstände, keine FPS-Einbrüche durch Raumwechsel |
| **11 · Zwölf-Landschaften-Vorlage** | Rocky Coast wird erstes Referenz-Biompaket | Neuen Landschaftstyp per Konfiguration, Heightfield/Normalmaps, Assetbundle und Shaderpreset einhängen |

Jeder Schritt ist eine **freigabefähige Etappe**: Erst Greybox/Physik/Begehbarkeit, dann visuelle Assets, dann Atmosphäre und Lebewesen. Nichts aus Schritt 4–11 muss vorausgesetzt oder vorweg generiert werden, um Schritt 1–3 zu testen.

## 5. Architektur- und Performance-Leitlinien

1. **Streaming:** jeweils benachbarte Räume oder Gelände-Chunks laden, andere deaktivieren; keine ganze Landschaft als eine riesige Canvas-Textur.
2. **Terrain:** sichtbare Normalmaps, Physik-Mesh und Navmesh getrennt, aber mit denselben Koordinatensystemen/IDs.
3. **Kamera und Tiefe:** einheitliches Welt-`(x,y,z)`, eindeutige Objekt-Footprints, transparenter Vordergrund nur bei tatsächlicher Verdeckung.
4. **Rendering:** GPU- und Hauptthread-Budgets für Terrain, Wetter, Tiere, Gegner; gemeinsamer Asset-Cache, 3D-Render-to-sprite für häufige Kleinteile statt RenderContext pro Objekt.
5. **Simulation:** Wetter, Tiere, Partikel und weit entfernte Gegner in abgestuften Aktualisierungsraten; Spielereingaben, Navigation und Kollisionen dürfen dadurch nicht stocken.
6. **Generierung:** feste Seeds, graphbasierte Validierung, erreichbare Ein-/Ausgänge und keine durch Gelände-/Brückenregeln unerreichbaren Pflichtziele.
7. **Abnahme:** FPS/GPU-Metriken in realen Kämpfen, Treppen/Brücken/Fluss-Kollisionen, Save/Load über Stockwerke und Dungeon-Grenzen, kein Render-Duplikat.

**Nicht umsetzen, bis die einzelnen Abschnitte konkretisiert sind:** Terrain, Normalmaps, Küsten-Grafik, Vegetation, Tiere, Wettereffekte oder neue Gebäude für Rocky Coast.


## 6. Implementierungsstand: Rocky Coast Greybox (22.11.2026)

**Laufend angebundener Prototyp — noch keine finale Landschaftsgrafik:**

- `beta/rocky-coast-prison.js`: fünf Dungeon-Ebenen (1–4 Innenräume, 5 Außenlandschaft), eindeutige Dungeon-Level-IDs, deterministische Seeds, Auf-/Abstieg über die beiden Türportale (E).
- `beta/alley-generator.js` und `beta/dungeon-isometric.js`: 10 verbundene Räume je Innenebene, Bestands-Treppen und -Leitern, Rückweg vom Außenportal; die Heldbewegung und Angriffssysteme bleiben gemeinsam.
- `beta/rocky-coast-terrain.js`: analytische Höhenkarte, daraus erzeugte Tangent-/Normalmap, 30-Pixel-Heightfield-Kacheln, statische gechunkte Polygon-Greyboxes und Kamera-Culling; lokales normales Shading durch die abgeleiteten Normalen.
- Outdoor-Terrain ist weitgehend offen. Der breite Fluss blockiert sichere Wegsuche außerhalb der einen vorhandenen Greybox-Brücke. Meer/Fluss sind Death Zones mit vorhandener Fallanimation; nicht überwindbare Gebirgs-/Felswände, Grenzzaun, Wald und Gefängnisfassade sind visuell und physisch als Barriere vorhanden.
- Weltkoordinaten und Höhen werden direkt für Projektion, Rechtsklick-Raycast, Bewegung/Kollision und Hangwinkel (23° Anstrengung, 32° Abrutschen, 53° Klippenrutschen) verwendet. Auf unhaltbaren Hängen reduziert die Physik Bewegung bergauf und bewegt den Charakter hangabwärts. Aktuell werden dafür die vorhandenen Wächter-Knockback-/Bodenwurfclips verwendet, noch keine speziell gebaute Blender-Rutschspur.
- `tools/check-rocky-coast.cjs` ist der CI-Test für Seed-Konsistenz, fünf Levelverbindungen, 3D-Terrain, Normalmap, Death/Border Zones, Navigation, Sliding und Chunk-Culling.

**Noch ausstehend:** Regen-/Sturm-/Nebel-Shader, tatsächliches Wasser-/Brandungs-Rendering, konkrete nordirische Vegetation, Wildlife, Zonen-Lebendigkeit, eigenständige Rutschrigs, erweiterte Gebäudevariationen, vollumfängliche Browser- und FPS-Tests. Die vier Innenstufen sind bewusst Greybox-Layouts desselben stabilen Raumgenerators — ihre Gefängnisfunktionen und individuelle Architektur werden später ausgearbeitet.

**Test-URL:** `beta/latest.html?region=rocky-coast&level=1`. Zum Terrain-MVP unmittelbar: `beta/latest.html?region=rocky-coast&level=5`. Die Beta-Ladeoberfläche ergänzt `szene=gasse&modus=generator` automatisch.
