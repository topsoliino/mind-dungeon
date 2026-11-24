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
  'destroyable':True,'vaultable':True,'blocksMovement':True,'maxHP':150,'extension':'png'},
 'iron-cage':{'catalogId':'torture-iron-cage','footprint':[.79,.55],'height':1.20, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':140,'extension':'png'},
 'interrogation-chair':{'catalogId':'torture-interrogation-chair','footprint':[.44,.43],'height':.91, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':95,'extension':'png'},
 'tool-table':{'catalogId':'torture-tool-table','footprint':[.76,.45],'height':.76, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':100,'extension':'png'},
 'chain-wall':{'catalogId':'torture-chain-wall','footprint':[.78,.28],'height':1.05, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':160,'extension':'png'},
 'iron-maiden':{'catalogId':'torture-iron-maiden','footprint':[.55,.38],'height':1.28, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':180,'extension':'png'},
 'ember-brazier':{'catalogId':'torture-ember-brazier','footprint':[.48,.48],'height':.62, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':75,'extension':'png'},
 'pillory':{'catalogId':'torture-pillory','footprint':[.82,.43],'height':.95, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':90,'extension':'png'},
 'torture-wheel':{'catalogId':'torture-wheel','footprint':[.82,.50],'height':1.08, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':115,'extension':'png'},
 'prison-cage':{'catalogId':'torture-prison-cage','footprint':[.65,.57],'height':.65, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':110,'extension':'png'},
 'washbasin':{'catalogId':'torture-washbasin','footprint':[.78,.47],'height':.48, 'spriteScale':.5, 'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'maxHP':120,'extension':'png'},
 'floor-rubble':{'catalogId':'floor-rubble','footprint':[.75,.51],'height':.15,'spriteScale':.5,'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'blocksProjectiles':False,'maxHP':60,'extension':'png','category':'floor-clutter'},
 'floor-bones':{'catalogId':'floor-bones','footprint':[.76,.47],'height':.13,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-rug':{'catalogId':'floor-rug','footprint':[.82,.52],'height':.05,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-chains':{'catalogId':'floor-chains','footprint':[.82,.50],'height':.06,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-wood':{'catalogId':'floor-wood','footprint':[.86,.50],'height':.16,'spriteScale':.5,'modelScale':.45,
  'destroyable':True,'vaultable':False,'blocksMovement':True,'blocksProjectiles':False,'maxHP':45,'extension':'png','category':'floor-clutter'},
 'floor-moss':{'catalogId':'floor-moss','footprint':[.70,.46],'height':.10,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-scrolls':{'catalogId':'floor-scrolls','footprint':[.67,.44],'height':.09,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-puddles':{'catalogId':'floor-puddles','footprint':[.77,.55],'height':.03,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-pottery':{'catalogId':'floor-pottery','footprint':[.73,.46],'height':.17,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'},
 'floor-cloth':{'catalogId':'floor-cloth','footprint':[.71,.52],'height':.12,'spriteScale':.5,'modelScale':.45,
  'destroyable':False,'vaultable':False,'blocksMovement':False,'blocksProjectiles':False,'maxHP':0,'extension':'png','category':'floor-clutter'}
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
 
# True Blender/Cycles prison bar meshes have a head-on PBR surface render.
# They are projected onto the exact 1 x (1 or 2) metre isometric wall plane.
# Only two small PNGs are needed instead of 4 camera views per wall style.
wall_views={
 'bars-full':{'file':'prison-grille-full-front.png','height':2.0,'orthoScale':2.5},
 'bars-half':{'file':'prison-grille-half-front.png','height':1.0,'orthoScale':1.5}
}
wall_dir=ASSETS/'walls'
wall_dir.mkdir(parents=True,exist_ok=True)
for style,spec in wall_views.items():
 src=raw/spec['file']
 if not src.exists():
  raise SystemExit('Missing authentic Blender prison wall render: '+str(src))
 with Image.open(src) as original:
  rgba=original.convert('RGBA')
  if rgba.size!=(512,512) or not rgba.getchannel('A').getbbox():
   raise SystemExit('Invalid Blender dark prison iron grille: '+str(src))
  dest=wall_dir/spec['file']
  rgba.save(dest,'PNG',optimize=True,compress_level=7)
  print(dest.name,dest.stat().st_size,'bytes (wrought iron wall art)')

manifest={
 'schema':'mind-dungeon-room-art/v1',
 'source':'Blender 3D editable meshes, no rig',
 'generator':'beta/room-editor/blender/build-room-kit.py',
 'generatorSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'alchemyGeneratorSha256':hashlib.sha256((HERE/'alchemy-furniture.py').read_bytes()).hexdigest(),
 'tortureGeneratorSha256':hashlib.sha256((HERE/'torture-chamber-furniture.py').read_bytes()).hexdigest(),
 'floorGeneratorSha256':hashlib.sha256((HERE/'abandoned-floor-clutter.py').read_bytes()).hexdigest(),
 'prisonBarsGeneratorSha256':hashlib.sha256((HERE/'dungeon-prison-bars.py').read_bytes()).hexdigest(),
 'wallViews':{name:{**spec,'asset':'assets/walls/'+spec['file'],'projection':'front-orthographic-to-wall-plane'}
  for name,spec in wall_views.items()},
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
