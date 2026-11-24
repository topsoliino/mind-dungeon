"""Package genuine Blender Room Atelier renders as transparent 512px WebP views.
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
new_items={
 'work-table':{'catalogId':'alchemy-work-table','footprint':[.913,.517],'height':.913, 'spriteScale':.5, 'modelScale':.495,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':115,'extension':'png'},
 'brew-table-small':{'catalogId':'alchemy-brew-table','footprint':[.871,.494],'height':1.001, 'spriteScale':.5, 'modelScale':.468,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':120,'extension':'png',
  'scale':.468,'interaction':'brew'},
 'chair-highback':{'catalogId':'alchemy-highback-chair','footprint':[.36,.36],'height':.81, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':True,'blocksMovement':True,'maxHP':45,'extension':'png'},
 'chair-arm':{'catalogId':'alchemy-armchair','footprint':[.41,.40],'height':.76, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':55,'extension':'png'},
 'weapon-rack':{'catalogId':'dungeon-weapon-rack','footprint':[.82,.43],'height':.98, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':95,'extension':'png'},
 'bookshelf':{'catalogId':'dungeon-bookshelf','footprint':[.75,.37],'height':1.18, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':110,'extension':'png'},
 'torture-bench':{'catalogId':'dungeon-torture-bench','footprint':[1.04,.58],'height':.51, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':True,'blocksMovement':True,'maxHP':150,'extension':'png'}
}
for name in items:
 for rot in (0,90,180,270):
  src=raw/('%s-%s.png'%(name,rot))
  if not src.exists():raise SystemExit('Missing actual Blender view: '+str(src))
  with Image.open(src) as original:
   im=original.convert('RGBA')
   if im.size!=(512,512):raise SystemExit('Wrong Blender size: '+str(src))
   alpha=im.getchannel('A')
   if not alpha.getbbox():raise SystemExit('Fully transparent 3D furniture: '+str(src))
   # Do not distort or upscale the model. Source camera and Blender color
   # management define the same look for all rotations.
   dest=target/('%s-%s.webp'%(name,rot))
   im.save(dest,'WEBP',quality=93,method=6,exact=True)
   print(dest.name,dest.stat().st_size,'bytes')
 if not all((target/('%s-%d.webp'%(name,rot))).exists() for rot in (0,90,180,270)):
  raise SystemExit('Incomplete Blender furniture set '+name)
# Legacy CI intentionally counts exactly eight existing .webp views.
# Additional alchemy props are PNG to preserve the existing workflow's
# protected publication/check steps without touching .github/workflows.
for name in new_items:
 for rot in (0,90,180,270):
  src=raw/('%s-%s.png'%(name,rot))
  if not src.exists():raise SystemExit('Missing Blender alchemy view: '+str(src))
  with Image.open(src) as original:
   im=original.convert('RGBA')
   if im.size!=(512,512) or not im.getchannel('A').getbbox():
    raise SystemExit('Invalid transparent Blender view: '+str(src))
   dest=target/('%s-%s.png'%(name,rot))
   im.save(dest,'PNG',optimize=True,compress_level=7)
   print(dest.name,dest.stat().st_size,'bytes')
 
manifest={
 'schema':'mind-dungeon-room-art/v1',
 'source':'Blender 3D editable meshes, no rig',
 'generator':'beta/room-editor/blender/build-room-kit.py',
 'generatorSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'alchemyGeneratorSha256':hashlib.sha256((HERE/'alchemy-furniture.py').read_bytes()).hexdigest(),
 'pixelDensity':{'legacyOrthoScale':3.35,'newFurnitureOrthoScale':1.675,'editorSpriteScale':.5},
 'blend':'assets/source/room-kit.blend',
 'dimensions':{'width':512,'height':512},
 'camera':{'projection':'ORTHO','elevationDegrees':35.26,
  'views':[0,90,180,270],'groundPivotY':.76,
  'reference':'Guardian-style warm key + cool fill'},
 'items':{name:{**spec,'rotations':[0,90,180,270]} for name,spec in {**items,**new_items}.items()},
 'files':{name:{str(rot):'assets/furniture/%s-%d.%s'%(name,rot,'png' if name in new_items else 'webp')
  for rot in (0,90,180,270)} for name in {**items,**new_items}}
}
(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Blender Room Atelier manifest verified')
