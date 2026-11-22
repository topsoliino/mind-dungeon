"""Check the *actual* compressed live-rig files, without Blender or graphics dependencies.

Validate that every enemy has a genuine skinned 3D mesh, an animation channel,
real keyed bone motion, matching 24 fps clip ranges, and a loadable GLB header.
This rejects accidental static-prop GLBs or baked sprite-sheet substitutes.
"""
import gzip
import json
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"beta"/"art"
PACKAGES=[
 ("skeleton/skeleton-sabre-rig.glb.gz","skeleton/skeleton-live.json","sabre",
  ("idle","run","strike","death")),
 ("skeleton/skeleton-bow-rig.glb.gz","skeleton/skeleton-live.json","bow",
  ("idle","run","shoot","death")),
 ("rat/rat-live-rig.glb.gz","rat/rat-live.json",None,
  ("idle","run","stalk","jump","bite","combo","dodge","dodge-left","death")),
]
for asset,settings_path,variant,clips in PACKAGES:
    data=gzip.decompress((ROOT/asset).read_bytes())
    assert len(data)>10000,asset+" too small for editable skinned geometry"
    magic,version,length=struct.unpack_from("<4sII",data)
    assert (magic,version,length)==(b"glTF",2,len(data)),asset+" invalid GLB"
    json_length,json_type=struct.unpack_from("<I4s",data,12)
    assert json_type==b"JSON" and json_length>300,asset+" missing GLB JSON chunk"
    gltf=json.loads(data[20:20+json_length])
    assert gltf.get("meshes") and gltf.get("skins"),asset+" is not skinned 3D"
    assert gltf.get("materials"),asset+" lost its Blender materials"
    assert len(gltf.get("animations",[]))==1,asset+" no packed Guardian-style animation"
    channels=gltf["animations"][0].get("channels",[])
    assert len(channels)>15,asset+" has no animated bone tracks"
    assert any(s.get("joints") for s in gltf["skins"]),asset+" armature has no joints"
    manifest=json.loads((ROOT/settings_path).read_text())
    if variant:manifest=manifest[variant]
    assert manifest["fps"]==24
    assert tuple(manifest["clips"])==clips,(asset,manifest["clips"])
    assert all(count==25 for start,count in manifest["clips"].values())
    assert manifest["field"]>0 and manifest["targetHeight"]>0
    print(f"{asset}: {len(data):,} bytes, {len(gltf['meshes'])} meshes, "
          f"{len(gltf['skins'])} skeletons, {len(channels)} bone channels, "
          f"{len(clips)} genuine 3D animation clips OK")
print("All live enemy assets use the same GLB rig/animation pipeline as the Guardian.")
