# Etappe 4a · Treppen, Leitern und Geschosssichtbarkeit

**Test:** https://topsoliino.github.io/mind-dungeon/beta/?szene=gasse&modus=generator&seed=4147&v=18

## Treppengrammatik (Greybox)

Der Generator verwendet `beta/alley-stair-geometry.js` zur **baulich zusammenhängenden** Erzeugung von neun Treppenfamilien:

| Familie (`treppe=`) | Laufprinzip | Höhe / Stufen |
| --- | --- | --- |
| `straight-narrow` | Schmaler gerader Lauf | 132 / 12 |
| `straight-wide` | Breiter gerader Lauf | 132 / 12 |
| `grand` | Lange, große Freitreppe | 132 / 16 |
| `quarter` | L-Wendung mit einem echten Zwischenpodest | 132 / 14 |
| `switchback` | Offene U-Wendung mit geduckt begehbarem Zwischenpodest | 132 / 16 |
| `switchback-closed` | U-Treppe mit massiv geschlossenem Unterbau | 132 / 16 |
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

Die Treppe wird als **zusammenhängendes 2,5D-Navigationsnetz aus Trittflächen, Podesten und Einstiegsflächen** behandelt. Der Wächter bewegt sich im Laufzustand (`state.stairRide`) frei in **X/Y über die gesamte nutzbare Fläche**, nicht entlang einer fest vorgegebenen Mittellinie. Seine Höhe `z` ergibt sich aus der tatsächlich betretenen Trittfläche beziehungsweise dem Podest. Auf angrenzenden Stufen werden die Höhen über die Trittgeometrie stetig interpoliert.

