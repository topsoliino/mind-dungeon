# Isometrische Greybox · Ebene 1 (Etappe 4a, Generatorprototyp)

Aufruf: [Beta mit Generator](https://topsoliino.github.io/mind-dungeon/beta/?szene=gasse&modus=generator&seed=4147). Im Titelmenü gibt es einen eigenen Testeinstieg. Seed, neue Ebene und Mini-Karte sind links unten verfügbar.

## Ziel und Abgrenzung

- Die bestehende Gasse ist **Raum 0**. Die Ebene enthält **genau zehn Knoten**, Gänge zählen mit.
- Geometrie, reale Türöffnungen, Außenwände, ausgewählte Innenwände und eine reservierte Treppe sind vollständig berechnet, bevor eine Raumfunktion verteilt wird.
- Keine Gegner und keine Mobiliar- oder Beutetruhen-Spawns im Generator-Testmodus. Das bisherige Gassen-Demo unter \`?szene=gasse\` bleibt separat.
- Die Treppe ist **nur ein vertikaler Anschluss von Ebene 0 auf Ebene 1**, noch keine spielbare zweite Geschossebene. Keine unzutreffende Höhenphysik vortäuschen.
- Die Grundrisse sind quadratische Grundrisszellen, die Ausgabe bleibt orthografisch-isometrisch; der Wächter kann sich frei in alle Richtungen bewegen.

## Mathematische Konstruktion

1. **Seed und Zufallsstrom**: \`seed\` erzeugt einen deterministischen PRNG. Ein identischer Seed ergibt dieselbe Raumtopologie. Wenn ein Wachstum wegen Platzmangels scheitert, werden bis zu 14 weitere deterministische Kandidatenseeds probiert; der tatsächlich benutzte Seed ist im Generatorobjekt gespeichert.
2. **Raumgrundriss**: Jeder neue Raum \`i\` bekommt eine zusammenhängende Polyomino-Menge \`F_i ⊂ Z²\`. Größe und Silhouette werden zunächst aus \`Gang\` / \`Raum\` gewählt (gerade, Versatz, Ausbuchtung; Saal, L-Form, Nische, Abschrägung, Abstufung). Das System hält den Fluranteil auf 3–5 von 10 begrenzt.
3. **Platzierung ohne Kollision**: Für jede bisherige Außenkante wird eine benachbarte freie Zelle gesucht. Translation eines vollständigen Kandidaten-Grundrisses ist nur erlaubt, wenn \`F_i ∩ F_j = ∅\` für alle bestehenden Räume und sämtliche Zellen im Kartenrahmen liegen. Unbeabsichtigte Anschlüsse an **fremde** Räume werden verworfen.
4. **Garantierte Verbindung**: Der Elternraum erhält mindestens ein konkret benanntes Portal aus ein oder zwei Zellseiten zu seinem Kindraum. Es entsteht ein zusammenhängender Baum \`G = (V,E)\` mit \`|V|=10\` und \`|E|=9\`. Die Portale liegen auf tatsächlichen gemeinsamen Zellseiten. Alle übrigen Nachbarschaften werden gemauert, nicht als unsichtbarer Durchgang behandelt.
5. **Wände**: Die sichtbare Außenwand ist die diskrete Grenze \`∂F\` **abzüglich** benannter Portale. Zusammenhängende kollineare Kanten werden zu Wandzügen vereinigt. Hohe Rückwände und niedrige Cutaway-Vorderwände verwenden dieselbe Kollisionslogik. Größere Kammern können durch einen vom Rand bis zum Rand reichenden Innenwandzug mit ausgesparter Tür geteilt werden. Keine Wand wird ohne Bezug zu belegten Raumzellen erzeugt.
6. **Kollision und Navigation**: Wände haben eine endliche Dicke von \`0,15\` Weltzellen. Kollisionsprüfungen erweitern den Mauerkörper um den Heldenradius \`r = 14/48\` Weltzellen. Der Rechtsklick-Generator sucht Wege über passierbare Zellmittelpunkte (vier Nachbarn), prüft jede Zellkante kontinuierlich und glättet die Route nur bei freier Sichtlinie; Bewegung selbst bleibt frei und nicht auf acht Richtungen quantisiert.
7. **Vertikale Vorbereitung**: Eine 2×3-Zellen-Treppenfläche wird **innerhalb** einer geeigneten Kammer reserviert, möglichst abseits von Türen. Ein Fallback garantiert eine physisch passende Fläche, auch wenn die bevorzugte Platzierung nicht möglich ist. Das Metadatum \`levelFrom=0, levelTo=1\` beschreibt einen späteren Geschossübergang, keine bereits funktionsfähige Treppennavigation.
8. **Raumprogramm nach dem Topologieabschluss**: Erst jetzt erhält eine Kammer das Feld \`plannedUse\` (z. B. Studierzimmer, Waffenkammer, Werkstatt, Lagerraum). Die aktuelle Tiefenstufe kann die Auswahl beschränken. Dieser **Datenwert** ändert in Etappe 4a weder Texturen noch Gegner noch Einrichtung. Die Auswertung voriger Ebenen und biomspezifische Raumausstattung folgen später.

## Prüfung und nächste Iteration

\`\`\`sh
node tools/check-isometric-generator.cjs
\`\`\`

Der Test prüft 150 Seeds: Raumanzahl, disjunkte und in sich zusammenhängende Polyominos, Baum-Topologie, echte Portalflächen, Innen-/Außenwandgeometrie, Heldenradius bei Übergängen, Treppenflächen, Seed-Reproduzierbarkeit und geometrische Vielfalt.

Der Generator-Modus ist absichtlich isoliert. Diese erste Fassung beweist **einen** isometrischen Erdgeschoss-Grundriss. Noch offen: tatsächlich begehbare Höhenwechsel, große mehrgeschossige Kammern, Raumgrammatik abhängig von *vorherigen* Ebenen, echte Typ-spezifische Tilesets, Interieur und Gegner, kooperative Synchronisation sowie ein vollständiger visueller Browserabnahmetest.
