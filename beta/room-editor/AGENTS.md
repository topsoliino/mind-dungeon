# Room Atelier – Bearbeitungsgrenze

**Erlaubter Schreibbereich für diesen ChatGPT-Editor-Workflow:** ausschließlich `beta/room-editor/**` im Repository `topsoliino/mind-dungeon`.

**Verboten:** Alle Dateien der aktuell spielbaren Hauptspiel-Beta außerhalb dieses Editorordners, insbesondere `beta/index.html`, `beta/dungeon-isometric.js`, `beta/dungeon-guardian*.js`, `beta/alley-generator.js`, Spiel-Assets und Generator-/Gegnerdateien. Diese Änderungen sind ausschließlich ChatGPT Work vorbehalten.

- Der Editor darf existierende Hauptspiel-Assets **lesend** laden, insbesondere den originalen Wächter, darf sie aber niemals überschreiben.
- Schreiboperationen und Commits müssen auf Dateien mit Präfix `beta/room-editor/` begrenzt werden.
- Der bestehende Editor-Art-Build schreibt nur Assets unter `beta/room-editor/assets/`; Änderungen am Workflow unter `.github/` sind nicht Teil dieser Erlaubnis.
- Editor-Daten/-Vorschau und Spieltest bleiben vom produktiven Dungeon-Generator isoliert.
- Der Editor nutzt drei originalgetreue Poly-Haven-Bodenfotos und drei Wandfotos. Die Texturprojektion ist an den Weltachsen ausgerichtet und verwendet je Asset die auf Poly Haven angegebenen realen Größen (ein Editor-Rasterfeld etwa ein Meter), statt Material mit der Raumgröße zu dehnen. Die Originalfotos werden unverändert lokal importiert und aus dem Manifest mit Dateihash geladen.

Diese Projektgrenze gilt für weitere Änderungen am Raumeditor.