- **Ein- und Ausstieg über die volle nutzbare Breite.** Die Physik verwendet am Fuß und Kopf gerichtete breite Portale statt kleiner Punkttrigger. So führen normales Weiterlaufen und gezieltes Absteigen zuverlässig auf die betreffende Etage, ohne Rollen. Die seitliche Position beim Einstieg bleibt erhalten. Bei einem Rechtsklick auf eine beliebige sichtbare Stufen-, Setzstufen-, Seiten- oder Handlauffläche wird die zugehörige begehbare Fläche bestimmt. Befindet sich der Held noch nicht auf der Treppe, läuft er zuerst zum passenden Eingang seines Geschosses. Anschließend erreicht er den **konkreten angeklickten Punkt** über eine möglichst kurze sichere Route (A* mit acht Richtungen und Sichtlinienglättung). **E** bringt ihn nur zum Eingang; die weitere Bewegung bleibt manuell. Auf der Treppe bricht E ein bestehendes Klickziel ab.
- **Freie Begehbarkeit mit Randkollision.** Die Vereinigung aller begehbaren Treppenpolygone ist die erlaubte Fläche. Die Position und zwölf Radiusprüfpunkte werden mit **Heldenradius 0,29 Rastereinheiten plus 0,035 Sicherheit** überprüft. An äußeren Kanten bleibt der Held stehen oder gleitet entlang; **innere Stufen- und Podestgrenzen sind frei passierbar**. Auf breiten Stufen kann er seitlich laufen, auf Zwischenpodesten beliebig drehen, stehen bleiben oder zurückgehen.
- **Alte 2D-Treppengeschwindigkeiten wiederverwendet:** `beta/dungeon-stairs.js` war die vorhandene Implementierung. Gerade Treppen: bergauf Faktor **0,68**, bergab **0,83**. Geschwungene und gewendelte Treppen: bergauf **0,73**, bergab **0,86**. Seitwärtsverschiebung **0,58**. Auf einem ebenen Zwischenpodest **0,95**. Diese Werte skalieren die reguläre ebene Bewegung und bleiben unabhängig von der Animationsdauer.
- **Aktionen auf Treppen:** Leichte und schwere Angriffe, Schlagaufladung, Essen und Trinken, Rollen und Schleichen sind freigegeben. Die jeweiligen Aktionsanimationen haben Vorrang vor dem Treppen-Gang; Bewegungstempo wird beim Ducken und Konsumieren entsprechend angepasst.
- **Höhe und Ausweichen aus Geometrie.** Auf einer Trittfläche wird die Höhe aus der Projektion der aktuellen XY-Position zwischen ihrer vorderen und hinteren Kante abgeleitet; auf einem Podest bleibt sie konstant. `s` dient nur noch als abgeleiteter Höhen-/Anzeigeparameter, nicht als Positionszwang. **Umschalt/Rolle** ist auch auf der Treppe möglich: Die höhere Rollgeschwindigkeit bleibt an dieselbe Radiuskollision gebunden, sodass man in diesem Stadium nicht herunterfallen kann. Ein Geschosswechsel erfolgt erst am tatsächlichen Fuß- oder Kopfpunkt und nur bei einer darauf gerichteten Bewegung.
- **Volumetrische Bauteile.** Trittflächen besitzen Ober- und Setzflächen sowie seitliche Träger. **Zwischenpodeste sind echte Quader mit Unterseite und allen vier Seitenflächen.** Offene Bauarten tragen diese Platten auf Stützen, geschlossene Bauarten haben einen bis zum Boden reichenden Unterbau. Die U-Treppe hat ein verbindendes gemeinsames Podest; die Freitreppe verlässt den letzten Tritt tangential.
- **Zugangsprüfung bei der Generierung.** Der Treppentyp passt nicht nur geometrisch, sondern darf auch den tatsächlichen Weg vom Startraum zum Treppenfuß nicht versperren. Der Generator prüft diese Bedingung mittels einer schnellen Gitter-Flood-Fill-Prüfung und sucht sonst eine andere zulässige Position oder Bauart. Am oberen Treppenabschluss wird eine breite, begehbare Landefläche reserviert.
- **Unterführungen und Ducken:** `grand`, `switchback` und `curved` sind offen. Aufrechtes Stehen erfordert **92 Höheneinheiten**, Ducken (`Strg`) **39**. Unter dem offenen U-Podest (Z=66; Unterseite Z≈53) passt der Held daher **nur geduckt** hindurch. Ein Aufstehen in zu geringer Höhe wird verweigert, während die Stützpfosten selbst stets massiv bleiben. Die neue Form `switchback-closed` besitzt einen vollständigen Unterbau, der auch geduckt nicht begehbar ist. **Alt+Rechtsklick** dient zur gezielten Anwahl des Bodens unter sichtbaren Treppenflächen.
- **Ebenendarstellung:** Die obere Bodenplatte bleibt unten vollständig unsichtbar. Während der letzten Strecke eines echten Aufstiegs wird sie auf Basis des erreichten `s`, nicht anhand eines davon unabhängigen Timers, eingeblendet.

