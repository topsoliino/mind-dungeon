"""Check the *actual* compressed live-rig files, without Blender or graphics dependencies.

Validate that every enemy has a genuine skinned 3D mesh, an animation channel,
real keyed bone motion, matching 24 fps clip ranges, and a loadable GLB header.
This rejects accidental static-prop GLBs or baked sprite-sheet substitutes.
"""
import gzip
import hashlib
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
    assert manifest.get("materialColorSpace")=="srgb-to-linear", (
        asset, "Blender palette must match the Guardian's sRGB-to-linear pipeline")
    assert manifest.get("artStyle")==(
       "guardian-rebuilt-skeleton-v4" if variant is not None
       else "guardian-natural-enemies-v3"), (asset,"wrong art generation")
    source_blend=ROOT/("rat/rat.blend" if variant is None else "skeleton/skeleton.blend")
    assert manifest.get("sourceBlendSha256")==hashlib.sha256(source_blend.read_bytes()).hexdigest(), (
        asset,"Live rig does not use the current Blender source; rebuild GLB")
    names={m.get("name","") for m in gltf["materials"]}
    required=(
        {"Ossuary ivory bone","Ossuary pale sunlit bone","Ossuary graphite bone recess",
         "Ossuary forged sabre steel" if variant=="sabre" else "Ossuary bow yew"}
        if variant is not None else
        {"Slate blue-grey main coat","Cold silver-grey fur facets",
         "Deep slate underfur","Dark dorsal blue-grey coat"}
    )
    assert required<=names, (
        asset,"Wrong skeleton/rat color generation; missing "+str(required-names))
    if variant is not None:
        assert "Neck" in {n.get("name","") for n in gltf.get("nodes",[])}, (
            asset,"Bare skeleton must have separate animated cervical neck")
        assert not any(any(token in name.lower() for token in
                ("armor","cuirass","tabard","greave","buckler","pauldron","cloak"))
            for name in names), (asset,"Deleted skeleton armor returned")
    else:
        assert manifest["displaySize"]<=84, (asset,"Rat must render smaller")
        assert not any(
            float(m.get("pbrMetallicRoughness",{}).get("metallicFactor",0))>.01
            for m in gltf["materials"]), (asset,"Rat still has metallic equipment")
        banned=("scavenger","harness","saddle","buckle","pauldron","leather",
                "iron","brass","cloth","armor","fur gold")
        assert not any(any(word in name.lower() for word in banned)
            for name in names), (asset,"Rat still has costume materials")
    assert any("NORMAL" in p.get("attributes",{}) for m in gltf["meshes"] for p in m.get("primitives",[])), (
        asset,"Finished surface normals must survive the skinned GLB export")
    print(f"{asset}: {len(data):,} bytes, {len(gltf['meshes'])} meshes, "
          f"{len(gltf['skins'])} skeletons, {len(channels)} bone channels, "
          f"{len(clips)} genuine 3D animation clips OK")
print("All live enemy assets use the same GLB rig/animation pipeline as the Guardian.")
