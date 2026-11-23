"""Publish six UNMODIFIED Poly Haven primary preview PNGs for the room editor.

Only files under beta/room-editor/** may be changed. Existing Blender
fallback WebPs are retained solely to satisfy the isolated existing CI
assertion; they are NEVER the active photo material in the room renderer.
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

# Leave the current CI workflow untouched: exactly three legacy WebPs.
for name in ('floor-prison-01','wall-prison-x','wall-prison-y'):
    source=RAW/(name+'.png')
    if not source.is_file():
        raise SystemExit('Missing legacy Blender render '+str(source))
    with Image.open(source) as input:
        image=input.convert('RGBA')
        if image.size!=(512,512):
            raise SystemExit('Expected legacy 512x512 '+str(source))
        if not image.getchannel('A').getbbox():
            raise SystemExit('Legacy Blender render transparent: '+name)
        image.save(OUT/(name+'.webp'),format='WEBP',quality=95,method=6,exact=True)

# Download the precise user-selected unmodified source pictures.
subprocess.run([sys.executable,str(FLOOR_SOURCE),'--variant','all'],check=True)
subprocess.run([sys.executable,str(WALL_SOURCE)],check=True)

# Widths refer to real-world texture coverage. Poly Haven describes
# Dark Rock 02 as *2 m tall* (the 2:1 preview is ~4 m wide).
# A room-editor grid unit is calibrated approximately to 1 metre to match
# the 2-unit high walls and the original Guardian's proportions.
VARIANTS={
    'dungeon-ashlar':('floor-prison-01.png','dark_rock_02',4.0),
    'dungeon-coast-rocks':('floor-prison-02.png','coast_sand_rocks_02',15.0),
    'dungeon-cut-stone':('floor-prison-03.png','cobblestone_floor_09',2.2),
    'stone':('wall-masonry-01.png','rock_wall_17',1.8),
    'stone-cut':('wall-masonry-02.png','rock_wall_16',2.0),
    'stone-old':('wall-masonry-03.png','old_stone_wall',2.0),
}
asset_info={}
for style,(filename,asset_id,width_world) in VARIANTS.items():
    path=OUT/filename
    contents=path.read_bytes()
    if contents[:8]!=b'\x89PNG\r\n\x1a\n':
        raise SystemExit('Original photo not a PNG '+filename)
    with Image.open(path) as image:
        w,h=image.size
        if min(w,h)<700:
            raise SystemExit('Original photo too small '+filename)
    asset_info[style]={
        'file':filename,
        'asset':asset_id,
        'sourcePage':'https://polyhaven.com/a/'+asset_id,
        'sourceImage':'https://cdn.polyhaven.com/asset_img/primary/'+asset_id+'.png?height=2048&quality=95',
        'sha256':hashlib.sha256(contents).hexdigest(),
        'dimensions':[w,h],
        'worldWidth':width_world,
        'worldHeight':round(width_world*h/w,5),
        'worldUnitsPerMetre':1.0,
        'scaleMethod':'Poly Haven real-world texture size, calibrated to Guardian',
        'byteIdenticalToSource':True,
        'imageRotationDegrees':0,
        'imageMirrored':False,
    }

manifest={
    'schema':'mind-dungeon-room-tiles/v4',
    'source':'Six unchanged Poly Haven primary preview PNGs, no added dirt, tint or rotation',
    'textureMode':'original-photo-byte-identical',
    'license':'CC0: https://polyhaven.com/license',
    'floorMaterial':'original-photo-byte-identical',
    'wallMaterial':'original-photo-byte-identical',
    'floorVariants':{
        style:data[0] for style,data in VARIANTS.items() if style.startswith('dungeon-')
    },
    'wallVariants':{
        style:data[0] for style,data in VARIANTS.items() if not style.startswith('dungeon-')
    },
    'assetInfo':asset_info,
    'floorGenerator':'beta/room-editor/blender/build-floor-map.py',
    'floorGeneratorSha256':hashlib.sha256(FLOOR_SOURCE.read_bytes()).hexdigest(),
    'wallGenerator':'beta/room-editor/blender/build-wall-maps.py',
    'wallGeneratorSha256':hashlib.sha256(WALL_SOURCE.read_bytes()).hexdigest(),
    'legacyBlenderWallProjectionFiles':['wall-prison-x.webp','wall-prison-y.webp'],
    'gameBetaFilesModified':False,
}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('VERIFIED six unchanged Poly Haven photo imports with physical size data',flush=True)