Die ursprüngliche 2D-Version erlaubt außerdem Unterführungen, Höhenkanten und später Stürze mit Schadensregeln. Die **später mögliche Absturz- und Knockback-Physik an Treppen** wird hier bewusst noch nicht aktiviert. Der zuvor diskutierte Artikel ist Michael Bitzos, [*Implementing satisfying stairs for your 2D top-down game*](https://michaelbitzos.com/devblog/implementing-stairs-in-2d-top-down-games). Die konkreten Geschwindigkeitsfaktoren stammen aus unserem vorhandenen 2D-Code `beta/dungeon-stairs.js`, nicht aus dem Artikel.

## Vorberechnung und Laufzeit

- Der Seed wird **einmal beim Start der Szene festgelegt**. Treppengeometrie, Podeste, Gebäude, Treppen-Texturen und Höhenlayer werden während des Lade-/Szenenaufbaus rasterisiert.
- Der Generator zeichnet die großen Hintergrund-, Boden-, Detail-, Beleuchtungs- und Atmosphärenebenen direkt in **Canvas-Kacheln mit maximal 1536 × 1536 Pixeln**, statt zunächst mehrere vollständige riesige Leinwände zu erzeugen und zusätzlich zu kopieren.
- Die Boden-Navigationsknoten und bereits kollisionsgeprüften Kanten werden für Erdgeschoss (stehend und geduckt) sowie Obergeschoss separat vorbereitet. Für Treppen wird zusätzlich beim Laden ein eigener **radiusgeprüfter Polygon-Navigationsgraph mit 0,18 Rastereinheiten Schrittweite und 8 Nachbarn** erstellt. Rechtsklick löst nur noch A* und eine kollisionsgeprüfte Routenglättung aus.
- Während des Spiels werden hauptsächlich Bewegung, Kollision und Spiellogik aktualisiert. Die statische Bausubstanz wird nicht pro Frame neu gerastert; Sichtbarkeits-/Verdeckungsupdates erfolgen nur nach nennenswerter Bewegung oder einem Geschoss-/Sichtbarkeitswechsel.
- Eine automatische Messung realer Browser-FPS mit WebGL/Blender-Rig steht noch aus. Die Architektur reduziert unnötige Arbeit; ein konkreter FPS-Gewinn wird nicht ohne Browser-Messung behauptet.

## Geometrische Invarianten

1. `N` Trittflächen, jede mit `Δz = H/N`, nicht schwebende Quader unterschiedlicher Höhe.
2. Eine baulich zusammenhängende Stufen- und Podestgeometrie; die ursprüngliche Laufspur `P(s)` bleibt Referenz für Aufbau und Geschosswechsel, aber **nicht** als Bewegungspflicht. Freies XY mit eindeutiger, aus der begehbaren Fläche berechneter Höhe und robusten seitlichen Sicherheitsrändern.
3. Ein Geschossübergang findet erst am Ende der Bewegung statt. Keine Teleportation zwischen Räumen auf anderem `z`.
4. Eine Leiter hat eine angrenzende Außenwand, einen offenen Einstieg und eine zusammenhängende obere Ausstiegsfläche.
5. Obere Bauteile mit `level=1` werden im Erdgeschoss **nicht** gerendert. Sie benutzen dieselben Sichtbarkeitsregeln in Phaser und Canvas.

## Regressionstests

```bash
node tools/check-isometric-generator.cjs
node tools/check-isometric-vertical.cjs
node tools/check-isometric-stair-render.cjs
node tools/check-isometric-stair-physics.cjs
node tools/check-isometric-stair-free-navigation.cjs
node tools/check-isometric-stair-exits.cjs
node tools/check-isometric-occlusion.cjs
node tools/check-isometric-stage4.cjs
```

`check-isometric-vertical` prüft 200 Seeds auf Stufen, Podeste, Verbindungen und alle neun Bauarten. `check-isometric-stair-physics` prüft freie Bewegungsrichtung, vollständige beidseitige Wege, Zwischenpodeste, sichere Rollen und die offenen/geschlossenen Unterseiten. `check-isometric-stair-free-navigation` prüft zusätzlich 32 Seeds mit Klicks auf **jede einzelne Tritt-/Setzstufe**, freiem Querlaufen, sicherem Ausweichen und tatsächlicher Zielposition. `check-isometric-stair-exits` prüft beide normalen Geschossausstiege ohne Rolle, die zwei U-Unterbauten und freigegebene Angriffs-/Konsumzustände. `check-isometric-stair-render` prüft die gebackenen Trittflächen, verdeckte obere Etagen, Sichtbarkeitsübergänge und die Wege zur Leiter.

**Stand:** Das ist weiterhin ein Greybox-Prototyp mit einer **erhöhten Kammer-/Emporenebene**, nicht bereits ein ganzer zweiter prozeduraler Zehn-Raum-Grundriss. Die gebackenen Blender-Treppenassets, Sturzphysik, kooperative Synchronisierung und ein vollständiger visueller Browserabnahmetest stehen noch aus.
