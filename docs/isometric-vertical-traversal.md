# Etappe 4a · Treppen, Leitern und Geschosssichtbarkeit

**Test:** https://topsoliino.github.io/mind-dungeon/beta/?szene=gasse&modus=generator&seed=4147&v=9

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
- **Oben:** Der obere Boden ist opak und der Held darüber sichtbar. Jede Trittfläche und jedes Zwischenpodest hat **eine eigene vorgerenderte Textur und feste, grundrissbezogene Zeichentiefe**. Der Wächter kann sich deshalb unter hoch gelegenen, offenen Treppenabschnitten bewegen, ohne dass der ganze Treppenlauf fälschlich vor oder hinter ihm liegt.
- **Leitern** behalten ihre E-Interaktion und den animierten Übergang. **Treppen** dagegen sind vollständig steuerbar: E bringt den Helden nur zum Fuß oder Kopf und startet **keinen automatischen Auf- oder Abstieg**. Rechtsklick auf eine konkrete Stufe läuft nur bis dorthin, danach stoppt der Held. WASD und Bewegungsinput steuern die Laufrichtung jederzeit selbst; E auf der Treppe bricht ein Klickziel ab. Die bereits vorhandenen prozeduralen `climb-up`/`climb-down`-Bewegungen auf dem **exportierten Blender-Skelett** bleiben für Leitern; die originale `.blend` wurde noch nicht neu gebacken.
- Die obere Wegfindung bleibt unabhängig von den unteren Wänden. Beim Platzieren der Leiter wird geprüft, dass ihr Deckenausschnitt den Obergeschossweg vom oberen Treppenpodest zur Leiter nicht unterbricht.
- Die Minikarte zeichnet die **wirkliche Form der Treppenstufen** und bietet einen Selektor zur vergleichenden Sichtprüfung.


## Treppenphysik und Flächenkollision

Das Treppenmodell ist nicht länger nur eine per Zeit abgespielte Animationsbahn. Der Wächter besitzt beim Betreten einer Treppe einen **physischen Laufzustand** (`state.stairRide`) und bewegt sich über die Länge des tatsächlichen dreidimensionalen Treppenpfads. Position, Höhe und Richtung stammen aus demselben geometrischen Modell, mit dem die Stufen gezeichnet werden.

- **Eintritt nur am Fuß oder Kopf.** Der Einstiegswächter prüft Abstand und Laufrichtung. E oder Rechtsklick auf eine Stufe bringt den Helden zunächst zum richtigen Eingang, danach bewegt er sich **nur durch Eingabe bzw. bis zum ausdrücklich angeklickten Teilstück**; ein vollständiger Autopilot ist abgeschaltet. Rechtsklick auf die oberste Landefläche ist eine bewusste Auswahl des Endziels, kein durch E erzwungener Transfer.
- **Laufkorridor mit Schutzkanten.** Beim Gehen wird die gewünschte Bewegungsrichtung in **entlang** und **quer** zur lokalen Treppentangente zerlegt. Querbewegung bleibt innerhalb `±(Treppenbreite/2 − Heldenradius − Sicherheitsabstand)`; dadurch kann man in diesem Entwicklungsstadium nicht seitlich heruntergehen oder versehentlich abstürzen. Der Spieler kann die Treppe umkehren, ohne sie zu verlassen.
- **Alte 2D-Treppengeschwindigkeiten wiederverwendet:** `beta/dungeon-stairs.js` war die vorhandene Implementierung. Gerade Treppen: bergauf Faktor **0,68**, bergab **0,83**. Geschwungene und gewendelte Treppen: bergauf **0,73**, bergab **0,86**. Seitwärtsverschiebung **0,58**. Auf einem ebenen Zwischenpodest **0,95**. Diese Werte skalieren die reguläre ebene Bewegung und bleiben unabhängig von der Animationsdauer.
- **Höhe aus Geometrie.** Jede Laufstrecke hat einen Parameter `s`. In dem Abschnitt zwischen zwei echten Stufen-/Podestpunkten wird `(u,v,z)` räumlich interpoliert. Podeste halten die Höhe konstant; geneigte Stufen verändern sie stetig. Das Obergeschoss wird ausschließlich am oberen Ende, das Erdgeschoss ausschließlich am unteren Ende freigegeben.
- **Volumetrische Bauteile.** Trittflächen besitzen Ober- und Setzflächen sowie seitliche Träger. **Zwischenpodeste sind echte Quader mit Unterseite und allen vier Seitenflächen.** Offene Bauarten tragen diese Platten auf Stützen, geschlossene Bauarten haben einen bis zum Boden reichenden Unterbau. Die U-Treppe hat ein verbindendes gemeinsames Podest; die Freitreppe verlässt den letzten Tritt tangential.
- **Zugangsprüfung bei der Generierung.** Der Treppentyp passt nicht nur geometrisch, sondern darf auch den tatsächlichen Weg vom Startraum zum Treppenfuß nicht versperren. Der Generator prüft diese Bedingung mittels einer schnellen Gitter-Flood-Fill-Prüfung und sucht sonst eine andere zulässige Position oder Bauart. Am oberen Treppenabschluss wird eine breite, begehbare Landefläche reserviert.
- **Unterführungen:** Die Bauarten `grand`, `switchback` und `curved` sind offen; dort ist auf dem Erdgeschoss ein Durchgang unter Stufen ab **92 Einheiten lichter Höhe** zulässig. Niedrige Bauteile, geschlossene Treppen und tragende Bereiche bleiben Hindernisse. Mit **Alt+Rechtsklick** lässt sich gezielt der Erdgeschossboden unter einer sichtbaren Treppenprojektion anwählen.
- **Ebenendarstellung:** Die obere Bodenplatte bleibt unten vollständig unsichtbar. Während der letzten Strecke eines echten Aufstiegs wird sie auf Basis des erreichten `s`, nicht anhand eines davon unabhängigen Timers, eingeblendet.

