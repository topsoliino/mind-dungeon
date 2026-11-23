"""Bake two PHOTOGRAPHIC medieval stone wall maps (32x2 world units).

Generates wall-masonry-01.jpg (rough dark medieval stonework) and
wall-masonry-02.jpg (massive squared fortress blocks). Both use CC0
photographs by Poly Haven; wall geometry stays editor-side and the photos
are projected continuously across wall segments at fixed world scale.
No changes to the main game's walls or materials.
"""
from __future__ import annotations

import argparse
from io import BytesIO
import json
from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps
from importlib.machinery import SourceFileLoader

HERE=Path(__file__).resolve().parent
floor=SourceFileLoader("room_atelier_floor_scan",str(HERE/"build-floor-map.py")).load_module()
OUT=HERE.parent/"assets"/"tiles"
WIDTH,HEIGHT=4096,1024
STYLES=(
    ("medieval_wall_02","wall-masonry-01.jpg",83217),
    ("stone_block_wall","wall-masonry-02.jpg",15591),
)
RESAMPLE=Image.Resampling.LANCZOS


def source_image(asset, source_dir=None):
    if source_dir:
        file=next((source_dir/(asset+ext) for ext in (".jpg",".jpeg",".png")
                   if (source_dir/(asset+ext)).is_file()),None)
        if file is None:raise FileNotFoundError(f"Missing photo: {asset}")
        data=file.read_bytes()
    else:
        catalog=json.loads(floor.fetch("https://api.polyhaven.com/files/"+asset))
        url=floor.resolve_diffuse_file(catalog)
        from urllib.parse import urlparse
        if urlparse(url).hostname not in ("dl.polyhaven.org","cdn.polyhaven.org"):
            raise ValueError("Unexpected photo host: "+url)
        data=floor.fetch(url)
    with Image.open(BytesIO(data)) as img:
        img.load()
        if min(img.size)<800:raise ValueError("Wall source is not detailed enough: "+asset)
        return ImageOps.exif_transpose(img).convert("RGB")


def crop_region(source, r):
    w,h=source.size
    length=min(w,h)
    side=r.randrange(max(750,int(length*.48)),length+1)
    sx=r.randrange(0,w-side+1)
    sy=r.randrange(0,h-side+1)
    crop=source.crop((sx,sy,sx+side,sy+side))
    if r.random()<.5:crop=ImageOps.mirror(crop)
    return crop.resize((1280,HEIGHT),RESAMPLE)


def soft_horizontal_mask():
    # Keep full height: the wall top and bottom have no horizontal seam.
    mask=Image.new("L",(1280,HEIGHT),0)
    d=ImageDraw.Draw(mask)
    d.rectangle((180,0,1100,HEIGHT),fill=255)
    return mask.filter(ImageFilter.GaussianBlur(90))


def bake(asset, name, seed, source_dir=None):
    randomizer=random.Random(seed)
    photo=source_image(asset,source_dir)
    result=ImageOps.fit(photo,(WIDTH,HEIGHT),RESAMPLE)
    mask=soft_horizontal_mask()
    # The photographic facade is long enough to crop per wall unit rather
    # than repeating one tiny brick texture over every 1-unit wall segment.
    for start in range(-170,WIDTH,880):
        region=crop_region(photo,randomizer)
        result.paste(region,(start,0),mask)

    result=ImageEnhance.Color(result).enhance(.66 if "01" in name else .61)
    result=ImageEnhance.Contrast(result).enhance(1.18)
    result=ImageEnhance.Brightness(result).enhance(.71 if "01" in name else .77)

    # Vertical seepage and soot stains on the original photographed stones:
    # translucent irregular, blurred masks only; no fake stone geometries.
    stain=Image.new("L",(WIDTH,HEIGHT),0)
    d=ImageDraw.Draw(stain)
    for i in range(110):
        x=randomizer.randrange(WIDTH)
        top=randomizer.randrange(-100,HEIGHT//2)
        height=randomizer.randrange(80,700)
        width=randomizer.randrange(10,95)
        d.ellipse((x-width,top,x+width,top+height),
                  fill=randomizer.randrange(14,100))
    stain=stain.filter(ImageFilter.GaussianBlur(52))
    result=Image.composite(Image.new("RGB",(WIDTH,HEIGHT),(24,28,31)),result,stain)
    # Darker moisture close to the foot of the wall, adjusted gently enough
    # to keep the PHOTO's genuine stone relief and mortar readable.
    grad=Image.new("L",(1,HEIGHT))
    grad.putdata([int(min(42,max(0,(j/HEIGHT-.58)*88))) for j in range(HEIGHT)])
    grad=grad.resize((WIDTH,HEIGHT))
    result=Image.composite(Image.new("RGB",(WIDTH,HEIGHT),(25,27,29)),result,grad)

    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/name
    result.save(path,format="JPEG",quality=91,optimize=True,subsampling=0)
    if path.stat().st_size<130_000:raise RuntimeError("Wall photo unusually small: "+name)
    with Image.open(path) as check:
        if check.size!=(WIDTH,HEIGHT):raise RuntimeError("Bad wall output size")
    print("BAKED PHOTOGRAPHIC WALL",asset,name,path.stat().st_size,flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source-dir",type=Path,default=None)
    args=parser.parse_args()
    for config in STYLES:bake(*config,args.source_dir)
