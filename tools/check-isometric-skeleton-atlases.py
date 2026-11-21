"""Inspect the Blender-derived skeleton atlases for layout and animation regression.

Requires Pillow. Run: python tools/check-isometric-skeleton-atlases.py
This is an asset integrity test, not a substitute for reviewing actual
screenshots from the interactive WebGL/Phaser renderer.
"""
from pathlib import Path
from PIL import Image, ImageChops

ASSETS=Path(__file__).resolve().parent.parent/'beta'/'art'/'skeleton'
CELL=96
CLIPS={'idle':6,'run':10,'strike':10,'shoot':10,'death':10}
assert (ASSETS/'skeleton.blend').read_bytes().startswith(b'BLENDER'), 'Editable Blender armature missing'

for kit in ('sabre','bow'):
    actions=('idle','run','strike' if kit=='sabre' else 'shoot','death')
    for clip in actions:
        filepath=ASSETS/f'{kit}-{clip}.webp'
        with Image.open(filepath) as atlas:
            atlas.load()
            expected=(CELL*CLIPS[clip],CELL*8)
            assert atlas.size==expected, f'{filepath}: {atlas.size}, expected {expected}'
            assert 'A' in atlas.getbands(),f'{filepath}: no alpha channel'
            assert atlas.getchannel('A').getextrema()[0]==0, f'{filepath}: background opaque'
            for row in range(8):
                frames=[
                    atlas.crop((i*CELL,row*CELL,(i+1)*CELL,(row+1)*CELL)).convert('RGBA')
                    for i in range(CLIPS[clip])
                ]
                for i,frame in enumerate(frames):
                    alpha=frame.getchannel('A')
                    bounds=alpha.getbbox()
                    assert bounds is not None, f'{filepath}: empty view {row}, frame {i}'
                    assert bounds[0]>0 and bounds[2]<CELL, f'{filepath}: horizontal clipping in view {row}, frame {i}'
                if clip!='idle':
                    # In particular, the death rig must really break into a
                    # new pose rather than merely reusing the standing sprite.
                    changed=any(ImageChops.difference(frames[0],frame).getbbox()
                                for frame in frames[1:])
                    assert changed, f'{filepath}: static {clip} animation at facing {row}'
            print(f'{filepath.name}: {expected[0]}x{expected[1]}, 8 facings, '
                  f'{CLIPS[clip]} keyed render frames, alpha verified')

print('Skeleton Blender rigs, transparent directional atlas sheets and keyed motion: OK')
