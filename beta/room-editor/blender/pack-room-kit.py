"""Package genuine Blender Room Atelier renders as transparent 384px WebP views.
Usage: python3 beta/room-editor/blender/pack-room-kit.py /tmp/md-room-raw
"""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

HERE=Path(__file__).resolve().parent
ASSETS=HERE.parent/'assets'
SOURCE=HERE/'build-room-kit.py'
raw=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/md-room-raw')
target=ASSETS/'furniture'
target.mkdir(parents=True,exist_ok=True)
items={
 'table':{'catalogId':'prison-table','footprint':[1.85,1.05],'height':.94,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':110},
 'chair':{'catalogId':'prison-chair','footprint':[.78,.79],'height':1.28,
  'destroyable':True,'vaultable':True,'blocksMovement':True,'maxHP':35}
}
for name in items:
 for rot in (0,90,180,270):
  src=raw/('%s-%s.png'%(name,rot))
  if not src.exists():raise SystemExit('Missing actual Blender view: '+str(src))
  with Image.open(src) as original:
   im=original.convert('RGBA')
   if im.size!=(384,384):raise SystemExit('Wrong Blender size: '+str(src))
   alpha=im.getchannel('A')
   if not alpha.getbbox():raise SystemExit('Fully transparent 3D furniture: '+str(src))
   # Do not distort or upscale the model. Source camera and Blender color
   # management define the same look for all rotations.
   dest=target/('%s-%s.webp'%(name,rot))
   im.save(dest,'WEBP',quality=93,method=6,exact=True)
   print(dest.name,dest.stat().st_size,'bytes')
 if not all((target/('%s-%d.webp'%(name,rot))).exists() for rot in (0,90,180,270)):
  raise SystemExit('Incomplete Blender furniture set '+name)
manifest={
 'schema':'mind-dungeon-room-art/v1',
 'source':'Blender 3D editable meshes, no rig',
 'generator':'beta/room-editor/blender/build-room-kit.py',
 'generatorSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'blend':'assets/source/room-kit.blend',
 'dimensions':{'width':384,'height':384},
 'camera':{'projection':'ORTHO','elevationDegrees':35.26,
  'views':[0,90,180,270],'groundPivotY':.76,
  'reference':'Guardian-style warm key + cool fill'},
 'items':items,
 'files':{name:{str(rot):'assets/furniture/%s-%d.webp'%(name,rot)
  for rot in (0,90,180,270)} for name in items}
}
(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Blender Room Atelier manifest verified')
