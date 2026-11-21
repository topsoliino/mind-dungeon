# Etappe 4a · Leiter, Treppe und vertikale Isometrie

**Test:** https://topsoliino.github.io/mind-dungeon/beta/?szene=gasse&modus=generator&seed=4147&v=4

## Implementiert

- Der prozedurale Generator hält die Gasse als Start und generiert weiterhin zehn Räume/Gänge.
- Eine größere generierte Kammer enthält eine **wirklich erhöhte Bodenplatte** (Z = 132 Bildpixel), einschließlich ausgesparter Treppenzone und Leiterschacht.
- Eine Treppe besteht aus neun aufeinander folgenden **soliden isometrischen 3D-Trittstufen**, massiven Setzstufen, Wangen und Geländer.
- Eine Leiter wird nur an einer **tatsächlich vorhandenen Außenwand** der Kammer angebracht. Ihr Lagerort und ihre Himmelsrichtung sind vom Seed abhängig. Sie besitzt zwei Holme, Sprossen und obere Haltegriffe.
- Beide Verbindungen besitzen einen expliziten Einstiegspunkt und einen Zielpunkt auf der anderen Höhe. **E in der Nähe** setzt den Weg zum Einstieg, positioniert die Spielfigur automatisch und startet erst dann den Übergang. Rechtsklick-Bewegung oder Angriffe dürfen einen begonnenen Übergang nicht abbrechen.
- Leiter auf / Leiter ab sind zwei neue, unterschiedlich phasierte **prozedurale Animationsabläufe auf dem bestehenden exportierten Blender-Rig**. Hände, Oberkörper, Hüften, Beine und Füße bewegen sich; beim Erreichen des oberen Randes gibt es eine kurze Aufstütz-/Ausstiegsbewegung. Das bestehende GLB wurde **nicht neu in Blender exportiert**; eine gebackene Blender-Aktion ist eine spätere mögliche Qualitätsverbesserung.
- Das Geschoss ist eine eigene physikalische Ebene. Auf der oberen Plattform sind die unteren Wände keine unsichtbaren Kollisionen. Eine andere Etage wird erst nach vollständigem Überstieg freigegeben.
- Der obere Boden wird als separate, deckende Ebene über dem Erdgeschoss gerendert. Steht der Spieler direkt darunter, blendet die Bodenplatte auf 24 % Deckkraft ab, damit der Wächter sichtbar bleibt. Auf dem Obergeschoss ist die Bodenplatte deckend und der Held wird darüber gezeichnet.
- Mausziel und Kamera kompensieren den Höhenversatz. Die Mini-Karte zeigt Treppe, Leiter und das aktuelle Geschoss.
- Keine neuen Gegner, Möbel oder thematischen Raumsets in diesem Prototyp.

## Geometrische Regeln

- Leiterstelle: eine besetzte Raumzelle \`c\` und eine Richtung \`d\`, für die \`c + d\` **außerhalb** der Kammer liegt und \`c - d\` innerhalb.
- Aufgänge enden auf einer passierbaren Fläche derselben ausgewählten Kammer; die Verbindung der obersten Treppenstufe mit dem oberen Leiter-Landeplatz wird durch Flood-Fill geprüft.
- Höhenfunktion während des Übergangs: \`z(t)=H·smoothstep(clamp((t-0.11)/0.78))\` beim Aufstieg, beim Abstieg \`H-z(t)\`, mit \`H=132\` Bildpixel.
- Rendering benutzt Ebenen-Prioritäten statt beweglicher Wandtiefen. Die bereits statischen Mauertiefen bleiben unangetastet.

## Test

\`\`\`bash
node tools/check-isometric-generator.cjs
node tools/check-isometric-vertical.cjs
node tools/check-isometric-occlusion.cjs
node tools/check-isometric-stage4.cjs
\`\`\`

Die Vertikal-Regression prüft 120 Seeds: Anbindung an Außenwände, Platzierung der oberen Platte, Erreichbarkeit beider Landungen, beide Auf-/Abstiegskurven sowie das erwartete Endgeschoss. Einen vollständigen visuellen Browserdurchlauf der **veröffentlichten** GitHub-Pages-Version ersetzt der Code-Test nicht.

**Bewusste Grenze der Etappe 4a:** Der Generator besitzt zunächst einen oberen Emporenbereich **in einer** Kammer, noch keine komplette zweite, wiederum aus zehn Räumen bestehende Ebene. Weitere Geschosse, Treppenkollision in jedem Animationsframe, Fall-/Abgrundregeln, Koop-Synchronisierung von Geschosswechseln und gebackene Blender-Clips sind spätere Aufgaben.
