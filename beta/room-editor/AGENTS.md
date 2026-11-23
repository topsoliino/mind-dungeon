# Room Atelier – Bearbeitungsgrenze

**Erlaubter Schreibbereich für diesen ChatGPT-Editor-Workflow:** ausschließlich `beta/room-editor/**` im Repository `topsoliino/mind-dungeon`.

**Verboten:** Alle Dateien der aktuell spielbaren Hauptspiel-Beta außerhalb dieses Editorordners, insbesondere `beta/index.html`, `beta/dungeon-isometric.js`, `beta/dungeon-guardian*.js`, `beta/alley-generator.js`, Spiel-Assets und Generator-/Gegnerdateien. Diese Änderungen sind ausschließlich ChatGPT Work vorbehalten.

- Der Editor darf existierende Hauptspiel-Assets **lesend** laden, insbesondere den originalen Wächter, darf sie aber niemals überschreiben.
- Schreiboperationen und Commits müssen auf Dateien mit Präfix `beta/room-editor/` begrenzt werden.
- Der bestehende Editor-Art-Build schreibt nur Assets unter `beta/room-editor/assets/`; Änderungen am Workflow unter `.github/` sind nicht Teil dieser Erlaubnis.
- Editor-Daten/-Vorschau und Spieltest bleiben vom produktiven Dungeon-Generator isoliert.
- Die Bodenkarte ist ein einzelnes 32×32-Welteinheiten-Artwork; kleine Räume clippen einen Ausschnitt statt einzelne Tiles zu wiederholen oder die Steingröße zu skalieren.

Diese Projektgrenze gilt für weitere Änderungen am Raumeditor.
