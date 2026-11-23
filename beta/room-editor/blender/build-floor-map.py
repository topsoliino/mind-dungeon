"""Build a photographic dark-medieval dungeon floor for the standalone room editor.

One 4096x4096 baked RGB WebP, covering exactly 32x32 room-grid units.
Small rooms crop the original at unchanged scale (not tiles or repeated runtime art).
The base uses real scanned, CC0 photographic albedo by Poly Haven, *not*
polygons pretending to be natural stone. Asset URLs are resolved through the
documented public API during the asset build; the browser never calls the API.

Source assets:
 https://polyhaven.com/a/monastery_stone_floor
 https://polyhaven.com/a/stone_floor
 https://polyhaven.com/a/rock_embedded_floor
All Poly Haven assets are CC0: https://polyhaven.com/license
API: https://polyhaven.com/our-api
"""
from __future__ import annotations

import argparse
from io import BytesIO
import json
from pathlib import Path
import random
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

SIZE = 4096
WORLD = 32
SEED = 0xDA7A6E
FLOOR_VARIANTS = {
    "dirt": ("monastery_stone_floor", "stone_floor", "rock_embedded_floor"),
    "cut-stone": ("rectangular_paving", "stone_tiles", "cobblestone_floor_02"),
}
ASSETS = FLOOR_VARIANTS["dirt"]
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "tiles" / "floor-prison-01.webp"
USER_AGENT = "MindDungeonRoomAtelier/2.0 (CC0 art build; https://github.com/topsoliino/mind-dungeon)"
rng = random.Random(SEED)
RESAMPLE = Image.Resampling.LANCZOS


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT,
                                    "Accept": "application/json,image/jpeg,image/png,*/*"})
    with urlopen(request, timeout=45) as response:
        return response.read()


def resolve_diffuse_file(manifest: dict) -> str:
    """Accept current and earlier Poly Haven /files/<id> map variants."""
    preferred = ("Diffuse", "diffuse", "diff", "Color", "color", "BaseColor", "Albedo", "albedo")
    for key in preferred:
        if key not in manifest:
            continue
        data = manifest[key]
        if isinstance(data, dict):
            for resolution in ("4k", "2k", "1k"):
                entries = data.get(resolution, {})
                if not isinstance(entries, dict):
                    continue
                for fmt in ("jpg", "jpeg", "png"):
                    item = entries.get(fmt, {})
                    if isinstance(item, dict) and item.get("url"):
                        return item["url"]
    # Newer APIs occasionally use different case/keys.
    candidates = []
    def recurse(obj, keys=()):
        if isinstance(obj, dict):
            if isinstance(obj.get("url"), str):
                url = obj["url"]
                ident = " ".join(keys).lower() + " " + url.lower()
                if ("diff" in ident or "albedo" in ident or "basecolor" in ident) \
                        and urlparse(url).path.lower().endswith((".jpg", ".jpeg", ".png")):
                    score = (3 if "4k" in ident else 2 if "2k" in ident else 1 if "1k" in ident else 0)
                    candidates.append((score,url))
            for key,value in obj.items():
                recurse(value,keys+(str(key),))
    recurse(manifest)
    if not candidates:
        raise RuntimeError("No photographic diffuse JPG/PNG map found in Poly Haven files")
    return max(candidates,key=lambda item:item[0])[1]


def load_photographs(source_dir: Path | None) -> dict[str, Image.Image]:
    images = {}
    for asset in ASSETS:
        if source_dir:
            candidates = [source_dir/(asset+ext) for ext in (".jpg",".jpeg",".png")]
            filename = next((p for p in candidates if p.is_file()),None)
            if filename is None:
                raise FileNotFoundError(f"Offline test source absent: {asset}")
            raw = filename.read_bytes()
        else:
            catalog = json.loads(fetch("https://api.polyhaven.com/files/"+asset))
            file_url = resolve_diffuse_file(catalog)
            if not urlparse(file_url).hostname in ("dl.polyhaven.org","cdn.polyhaven.org"):
                raise RuntimeError("Unexpected Poly Haven asset host: "+file_url)
            raw = fetch(file_url)
        with Image.open(BytesIO(raw)) as source:
            source.load()
            if min(source.size) < 800:
                raise RuntimeError(f"Photographic source too small: {asset} {source.size}")
            images[asset] = ImageOps.exif_transpose(source).convert("RGB")
        print("CC0 photo ready:",asset,images[asset].size,flush=True)
    return images


def photo_crop(image: Image.Image, side_px: int) -> Image.Image:
    """Natural-scale scan excerpts: no newly drawn or artificially outlined stones."""
    w,h=image.size
    longest = min(w,h)
    crop_side = rng.randrange(max(512,int(longest*.53)),longest+1)
    x = rng.randrange(0,w-crop_side+1)
    y = rng.randrange(0,h-crop_side+1)
    result=image.crop((x,y,x+crop_side,y+crop_side))
    result=result.transpose(rng.choice((Image.Transpose.ROTATE_90,
                                        Image.Transpose.ROTATE_180,
                                        Image.Transpose.ROTATE_270,
                                        Image.Transpose.FLIP_LEFT_RIGHT)))
    return result.resize((side_px,side_px),RESAMPLE)


def feather_mask(side: int, edge: int) -> Image.Image:
    """Blend photo patches softly; no checkered straight edges."""
    mask=Image.new("L",(side,side))
    draw=ImageDraw.Draw(mask)
    draw.rectangle((edge,edge,side-edge,side-edge),fill=255)
    return mask.filter(ImageFilter.GaussianBlur(edge*.60))


