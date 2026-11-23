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
# Baked photographic maps are RGB JPEGs except the original floor WebP.
# Keep three existing *.webp files so the isolated existing editor-only CI
# assertion stays valid. Never alter the main game's CI/workflows.
floor_source=SOURCE.parent/'build-floor-map.py'
wall_source=SOURCE.parent/'build-wall-maps.py'
subprocess.run([sys.executable,str(floor_source),'--variant','dirt'],check=True)
subprocess.run([sys.executable,str(floor_source),'--variant','cut-stone'],check=True)
subprocess.run([sys.executable,str(wall_source)],check=True)
for name,dimensions in (
    ('floor-prison-01.webp',(4096,4096)),
    ('floor-prison-02.jpg',(4096,4096)),
    ('wall-masonry-01.jpg',(4096,1024)),
    ('wall-masonry-02.jpg',(4096,1024))):
    with Image.open(OUT/name) as atlas:
        if atlas.size!=dimensions:raise SystemExit('Wrong photobaked dimensions: '+name)
manifest={
 'schema':'mind-dungeon-room-tiles/v2',
 'source':'Blender wall meshes; two photo floors and two photo medieval-wall maps (Poly Haven CC0)',
 'floorMaterial':'photoreal-scanned-cc0',
 'floorVariants':{'dungeon-ashlar':'floor-prison-01.webp','dungeon-cut-stone':'floor-prison-02.jpg'},
 'wallMaterial':'photoreal-scanned-cc0',
 'wallVariants':{'stone':'wall-masonry-01.jpg','stone-cut':'wall-masonry-02.jpg'},
 'wallPhotoWorldDimensions':[32,2],
 'wallPhotoPixelDimensions':[4096,1024],
 'wallGenerator':'beta/room-editor/blender/build-wall-maps.py',
 'wallGeneratorSha256':hashlib.sha256(wall_source.read_bytes()).hexdigest(),
 'wallSources':['medieval_wall_02','stone_block_wall'],
 'floorSources':['monastery_stone_floor','stone_floor','rock_embedded_floor','rectangular_paving','stone_tiles','cobblestone_floor_02'],
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
 'art':{'floor':'floor-prison-01.webp','floorCut':'floor-prison-02.jpg','wallRough':'wall-masonry-01.jpg','wallCut':'wall-masonry-02.jpg','floorUv':'world-orthographic-32x32-center-crop','wallStyle':'quarried-prison-stone',
        'wallX':'wall-prison-x.webp','wallY':'wall-prison-y.webp'}
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified TWO 4096px photographed floors, TWO photographed medieval wall facades and TWO Blender wall projections',flush=True)
