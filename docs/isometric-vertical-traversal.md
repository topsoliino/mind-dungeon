# Etappe 4a · Treppen, Leitern und Geschosssichtbarkeit

**Test:** https://topsoliino.github.io/mind-dungeon/beta/?szene=gasse&modus=generator&seed=4147&v=5

## Treppengrammatik (Greybox)

Der Generator verwendet `beta/alley-stair-geometry.js` zur **baulich zusammenhängenden** Erzeugung von acht Treppenfamilien:

| Familie (`treppe=`) | Laufprinzip | Höhe / Stufen |
| --- | --- | --- |
| `straight-narrow` | Schmaler gerader Lauf | 132 / 12 |
| `straight-wide` | Breiter gerader Lauf | 132 / 12 |
| `grand` | Lange, große Freitreppe | 132 / 16 |
| `quarter` | L-Wendung mit einem echten Zwischenpodest | 132 / 14 |
| `switchback` | U-Wendung, zwei parallele Läufe, gemeinsames Zwischenpodest | 132 / 16 |
| `spiral-tight` | Enge Spindeltreppe mit schmalen Keilstufen | 132 / 13 |
| `spiral-wide` | Weite Spindeltreppe mit gleichbleibend breiten Keilstufen | 132 / 17 |
| `curved` | Geschwungene, offene Freitreppe ohne Mittelspindel | 132 / 12 |

`treppe` ist im Generator-Testmodus in der Minikarte auswählbar. `seed` steuert weiterhin die restliche Etage und – ohne explizite Treppenauswahl – die Bauart.

Jede Bauart hat eine Vorlage mit tatsächlichen **Trittflächen** (vier Bodenecken), **Setzstufen** (vertikale Vorderflächen), seitlichen tragenden Wangen, nötigen **Podesten**, Handläufen und festen oberen/unteren Einstiegspunkten. Die Keilstufen einer Wendeltreppe besitzen einen gemeinsamen Mittelpunkt und gleichen Innen- und Außenradius über alle Stufen. Die Höhenzunahme ist einheitlich: `z_i = i·H/N`.

Ein Treppentyp wird nur gewählt, wenn ein genügend großes rechteckiges Baufeld vollständig in einer Kammer liegt, keine bestehende Innenwand hindurchläuft und die zwei Einstiege genügend Platz haben. Wenn die Wunschform nicht passt, wählt der Generator eine passende alternative Treppe. Reservierungsdaten (`generator.stairs`) werden auf die **wirklich gewählte** Grundfläche synchronisiert. Die alte 2×3-Zellen-Platzhalterzeichnung ist im vertikalen Modus deaktiviert.

## Etagen & Rendering

- Die neue Empore liegt auf `Z=132`; ausgesparte Treppenzellen ergeben einen **Deckendurchbruch**. Der obere Boden ist ein eigener, kollidierender Raum-Layer.
- **Unten:** Die zur Etage hinaufführende Treppe und die untere Wandleiter sind sichtbar. Die *obere Bodenplatte* sowie ausschließlich zum Obergeschoss gehörende Podestmarkierungen und künftiges dortiges Interieur sind **vollständig unsichtbar**.
- **Aufstieg:** Obergeschossobjekte erscheinen erst während der letzten 16 % des Übergangs. **Abstieg:** Die obere Schicht verschwindet bereits während der ersten 18 % des Übergangs.
- **Oben:** Der obere Boden ist opak und der Held darüber sichtbar. Der feste Depth-Wert der unteren Treppe stammt aus dem isometrisch projizierten Fußpunkt, nicht aus dem beweglichen Wächter.
- Die bislang bestehende **automatische Leiter- und Treppeninteraktion mit E** bleibt erhalten: Weg zum passenden Einstieg, Ausrichtung, kontinuierlicher Höhenverlauf, Endpunkt und Geschosswechsel. Die bereits vorhandenen prozeduralen `climb-up`/`climb-down`-Bewegungen auf dem **exportierten Blender-Skelett** bleiben; die originale `.blend` wurde noch nicht neu gebacken.
- Die obere Wegfindung bleibt unabhängig von den unteren Wänden. Beim Platzieren der Leiter wird geprüft, dass ihr Deckenausschnitt den Obergeschossweg vom oberen Treppenpodest zur Leiter nicht unterbricht.
- Die Minikarte zeichnet die **wirkliche Form der Treppenstufen** und bietet einen Selektor zur vergleichenden Sichtprüfung.

## Geometrische Invarianten

1. `N` Trittflächen, jede mit `Δz = H/N`, nicht schwebende Quader unterschiedlicher Höhe.
2. Eine echte, durchgehende Laufspur `P(s) = (u(s),v(s),z(s))` mit konstanten Höhenabschnitten an Zwischenpodesten; die Animation interpoliert entlang der Laufspur in beide Richtungen.
3. Ein Geschossübergang findet erst am Ende der Bewegung statt. Keine Teleportation zwischen Räumen auf anderem `z`.
4. Eine Leiter hat eine angrenzende Außenwand, einen offenen Einstieg und eine zusammenhängende obere Ausstiegsfläche.
5. Obere Bauteile mit `level=1` werden im Erdgeschoss **nicht** gerendert. Sie benutzen dieselben Sichtbarkeitsregeln in Phaser und Canvas.

## Regressionstests

```bash
node tools/check-isometric-generator.cjs
node tools/check-isometric-vertical.cjs
node tools/check-isometric-stair-render.cjs
node tools/check-isometric-occlusion.cjs
node tools/check-isometric-stage4.cjs
```

`check-isometric-vertical` prüft 200 Seeds auf gleiche Setzstufenhöhen, nicht entartete Trittflächen, Anschlüsse, Höhenmonotonie, beidseitige Laufwege und alle acht Bauarten. `check-isometric-stair-render` baut acht Varianten samt isometrischem Renderer auf und prüft die **unsichtbaren Obergeschoss-Layer** unten, ihren Übergang, die feste Sortierung und tatsächliche Pfade zu Leiter und Treppe.

**Stand:** Das ist weiterhin ein Greybox-Prototyp mit einer **erhöhten Kammer-/Emporenebene**, nicht bereits ein ganzer zweiter prozeduraler Zehn-Raum-Grundriss. Die gebackenen Blender-Treppenassets, echte stufenweise Begehung ohne E, Sturzphysik, kooperative Synchronisierung und ein vollständiger visueller Browserabnahmetest stehen noch aus.