def fractal_noise(size: int, levels: tuple[int,...]) -> Image.Image:
    """Correlated natural discoloration; no regular tiling or tiled material."""
    output=Image.new("L",(size,size),0)
    total=0
    for n in levels:
        pixels=Image.frombytes("L",(n,n),rng.randbytes(n*n))
        layer=pixels.resize((size,size),Image.Resampling.BICUBIC)
        weight=max(1,int(80/(1+levels.index(n))))
        output=ImageChops.add(output,layer.point(lambda x,w=weight:x*w//255),scale=1)
        total+=weight
    return ImageEnhance.Contrast(output).enhance(1.4)


def build_photo_atlas(images: dict[str,Image.Image]) -> Image.Image:
    # Start with actual scanned stone, not noise. Every overlay remains photographic.
    background=photo_crop(images[ASSETS[0]],SIZE)
    background=ImageEnhance.Color(background).enhance(.75)

    # Different natural-scale scan excerpts, rotated and heavily overlapped;
    # the boundary softness removes square stamps and visible tile repetition.
    patch_size=1152
    stride=704
    mask=feather_mask(patch_size,180)
    origins=list(range(-352,SIZE,stride))
    for y in origins:
        for x in origins:
            asset=rng.choices(ASSETS,weights=(.66,.20,.14),k=1)[0]
            patch=photo_crop(images[asset],patch_size)
            patch=ImageEnhance.Color(patch).enhance(.78)
            patch=ImageEnhance.Brightness(patch).enhance(rng.uniform(.80,1.03))
            xx=x+rng.randrange(-90,91)
            yy=y+rng.randrange(-90,91)
            background.paste(patch,(xx,yy),mask)
    return background


def age_and_weather(image: Image.Image, cut_stone: bool=False) -> Image.Image:
    # Real photographed rock + compacted dirt gets cooler shadows, low chroma
    # and uneven surface dampness. No drawn stone polygons or regular seams.
    image=ImageEnhance.Color(image).enhance(.68)
    image=ImageEnhance.Contrast(image).enhance(1.22)
    image=ImageEnhance.Brightness(image).enhance(.77 if cut_stone else .70)

    macro=fractal_noise(SIZE,(14,48,128,350))
    grime=ImageOps.autocontrast(macro,cutoff=(6,5))
    grime_mask=grime.point(lambda v:max(0,min(58 if cut_stone else 110,int((125-v)*(0.66 if cut_stone else 1.30)))))
    image=Image.composite(Image.new("RGB",(SIZE,SIZE),(29,27,26)),image,grime_mask)

    # Photo-grain based microvariation is subdued to preserve genuine scanned
    # stone detail, while moss, moisture and sediment stay irregularly distributed.
    wet=Image.new("L",(SIZE,SIZE))
    draw=ImageDraw.Draw(wet)
    for i in range(45 if cut_stone else 135):
        x=rng.randrange(SIZE);y=rng.randrange(SIZE)
        rx=rng.randrange(35,300);ry=rng.randrange(30,190)
        opacity=rng.randrange(12,55 if cut_stone else 115)
        draw.ellipse((x-rx,y-ry,x+rx,y+ry),fill=opacity)
    wet=wet.filter(ImageFilter.GaussianBlur(85))
    noise=fractal_noise(SIZE,(48,128,320))
    wet=ImageChops.multiply(wet,ImageOps.autocontrast(noise))
    wet=ImageEnhance.Contrast(wet).enhance(1.5)
    image=Image.composite(Image.new("RGB",(SIZE,SIZE),(26,31,34)),image,wet)

    # Aging near random areas: a restrained mineral wash, not painted ellipses.
    silt_mask=ImageOps.invert(fractal_noise(SIZE,(17,70,210)))
    silt_mask=silt_mask.point(lambda v:max(0,min(45,(v-110)//2)))
    image=Image.composite(Image.new("RGB",(SIZE,SIZE),(71,60,46)),image,silt_mask)
    return image


def build(output: Path, source_dir: Path | None, variant: str="dirt"):
    global ASSETS, rng
    ASSETS = FLOOR_VARIANTS[variant]
    rng = random.Random(SEED + (709 if variant=="cut-stone" else 0))
    images=load_photographs(source_dir)
    print("Composing one 4096px photobased stone/dirt floor…",flush=True)
    image=age_and_weather(build_photo_atlas(images), cut_stone=variant=="cut-stone")
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.suffix.lower()==".jpg":
        image.save(output,format="JPEG",quality=91,subsampling=0,optimize=True)
    else:
        image.save(output,format="WEBP",quality=88,method=5)
    if output.stat().st_size<350_000:
        raise RuntimeError("Floor image unusually tiny: photobased output missing?")
    with Image.open(output) as verify:
        assert verify.size==(SIZE,SIZE) and verify.mode=="RGB"
    print(f"REAL PHOTOGRAPHIC DUNGEON FLOOR: {output} ({output.stat().st_size} bytes)",flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source-dir",type=Path,default=None,
                        help="Optional local JPG copies for offline validation")
    parser.add_argument("--variant",choices=tuple(FLOOR_VARIANTS),default="dirt")
    parser.add_argument("--output",type=Path,default=None)
    args=parser.parse_args()
    build(args.output or (DEST if args.variant=="dirt" else DEST.with_name("floor-prison-02.jpg")),args.source_dir,args.variant)
