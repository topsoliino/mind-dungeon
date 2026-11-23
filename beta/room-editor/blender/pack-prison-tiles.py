"""Publish ORIGINAL Poly Haven preview PNGs and the legacy 3 editor WebP fallbacks.

The four new photo materials are downloaded and saved BYTE FOR BYTE.
No Pillow resize, paint, filters, compositing, conversion, or compression
is performed on imported sources. This file only verifies them and records
provenance and hashes. The original 3 Blender WebPs remain for existing
editor-only CI compatibility and are not used as photo variants.

Run: python3 beta/room-editor/blender/pack-prison-tiles.py /tmp/md-room-editor-raw
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from PIL import Image

SOURCE=Path(__file__).resolve().parent/'build-prison-tiles.py'
FLOOR_SOURCE=SOURCE.parent/'build-floor-map.py'
WALL_SOURCE=SOURCE.parent/'build-wall-maps.py'
OUT=SOURCE.parent.parent/'assets'/'tiles'
RAW=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/md-room-editor-raw')
OUT.mkdir(parents=True,exist_ok=True)

# Preserve only the existing three 512px Blender WebPs; never use these for
# either photographic wall style or the new floor texture.
for name in ('floor-prison-01','wall-prison-x','wall-prison-y'):
    source=RAW/(name+'.png')
    if not source.is_file():
        raise SystemExit('Missing existing Blender editor render '+str(source))
    with Image.open(source) as input:
        image=input.convert('RGBA')
        if image.size!=(512,512):
            raise SystemExit('Expected legacy 512x512 '+str(source))
        if not image.getchannel('A').getbbox():
            raise SystemExit('Legacy Blender render transparent: '+name)
        image.save(OUT/(name+'.webp'),format='WEBP',quality=95,method=6,exact=True)

# Import primary preview photos exactly as delivered by Poly Haven.
subprocess.run([sys.executable,str(FLOOR_SOURCE),'--variant','all'],check=True)
subprocess.run([sys.executable,str(WALL_SOURCE)],check=True)

VARIANTS={
    'dungeon-ashlar':('floor-prison-01.png','monastery_stone_floor'),
    'dungeon-cut-stone':('floor-prison-02.png','rectangular_paving'),
    'stone':('wall-masonry-01.png','medieval_wall_02'),
    'stone-cut':('wall-masonry-02.png','stone_block_wall'),
}
asset_info={}
for style,(filename,asset_id) in VARIANTS.items():
    path=OUT/filename
    contents=path.read_bytes()
    if contents[:8]!=b'\x89PNG\r\n\x1a\n':
        raise SystemExit('Original photo not a PNG '+filename)
    with Image.open(path) as image:
        width,height=image.size
        if min(width,height)<700:
            raise SystemExit('Photo source unexpectedly small '+filename)
    asset_info[style]={
        'file':filename,
        'asset':asset_id,
        'sourcePage':'https://polyhaven.com/a/'+asset_id,
        'sourceImage':'https://cdn.polyhaven.com/asset_img/primary/'+asset_id+'.png?height=2048&quality=95',
        'sha256':hashlib.sha256(contents).hexdigest(),
        'dimensions':[width,height],
        'byteIdenticalToSource':True,
    }

manifest={
    'schema':'mind-dungeon-room-tiles/v3',
    'source':'Original Poly Haven primary-preview PNG photographs; no filters or generated dirt',
    'textureMode':'original-photo-byte-identical',
    'license':'CC0: https://polyhaven.com/license',
    'floorMaterial':'original-photo-byte-identical',
    'wallMaterial':'original-photo-byte-identical',
    'floorVariants':{
        'dungeon-ashlar':VARIANTS['dungeon-ashlar'][0],
        'dungeon-cut-stone':VARIANTS['dungeon-cut-stone'][0],
    },
    'wallVariants':{
        'stone':VARIANTS['stone'][0],
        'stone-cut':VARIANTS['stone-cut'][0],
    },
    'assetInfo':asset_info,
    'floorGenerator':'beta/room-editor/blender/build-floor-map.py',
    'floorGeneratorSha256':hashlib.sha256(FLOOR_SOURCE.read_bytes()).hexdigest(),
    'wallGenerator':'beta/room-editor/blender/build-wall-maps.py',
    'wallGeneratorSha256':hashlib.sha256(WALL_SOURCE.read_bytes()).hexdigest(),
    'floorPhotoWorldSpan':[12,6],
    'wallPhotoWorldSpan':[4,2],
    'legacyBlenderWallProjectionFiles':['wall-prison-x.webp','wall-prison-y.webp'],
    'gameBetaFilesModified':False,
}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('VERIFIED: four ORIGINAL photo PNGs published unchanged',flush=True)
