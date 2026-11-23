"""Build eight non-grid-repeating 4096px room FLOOR atlases from an original diffuse.

NOT a primary presentation preview. Source diffuse JPG is imported unchanged.
We retain the diffuse as an independent original material; this script produces
a derived runtime 30m x 30m atlas that breaks periodic copies via 3 spatially
shifted UV samples and smooth, low-frequency selection masks. No fake stones,
dark color overlays, artificial stains, shadows or perspective baked in.

The atlas is world-aligned, preserving masonry direction and true metres/stone.
Only creates JPEG files under beta/room-editor/assets/tiles (CI compatible).
"""
from pathlib import Path
import hashlib
import math
import random
from PIL import Image,ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"tiles"
SIZE=4096
WORLD=30.0
SPECS=(
 ("floor-albedo-01.jpg","floor-atlas-01.jpg",2.0,11003),
 ("floor-albedo-02.jpg","floor-atlas-02.jpg",15.0,22867),
 ("floor-albedo-03.jpg","floor-atlas-03.jpg",2.2,33947),
 ("floor-albedo-04.jpg","floor-atlas-04.jpg",1.5,42171),
 ("floor-albedo-05.jpg","floor-atlas-05.jpg",2.4,52843),
 ("floor-albedo-06.jpg","floor-atlas-06.jpg",1.8,62239),
 ("floor-albedo-07.jpg","floor-atlas-07.jpg",2.0,71479),
 ("floor-albedo-08.jpg","floor-atlas-08.jpg",1.3,80627),
)

def periodic(image: Image.Image, dx: int, dy: int):
    w,h=image.size
    canvas=Image.new("RGB",(SIZE,SIZE))
    x0=-(dx%w)
    y0=-(dy%h)
    for y in range(y0,SIZE,h):
        for x in range(x0,SIZE,w):
            canvas.paste(image,(x,y))
    return canvas

def macro_mask(rng: random.Random, density: int):
    small=Image.frombytes("L",(density,density),
                          bytes(rng.randrange(256) for _ in range(density*density)))
    smooth=small.resize((SIZE,SIZE),Image.Resampling.BICUBIC)
    # Mostly whole original stones: mixtures only close to transition zones.
    table=[max(0,min(255,round((v-108)*6.0))) for v in range(256)]
    return smooth.point(table).filter(ImageFilter.GaussianBlur(27))

def bake(original: str,atlas: str,real_width: float,seed: int):
    with Image.open(OUT/original) as source:
        if source.format!="JPEG":
            raise ValueError("Expected authentic original diffuse JPEG: "+original)
        source=source.convert("RGB")
        width=round(SIZE*real_width/WORLD)
        height=round(width*source.height/source.width)
        if width<120 or height<120:
            raise ValueError("Texture scale too coarse for "+original)
        tile=source.resize((width,height),Image.Resampling.LANCZOS)
    # All variants preserve original UV direction; ONLY phase shifts change.
    rng=random.Random(seed)
    base=periodic(tile,0,0)
    b=periodic(tile,int(width*.39),int(height*.63))
    c=periodic(tile,int(width*.73),int(height*.21))
    # Macro selection breaks the persistent, very obvious cobblestone grid.
    base.paste(b,(0,0),macro_mask(rng,17))
    base.paste(c,(0,0),macro_mask(rng,13))
    del b,c
    target=OUT/atlas
    base.save(target,"JPEG",quality=90,subsampling=0,optimize=True)
    with Image.open(target) as verify:
        if verify.size!=(SIZE,SIZE):
            raise RuntimeError("Bad atlas dimensions: "+atlas)
    print("FLOOR ATLAS",original,atlas,target.stat().st_size,
          "original metres per repetition",real_width,
          "atlas covers 30m x 30m without repeated macro grid",flush=True)
    return {"file":atlas,"sha256":hashlib.sha256(target.read_bytes()).hexdigest(),
            "dimensions":[SIZE,SIZE],"worldWidth":WORLD,"worldHeight":WORLD,
            "source":original,"mode":"stochastic-three-phase-UV-blend-no-color-filter"}

def build():
    return {original:bake(original,atlas,width,seed)
            for original,atlas,width,seed in SPECS}

if __name__=="__main__":
    OUT.mkdir(parents=True,exist_ok=True)
    build()
