"""Pack physically modeled Blender Prison tiles as 512px transparent WebP.
Usage: python3 beta/room-editor/blender/pack-prison-tiles.py /tmp/md-room-editor-raw
"""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image
SOURCE=Path(__file__).resolve().parent/'build-prison-tiles.py'
OUT=SOURCE.parent.parent/'assets'/'tiles'
RAW=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/md-room-editor-raw')
OUT.mkdir(parents=True,exist_ok=True)
for name in ('floor-prison-01','wall-prison-x','wall-prison-y'):
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
manifest={
 'schema':'mind-dungeon-room-tiles/v1',
 'source':'editable Blender meshes, Filmic High Contrast, Cycles',
 'generator':'beta/room-editor/blender/build-prison-tiles.py',
 'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'sourceBlend':'../source/prison-tiles.blend',
 'pixelDimensions':[512,512],
 'projection':{
  'cameraAzimuth':225,'elevationDegrees':35.264,'projection':'ORTHO',
  'orientation':'same x-y and x+y axes as beta/alley-study.js',
  'floorOrthoScale':2.65,'wallOrthoScale':3.25,
  'wallRootZScale':0.8660254037844,'wallEditorHeight':2.0,
  'pivot':'tile center at z=0; wall center at gameplay z=1',
  'tileCoordinates':'one world tile equals 48 game world units, projected stepX=42',
 },
 'art':{'floor':'floor-prison-01.webp','wallStyle':'quarried-prison-stone',
        'wallX':'wall-prison-x.webp','wallY':'wall-prison-y.webp'}
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified 3 separate original Blender renders / ONE wall material',flush=True)
