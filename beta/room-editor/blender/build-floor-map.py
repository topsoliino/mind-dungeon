"""Fetch original UV-ready Poly Haven DIFFUSE/ALBEDO maps, never preview artwork.

The old 1600x800 "primary" pictures are presentation previews (not raw
flat UV textures). Projecting those onto walls/floors caused a second,
perspective-skewed copy of already visible stones. This importer requests
actual 2K diffuse JPG maps from https://api.polyhaven.com/files/<asset>.
The bytes are saved unchanged. The large nonrepeating floor atlases are
built separately from those maps; the original scan remains available.

Only beta/room-editor/** is written. Poly Haven assets are CC0.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path
import time
from urllib.parse import urlparse
from urllib.request import urlopen,Request
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"tiles"
USER_AGENT="MindDungeonRoomAtelier/5.0 (+https://github.com/topsoliino/mind-dungeon; CC0 scan import)"
FLOORS={
 "dungeon-ashlar":("dark_rock_02","floor-albedo-01.jpg"),
 "dungeon-coast-rocks":("coast_sand_rocks_02","floor-albedo-02.jpg"),
 "dungeon-cut-stone":("cobblestone_floor_09","floor-albedo-03.jpg"),
}

def fetch(url: str) -> bytes:
    r=Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/json,image/jpeg,*/*"})
    with urlopen(r,timeout=75) as f:
        return f.read()

def diffuse_url(files: dict) -> str:
    """Resolve a Poly Haven texture Diffuse map, rejecting preview thumbnails."""
    for name in ("Diffuse","diffuse","diff","Color","color","BaseColor","Albedo","albedo"):
        group=files.get(name)
        if not isinstance(group,dict):
            continue
        for res in ("2k","4k","1k"):
            formats=group.get(res,{})
            if not isinstance(formats,dict):
                continue
            candidate=formats.get("jpg") or formats.get("jpeg")
            if isinstance(candidate,dict) and isinstance(candidate.get("url"),str):
                url=candidate["url"]
                if urlparse(url).path.lower().endswith((".jpg",".jpeg")):
                    return url
    raise RuntimeError("Poly Haven did not provide a 2k/4k/1k diffuse JPG")

def import_diffuse(asset: str, filename: str) -> dict:
    metadata=json.loads(fetch("https://api.polyhaven.com/files/"+asset))
    url=diffuse_url(metadata)
    host=urlparse(url).hostname
    if host not in ("dl.polyhaven.org","cdn.polyhaven.org"):
        raise RuntimeError("Untrusted Poly Haven file server: "+str(host))
    error=None
    for attempt in range(3):
        try:
            content=fetch(url)
            with Image.open(BytesIO(content)) as img:
                img.verify()
            with Image.open(BytesIO(content)) as img:
                w,h=img.size
                if min(w,h)<1024:
                    raise RuntimeError("Diffuse map too small: "+asset)
                if img.format!="JPEG":
                    raise RuntimeError("Original diffuse not JPEG: "+asset)
            OUT.mkdir(parents=True,exist_ok=True)
            dest=OUT/filename
            temp=OUT/(filename+".tmp")
            temp.write_bytes(content)
            temp.replace(dest)
            sha=hashlib.sha256(content).hexdigest()
            print("UV-READY ORIGINAL DIFFUSE",asset,filename,(w,h),len(content),"sha256",sha,flush=True)
            return {"asset":asset,"file":filename,"source":url,"sha256":sha,
                    "dimensions":[w,h],"sourceType":"UV-ready Poly Haven diffuse JPG",
                    "byteIdenticalToSource":True}
        except Exception as e:
            error=e
            if attempt<2:time.sleep((attempt+1)*3)
    raise RuntimeError("Could not import UV-ready diffuse map for "+asset+": "+str(error))

def build():
    return {key:import_diffuse(*entry) for key,entry in FLOORS.items()}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--variant",default="all",
                        choices=("all",*FLOORS))
    opts=parser.parse_args()
    names=FLOORS if opts.variant=="all" else {opts.variant:FLOORS[opts.variant]}
    for name,data in names.items():
        print(name,import_diffuse(*data),flush=True)
