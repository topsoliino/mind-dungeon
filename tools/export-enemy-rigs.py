"""Export the existing weighted Blender enemy rigs to the Guardian's live GLB pipeline.

Run from the repository root, after building skeleton.blend and rat.blend:
  blender -b --factory-startup -t 4 --python-exit-code 1 -P tools/export-enemy-rigs.py

We deliberately export SKINNED armatures, not evaluated/baked atlas meshes.
Each variant contains one continuous 24-fps animation, packed into named
intervals just like the current Guardian rig. The runtime samples the actual
bones with THREE.AnimationMixer, using precisely the Guardian's lights/camera.
"""
import gzip
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import bpy


ROOT = Path.cwd() / "beta" / "art"
FPS = 24
SAMPLES = 25  # include both endpoints; looping actions reach a full cycle
GAP = 1       # never interpolate a clip into the subsequent clip


def capture(rig, actions):
    """Sample original authored clips before writing any new animation action."""
    captured = {}
    rig.animation_data_create()
    for label, source in actions.items():
        action = bpy.data.actions.get(source)
        if not action:
            raise RuntimeError(f"Missing Blender animation action {source}")
        rig.animation_data.action = action
        frames = []
        for index in range(SAMPLES):
            bpy.context.scene.frame_set(1 + 2 * index)
            bpy.context.view_layer.update()
            bones = {}
            for bone in rig.pose.bones:
                # Read *local* pose channels, not world coordinates. This
                # preserves correct inherited transforms on skinned bones.
                bones[bone.name] = (
                    bone.location.copy(),
                    bone.rotation_euler.to_quaternion() if
                    bone.rotation_mode in {"XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"}
                    else bone.rotation_quaternion.copy(),
                    bone.scale.copy(),
                )
            frames.append(bones)
        captured[label] = frames
    rig.animation_data.action = None
    return captured


def bake_packed_action(rig, clips):
    """Re-key existing rig poses to one contiguous animation, Guardian-style."""
    samples = capture(rig, clips)
    action = bpy.data.actions.new("Enemy live rig | packed 24 fps")
    action.use_fake_user = True
    rig.animation_data.action = action
    layout = {}
    frame = 1
    for label, poses in samples.items():
        layout[label] = [frame - 1, len(poses)]
        for i, snapshot in enumerate(poses):
            target = frame + i
            bpy.context.scene.frame_set(target)
            for bone in rig.pose.bones:
                location, rotation, scale = snapshot[bone.name]
                bone.rotation_mode = "QUATERNION"
                bone.location = location
                bone.rotation_quaternion = rotation
                bone.scale = scale
                for channel in ("location", "rotation_quaternion", "scale"):
                    bone.keyframe_insert(data_path=channel, frame=target,
                                         group=bone.name)
        frame += SAMPLES + GAP
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = frame - GAP - 1
    bpy.context.scene.frame_set(1)
    return layout


def export_model(output, rig, meshes, clips):
    rig.animation_data_clear()
    bake_packed_action(rig, clips)
    bpy.ops.object.select_all(action="DESELECT")
    rig.hide_set(False)
    rig.hide_render = False
    rig.select_set(True)
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_set(obj not in meshes)
            obj.hide_render = obj not in meshes
            obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = rig

    with TemporaryDirectory() as tmp:
        glb = Path(tmp) / "enemy.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(glb),
            export_format="GLB",
            use_selection=True,
            export_apply=False,   # do NOT apply the armature modifier
            export_extras=True,
            export_animations=True,
            export_animation_mode="SCENE",
            export_optimize_animation_size=True,
            export_anim_slide_to_zero=True,
        )
        blob = glb.read_bytes()
        if len(blob) < 1200 or blob[:4] != b"glTF":
            raise RuntimeError(f"Skinned GLB export failed: {output}")
        output.write_bytes(gzip.compress(blob, compresslevel=9, mtime=0))
    print(f"EXPORTED {output.name}: {len(blob)} GLB bytes, "
          f"{len(output.read_bytes())} compressed bytes, {list(clips)}",
          flush=True)


def skeleton():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "skeleton" / "skeleton.blend"))
    rig = bpy.data.objects["Skeleton rig"]
    combined = bpy.data.objects["Skeleton • both"]
    manifests = {}
    for weapon, move in [("sabre", "strike"), ("bow", "shoot")]:
        clips = {"idle": "idle", "run": "run", move: move, "death": "death"}
        export_model(ROOT / "skeleton" / f"skeleton-{weapon}-rig.glb.gz",
                     rig, [combined, bpy.data.objects["Skeleton • " + weapon]],
                     clips)
        manifests[weapon] = {
            "fps": FPS, "clips": {
                key: [i * (SAMPLES + GAP), SAMPLES]
                for i, key in enumerate(clips)
            }, "displaySize": 132, "field": 3.23, "targetHeight": 1.01,
            "materialColorSpace": "srgb-to-linear",
        }
    (ROOT / "skeleton" / "skeleton-live.json").write_text(
        json.dumps(manifests, separators=(",", ":")) + "\n")


def rat():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "rat" / "rat.blend"))
    rig = bpy.data.objects["Rat rig • editable"]
    mesh = bpy.data.objects["Small rat • fully weighted skin"]
    names = ("idle", "run", "stalk", "jump", "bite", "combo",
             "dodge", "dodge-left", "death")
    clips = {name: "rat_" + name for name in names}
    export_model(ROOT / "rat" / "rat-live-rig.glb.gz", rig, [mesh], clips)
    manifest = {
        "fps": FPS,
        "clips": {key: [i * (SAMPLES + GAP), SAMPLES]
                  for i, key in enumerate(clips)},
        "displaySize": 106, "field": 2.3, "targetHeight": 0.39,
        "materialColorSpace": "srgb-to-linear",
    }
    (ROOT / "rat" / "rat-live.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n")


skeleton()
rat()
print("All three live enemy rigs are ready for the Guardian renderer.",
      flush=True)