Die ursprüngliche 2D-Version erlaubt außerdem Unterführungen, Höhenkanten und später Stürze mit Schadensregeln. Die **später mögliche Absturz- und Knockback-Physik an Treppen** wird hier bewusst noch nicht aktiviert. Der zuvor diskutierte Artikel ist Michael Bitzos, [*Implementing satisfying stairs for your 2D top-down game*](https://michaelbitzos.com/devblog/implementing-stairs-in-2d-top-down-games). Die konkreten Geschwindigkeitsfaktoren stammen aus unserem vorhandenen 2D-Code `beta/dungeon-stairs.js`, nicht aus dem Artikel.

## Vorberechnung und Laufzeit

- Der Seed wird **einmal beim Start der Szene festgelegt**. Treppengeometrie, Podeste, Gebäude, Treppen-Texturen und Höhenlayer werden während des Lade-/Szenenaufbaus rasterisiert.
- Der Generator zeichnet die großen Hintergrund-, Boden-, Detail-, Beleuchtungs- und Atmosphärenebenen direkt in **Canvas-Kacheln mit maximal 1536 × 1536 Pixeln**, statt zunächst mehrere vollständige riesige Leinwände zu erzeugen und zusätzlich zu kopieren.
- Die begehbaren Navigationsknoten und bereits kollisionsgeprüften Kanten werden getrennt für Erdgeschoss und Obergeschoss vorbereitet. Bei einem Rechtsklick läuft nur noch die **A*-Abfrage auf diesem festen Graphen**.
- Während des Spiels werden hauptsächlich Bewegung, Kollision und Spiellogik aktualisiert. Die statische Bausubstanz wird nicht pro Frame neu gerastert; Sichtbarkeits-/Verdeckungsupdates erfolgen nur nach nennenswerter Bewegung oder einem Geschoss-/Sichtbarkeitswechsel.
- Eine automatische Messung realer Browser-FPS mit WebGL/Blender-Rig steht noch aus. Die Architektur reduziert unnötige Arbeit; ein konkreter FPS-Gewinn wird nicht ohne Browser-Messung behauptet.

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
node tools/check-isometric-stair-physics.cjs
node tools/check-isometric-occlusion.cjs
node tools/check-isometric-stage4.cjs
```

`check-isometric-vertical` prüft 200 Seeds auf Stufen, Podeste, Verbindungen und alle acht Bauarten. `check-isometric-stair-physics` prüft manuelle Klickziele, vollständige beidseitige Wege und die offenen/geschlossenen Unterseiten. `check-isometric-stair-render` prüft die **individuell gebackenen Trittflächen**, versteckte obere Etagen, Sichtbarkeitsübergänge, statische Texturen und tatsächliche Wege zu Treppe und Leiter.

**Stand:** Das ist weiterhin ein Greybox-Prototyp mit einer **erhöhten Kammer-/Emporenebene**, nicht bereits ein ganzer zweiter prozeduraler Zehn-Raum-Grundriss. Die gebackenen Blender-Treppenassets, Sturzphysik, kooperative Synchronisierung und ein vollständiger visueller Browserabnahmetest stehen noch aus.
