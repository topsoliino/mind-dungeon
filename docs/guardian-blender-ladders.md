# Guardian – echte Blender-Leiteranimation

Die Leiteranimationen werden auf dem **vorhandenen**, editierbaren `Guardian rig` erstellt. Dabei bleibt das ursprüngliche Armature mit allen Rüstungs- und Knochenbindungen erhalten; es entsteht kein zweiter, von der Spielfigur entkoppelter Körper.

## Neue Takes

| Blender-/Browserclip | Einzelbilder bei 24 fps | Verhalten |
|---|---:|---|
| `climb-up` | 48 | Beide Hände an die Leiter, abwechselndes Nachgreifen und Nachsetzen der Füße, Gewichtsverlagerung, Übergang nach oben |
| `climb-down` | 48 | Hände anlegen, alternierendes Hinuntersteigen, Abstützen auf den Füßen und Rückkehr zum Stand |

Im **Blender-Original** ist die Leiter als Drahtgitterreferenz in der Collection `Ladder guide · Blender only` zu sehen. Diese Referenz wird **nicht** ins Browsermodell exportiert. Die Animation bewegt den Wächter im lokalen Raum: Die vertikale Position und die Geschosswechsel berechnet wie bisher `AlleyVertical.pose()` im Spiel.

Die eigentlichen animierten Knochen sind `Hips`, `Chest`, `Head`, `Mantle`, `Arm.L/R`, `Forearm.L/R`, `Glove.L/R`, `Pauldron.L/R`, `Thigh.L/R`, `Shin.L/R`, `Boot.L/R` und `Grip.R`. Hand- und Fußpositionen werden beim Baken mit einer Zweiknochen-IK gelöst, dann als echte Transform-Keyframes auf dem Armature abgelegt. Der Browser berechnet **keine IK** für die fertigen Takes.

## Blender-Export

Vom Repository-Hauptverzeichnis:

```sh
blender -b beta/art/player-study/guardian.blend -P tools/add-guardian-ladder-animations.py
blender -b beta/art/player-study/guardian.blend -P tools/export-guardian-web.py -- beta/art/player-study/guardian-rig.glb.gz
python3 tools/check-guardian-ladder-rig-assets.py
```

Beim ersten Baken werden zwei fortlaufende Bereiche **nach allen bisherigen Takes** erstellt. Das Skript ist wiederholbar; ursprüngliche Animationsbereiche werden nicht überschrieben. Die Clipnummern stehen danach in `guardian-frames.json`.

Der GitHub-Actions-Workflow `.github/workflows/bake-guardian-ladders.yml` führt die Schritte mit Blender auf einem Linux-Runner aus und speichert die aktualisierte `.blend`, das `.glb.gz` und die Clipmetadaten ins Repository, wenn alle Prüfungen erfolgreich sind.

## Wiedergabe in Mind Dungeon

- `climb-up` und `climb-down` werden über die vorhandene Leiterinteraktion mit **E** ausgewählt.
- Die Laufzeit der Animation ergibt sich aus dem Leiterübergang, nicht starr aus der Länge des Blender-Takes.
- Im Three.js-Wächter wird **nur** die gebackene Animation verwendet, wenn die volle GLB-Zeitspur nachweislich vorhanden ist. Mit einem älteren GLB bleibt die bisherige prozedurale Leiterpose als Rückfalllösung aktiv.
- Der bisherige Sprite-Wächter kann zur Sicherheit die alten Walkframes anstelle der nur in 3D existierenden Clips verwenden.
- Kontrollpunkt: `tools/check-guardian-ladder-rig-assets.py` muss das Ende des GLB-Keyframebereichs sowie die eigentlichen animierten Armature-Nodes bestätigen.

Bei sichtbarem Fuß- oder Handversatz im Spiel bitte sowohl die geometrische Leiter-Sprossenhöhe als auch die Bewegungsphase in `beta/alley-vertical.js` kontrollieren; die Blenderanimation ist bewusst positionsunabhängig, damit dieselbe Pose auf unterschiedlich langen Leitern funktioniert.
