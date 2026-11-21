"""Blender rat asset contract: 32 views, true transparency and keyed motion.
Run: python tools/check-isometric-rat-atlases.py  (requires Pillow)
"""
from pathlib import Path
from PIL import Image, ImageChops

root=Path(__file__).resolve().parents[1]/"beta/art/rat"
clips={"idle":8,"run":10,"stalk":10,"jump":12,"bite":9,
       "combo":14,"dodge":10,"dodge-left":10,"death":14}
blend=(root/"rat.blend").read_bytes()
assert blend.startswith((b"BLENDER",b"\x28\xb5\x2f\xfd")), "Editable rat rig missing"
for clip,count in clips.items():
    path=root/(clip+".webp")
    with Image.open(path) as im:
        im.load()
        assert im.size==(96*count,96*32), f"{path}: wrong sheet size {im.size}"
        assert "A" in im.getbands(), f"{clip}: missing alpha"
        assert im.getchannel("A").getextrema()[0]==0, f"{clip}: no transparency"
        for row in range(32):
            frames=[im.crop((i*96,row*96,(i+1)*96,(row+1)*96)).convert("RGBA")
                    for i in range(count)]
            for i,frame in enumerate(frames):
                b=frame.getchannel("A").getbbox()
                assert b is not None, f"{clip} direction={row} frame={i}: invisible"
                assert b[0]>0 and b[2]<96 and b[1]>0 and b[3]<96, (
                    f"{clip} direction={row} frame={i}: clipped at sheet cell edge {b}")
            if clip!="idle":
                assert any(ImageChops.difference(frames[0].convert("RGB"),
                       frame.convert("RGB")).getbbox() for frame in frames[1:]), (
                       f"{clip} direction={row}: static")
        print(f"{clip}: {count} keyed frames x 32 true 3D directions, clean RGBA")
print("Editable Blender small-rat rig, all actions and atlas layout: OK")
