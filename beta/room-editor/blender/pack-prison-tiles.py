"""Pack physically modeled Blender Prison tiles as 512px transparent WebP.
Usage: python3 beta/room-editor/blender/pack-prison-tiles.py /tmp/md-room-editor-raw
"""
import hashlib
import json
from pathlib import Path
import sys
import subprocess
from PIL import Image
SOURCE=Path(__file__).resolve().parent/'build-prison-tiles.py'
OUT=SOURCE.parent.parent/'assets'/'tiles'
RAW=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/md-room-editor-raw')
OUT.mkdir(parents=True,exist_ok=True)
for name in ('wall-prison-x','wall-prison-y'):
    source=RAW/(name+'.png')
    if not source.is_file():raise SystemExit('Missing real Blender render '+str(source))
    with Image.open(source) as input:
        image=input.convert('RGBA')
        if image.size!=(512,512):raise SystemExit('Expected 512x512 '+str(source))
        alpha=image.getchannel('A')
        if not alpha.getbbox():raise SystemExit('Blender tile is transparent: '+name)
        # Keep the entire transparent canvas. The centered camera target
        # provides an invariant pivot and mathematically correct world scale.
        result=OUT/(name+'.webp')
        image.save(result,format='WEBP',quality=95,method=6,exact=True)
        print(name,alpha.getbbox(),result.stat().st_size,'bytes',flush=True)
floor_source=SOURCE.parent/'build-floor-map.py'
subprocess.run([sys.executable,str(floor_source)],check=True)
with Image.open(OUT/'floor-prison-01.webp') as floor_map:
    if floor_map.size!=(4096,4096):raise SystemExit('Floor artwork must be 4096x4096')
manifest={
 'schema':'mind-dungeon-room-tiles/v2',
 'source':'Blender wall meshes and one photographic CC0 dungeon-floor bake',
 'floorMaterial':'photoreal-scanned-cc0',
 'floorSources':['monastery_stone_floor','stone_floor','rock_embedded_floor'],
 'floorLicense':'CC0; source photos by Poly Haven',
 'generator':'beta/room-editor/blender/build-prison-tiles.py',
 'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'sourceBlend':'../source/prison-tiles.blend',
 'wallPixelDimensions':[512,512],
 'floorPixelDimensions':[4096,4096],
 'floorWorldDimensions':[32,32],
 'floorGenerator':'beta/room-editor/blender/build-floor-map.py',
 'floorGeneratorSha256':hashlib.sha256(floor_source.read_bytes()).hexdigest(),
 'projection':{
  'cameraAzimuth':45,'elevationDegrees':35.264,'projection':'ORTHO',
  'orientation':'same x-y and x+y axes as beta/alley-study.js',
  'floorOrthoScale':2.65,'wallOrthoScale':3.25,
  'wallRootZScale':0.8660254037844,'wallEditorHeight':2.0,
  'pivot':'tile center at z=0; wall center at gameplay z=1',
  'tileCoordinates':'one world tile equals 48 game world units, projected stepX=42',
 },
 'art':{'floor':'floor-prison-01.webp','floorUv':'world-orthographic-32x32-center-crop','wallStyle':'quarried-prison-stone',
        'wallX':'wall-prison-x.webp','wallY':'wall-prison-y.webp'}
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified two Blender wall views plus one continuous 4096px floor artwork',flush=True)
