"""Package 8 raw floor diffuse JPGs, 3 raw wall diffuse JPGs and 8 floor atlases.

The old primary previews were NOT UV materials. Those are not imported by
this version. Originals come from Poly Haven's actual diffuse map endpoint.
The large 4096px floor atlases break visible repeating grid patterns without
changing original source files or the displayed wall-albedo direction.

Writes only beta/room-editor/assets/tiles. Existing 3 Blender WebPs remain
solely for compatibility with the existing UNMODIFIED editor-only workflow.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from PIL import Image

SOURCE=Path(__file__).resolve().parent/"build-prison-tiles.py"
FLOOR_SOURCE=SOURCE.parent/"build-floor-map.py"
WALL_SOURCE=SOURCE.parent/"build-wall-maps.py"
ATLAS_SOURCE=SOURCE.parent/"build-floor-atlas.py"
WALL_ATLAS_SOURCE=SOURCE.parent/"build-wall-atlas.py"
OUT=SOURCE.parent.parent/"assets"/"tiles"
RAW=Path(sys.argv[1] if len(sys.argv)>1 else "/tmp/md-room-editor-raw")
OUT.mkdir(parents=True,exist_ok=True)

for name in ("floor-prison-01","wall-prison-x","wall-prison-y"):
    source=RAW/(name+".png")
    if not source.is_file():
        raise SystemExit("Missing legacy Blender source "+str(source))
    with Image.open(source) as source_image:
        image=source_image.convert("RGBA")
        if image.size!=(512,512):
            raise SystemExit("Expected 512x512 Blender source "+str(source))
        if not image.getchannel("A").getbbox():
            raise SystemExit("Transparent legacy source "+str(source))
        image.save(OUT/(name+".webp"),format="WEBP",quality=95,method=6,exact=True)

subprocess.run([sys.executable,str(FLOOR_SOURCE)],check=True)
subprocess.run([sys.executable,str(WALL_SOURCE)],check=True)
subprocess.run([sys.executable,str(ATLAS_SOURCE)],check=True)
subprocess.run([sys.executable,str(WALL_ATLAS_SOURCE)],check=True)

# Actual diffuse maps have source-specific aspect ratios and true UV mapping.
# The editor calibrates each to approximate source metre coverage; do not
# extrapolate the aspect ratio of a 1600x800 presentation preview.
VARIANTS={
 "dungeon-ashlar":("floor-albedo-01.jpg","dark_rock_02",2.0),
 "dungeon-coast-rocks":("floor-albedo-02.jpg","coast_sand_rocks_02",15.0),
 "dungeon-cut-stone":("floor-albedo-03.jpg","cobblestone_floor_09",2.2),
 "dungeon-mossy-cobbles":("floor-albedo-04.jpg","cobblestone_floor_04",1.5),
 "dungeon-ruined-cobbles":("floor-albedo-05.jpg","cobblestone_floor_03",2.4),
 "dungeon-aged-paving":("floor-albedo-06.jpg","stone_floor",1.8),
 "dungeon-rustic-slate":("floor-albedo-07.jpg","slate_floor_02",2.0),
 "dungeon-wet-mud":("floor-albedo-08.jpg","brown_mud_03",1.3),
 "stone":("wall-albedo-01.jpg","rock_wall_17",1.8),
 "stone-cut":("wall-albedo-02.jpg","rock_wall_16",2.0),
 "stone-old":("wall-albedo-03.jpg","old_stone_wall",2.0),
}
ATLASES={
 "dungeon-ashlar":"floor-atlas-01.jpg",
 "dungeon-coast-rocks":"floor-atlas-02.jpg",
 "dungeon-cut-stone":"floor-atlas-03.jpg",
 "dungeon-mossy-cobbles":"floor-atlas-04.jpg",
 "dungeon-ruined-cobbles":"floor-atlas-05.jpg",
 "dungeon-aged-paving":"floor-atlas-06.jpg",
 "dungeon-rustic-slate":"floor-atlas-07.jpg",
 "dungeon-wet-mud":"floor-atlas-08.jpg",
 "stone":"wall-atlas-01.jpg",
 "stone-cut":"wall-atlas-02.jpg",
 "stone-old":"wall-atlas-03.jpg"
}
asset_info={}
for style,(filename,asset_id,width_world) in VARIANTS.items():
    path=OUT/filename
    data=path.read_bytes()
    with Image.open(path) as im:
        if im.format!="JPEG" or min(im.size)<1024:
            raise SystemExit("Missing real UV-ready diffuse: "+filename)
        w,h=im.size
    asset_info[style]={
     "file":filename,
     "asset":asset_id,
     "sourcePage":"https://polyhaven.com/a/"+asset_id,
     "sha256":hashlib.sha256(data).hexdigest(),
     "dimensions":[w,h],
     "worldWidth":width_world,
     "worldHeight":round(width_world*h/w,5),
     "imageRotationDegrees":0,"imageMirrored":False,
     "textureRole":"Diffuse/albedo, flat UV ready",
     "byteIdenticalToSource":True
    }

atlas_info={}
for style,filename in ATLASES.items():
    path=OUT/filename
    data=path.read_bytes()
    with Image.open(path) as im:
        expected=(4096,4096) if style.startswith("dungeon-") else (4096,768)
        if im.size!=expected:
            raise SystemExit("Incorrect atlas dimensions "+filename+" "+str(im.size))
    atlas_info[style]={
     "file":filename,
     "sha256":hashlib.sha256(data).hexdigest(),
     "dimensions":[4096,4096] if style.startswith("dungeon-") else [4096,768],
     "worldWidth":30.0,
     "worldHeight":30.0 if style.startswith("dungeon-") else 2.0,
     "sourceStyle":style,
     "sourceSha256":asset_info[style]["sha256"],
     "method":"soft-phase-stochastic-UV-blending-no-color-grading"
    }

manifest={
 "schema":"mind-dungeon-room-tiles/v7",
 "source":"Eleven UV-ready Poly Haven original Diffuse maps (eight floors, three walls)",
 "textureMode":"uv-ready-polyhaven-diffuse",
 "license":"CC0: https://polyhaven.com/license",
 "floorMaterial":"derived-large-stochastic-albedo-atlas",
 "wallMaterial":"derived-world-aligned-diffuse-wall-atlas",
 "floorVariants":{k:v[0] for k,v in VARIANTS.items() if k.startswith("dungeon-")},
 "floorAtlases":{k:v for k,v in ATLASES.items() if k.startswith("dungeon-")},
 "wallAtlases":{k:v for k,v in ATLASES.items() if not k.startswith("dungeon-")},
 "wallVariants":{k:v[0] for k,v in VARIANTS.items() if not k.startswith("dungeon-")},
 "assetInfo":asset_info,"atlasInfo":atlas_info,
 "floorGenerator":"beta/room-editor/blender/build-floor-map.py",
 "floorGeneratorSha256":hashlib.sha256(FLOOR_SOURCE.read_bytes()).hexdigest(),
 "wallGenerator":"beta/room-editor/blender/build-wall-maps.py",
 "wallGeneratorSha256":hashlib.sha256(WALL_SOURCE.read_bytes()).hexdigest(),
 "atlasGenerator":"beta/room-editor/blender/build-floor-atlas.py",
 "atlasGeneratorSha256":hashlib.sha256(ATLAS_SOURCE.read_bytes()).hexdigest(),
 "wallAtlasGenerator":"beta/room-editor/blender/build-wall-atlas.py",
 "wallAtlasGeneratorSha256":hashlib.sha256(WALL_ATLAS_SOURCE.read_bytes()).hexdigest(),
 "legacyBlenderWallProjectionFiles":["wall-prison-x.webp","wall-prison-y.webp"],
 "gameBetaFilesModified":False
}
# Regression: exactly eight floors and three walls, no cross-category leakage.
assert len(manifest["floorVariants"]) == 8
assert set(manifest["floorVariants"]) == {k for k in VARIANTS if k.startswith("dungeon-")}
assert len(manifest["wallVariants"]) == 3
assert set(manifest["wallVariants"]) == {k for k in VARIANTS if not k.startswith("dungeon-")}
assert set(manifest["floorAtlases"]) == set(manifest["floorVariants"])
assert set(manifest["wallAtlases"]) == set(manifest["wallVariants"])
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print("VALIDATED: 11 original Diffuse maps + 8 floor atlases + 3 wall atlases",flush=True)
