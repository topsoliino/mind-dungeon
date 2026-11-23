"""Build 9 perspective-free UV-aligned wall-strip atlases, 30m wide and 2m tall.

Only UV-ready original Diffuse JPGs, never Poly Haven primary preview images.
Bakes nine softly phase-varied repeat-free wall strips, with all source brick
rows remaining horizontal in wall (u,vertical-height) coordinates. No extra
grout, tint, fake shadow or tilted 'floor-on-wall' material.
"""
from pathlib import Path
import hashlib
import random
from PIL import Image,ImageFilter

OUT=Path(__file__).resolve().parents[1]/"assets"/"tiles"
W,H=4096,768
WORLD_W,WORLD_H=30.0,2.0
SPECS=(
 ("wall-albedo-01.jpg","wall-atlas-01.jpg",1.8,49101),
 ("wall-albedo-02.jpg","wall-atlas-02.jpg",2.0,59219),
 ("wall-albedo-03.jpg","wall-atlas-03.jpg",2.0,61397),
 ("wall-albedo-04.jpg","wall-atlas-04.jpg",1.6,72651),
 ("wall-albedo-05.jpg","wall-atlas-05.jpg",2.0,83107),
 ("wall-albedo-06.jpg","wall-atlas-06.jpg",1.8,94133),
 ("wall-albedo-07.jpg","wall-atlas-07.jpg",1.9,105599),
 ("wall-albedo-08.jpg","wall-atlas-08.jpg",2.5,113867),
 ("wall-albedo-09.jpg","wall-atlas-09.jpg",2.0,123733),
)

def periodic(image,dx,dy):
    w,h=image.size
    surface=Image.new("RGB",(W,H))
    for yy in range(-(dy%h),H,h):
        for xx in range(-(dx%w),W,w):
            surface.paste(image,(xx,yy))
    return surface

def fade_mask(rng,grid_x,grid_y):
    raw=Image.frombytes("L",(grid_x,grid_y),
                        bytes(rng.randrange(256) for _ in range(grid_x*grid_y)))
    m=raw.resize((W,H),Image.Resampling.BICUBIC)
    table=[max(0,min(255,int((x-107)*6))) for x in range(256)]
    return m.point(table).filter(ImageFilter.GaussianBlur(20))

def bake(original,name,world_width,seed):
    with Image.open(OUT/original) as scan:
        if scan.format!="JPEG":
            raise RuntimeError("Not UV-ready Diffuse source: "+original)
        source=scan.convert("RGB")
        unit_width=round(W*world_width/WORLD_W)
        world_height=world_width*source.height/source.width
        unit_height=round(H*world_height/WORLD_H)
        tile=source.resize((unit_width,unit_height),Image.Resampling.LANCZOS)
    rng=random.Random(seed)
    base=periodic(tile,0,0)
    shifted=periodic(tile,round(unit_width*.38),round(unit_height*.62))
    base.paste(shifted,(0,0),fade_mask(rng,13,5))
    shifted=periodic(tile,round(unit_width*.72),round(unit_height*.27))
    base.paste(shifted,(0,0),fade_mask(rng,9,3))
    out=OUT/name
    base.save(out,"JPEG",quality=91,subsampling=0,optimize=True)
    if Image.open(out).size!=(W,H):
        raise RuntimeError("Unexpected wall atlas dimensions: "+name)
    print("UV-ALIGNED WALL STRIP",out,out.stat().st_size,flush=True)
    return {
        "file":name,"sha256":hashlib.sha256(out.read_bytes()).hexdigest(),
        "dimensions":[W,H],"worldWidth":WORLD_W,"worldHeight":WORLD_H,
        "source":original,"mode":"world-aligned-three-phase-diffuse"
    }

def build():
    return {filename:bake(filename,atlas,width,seed)
            for filename,atlas,width,seed in SPECS}

if __name__=="__main__":
    build()
