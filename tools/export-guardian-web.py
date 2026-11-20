"""Export the existing Blender guardian's meshes and keyed rig for the web.

Run with:
blender -b beta/art/player-study/guardian.blend -P tools/export-guardian-web.py -- beta/art/player-study/guardian-rig.glb.gz
"""
import gzip
import json
import math
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import bpy


def sample_curve(keys, progress):
    for (start, source), (end, finish) in zip(keys, keys[1:]):
        if progress <= end:
            ratio = (progress - start) / (end - start)
            return source + (finish - source) * ratio
    return keys[-1][1]


def retime_light_attacks(scene, rig):
    # Resample the original authored guards, follow-through and recovery before
    # replacing any keys. Keep the original clip slots so the manifest and the
    # rest of the Blender timeline retain their frame addresses.
    assets = Path(bpy.data.filepath).parent
    clips = json.loads((assets / 'guardian-frames.json').read_text())['clips']
    timing = json.loads((assets / 'guardian-light-attacks.json').read_text())
    bones = tuple(rig.pose.bones)
    takes = {}
    for clip, curve in timing['retime'].items():
        start, length = clips[clip]
        for index in range(length):
            source = start + 1 + sample_curve(curve, index / (length - 1)) * (length - 1)
            frame = math.floor(source)
            scene.frame_set(frame, subframe=source - frame)
            takes[start + 1 + index] = tuple(
                (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy())
                for bone in bones
            )

    for frame, poses in takes.items():
        scene.frame_set(frame)
        for bone, (location, rotation, scale) in zip(bones, poses):
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = scale
            for prop in ('location', 'rotation_quaternion', 'scale'):
                bone.keyframe_insert(data_path=prop, frame=frame)


def main(output):
    scene = bpy.context.scene
    rig = bpy.data.objects['Guardian rig']
    body = bpy.data.collections['Guardian armor and body']
    sword = bpy.data.collections['Grip.R · Longsword']
    # Keep props attached to their existing joints. Browser playback switches
    # visibility because glTF does not carry Blender's visibility keyframes.
    meshes = [obj for obj in (*body.objects, *sword.objects) if obj.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    groups = {
        'Face under the visor': 'face',
        'Mouth under the visor': 'face',
        'Bread roll': 'bread',
        'Bitten bread roll': 'bite',
        'Enamel tankard · open bowl': 'cup',
        'Tankard handle': 'cup',
        'Ruby · held loot': 'ruby',
    }
    for obj in meshes:
        group = 'sword' if obj.name in sword.objects else groups.get(obj.name)
        if group:
            obj['guardian_part'] = group
        obj.animation_data_clear()
        obj.hide_set(False)
        obj.hide_viewport = obj.hide_render = False
        obj.select_set(True)
    rig.hide_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    rig.rotation_euler.z = 0
    retime_light_attacks(scene, rig)
    scene.frame_set(scene.frame_start)

    with TemporaryDirectory() as directory:
        model = Path(directory) / 'guardian.glb'
        bpy.ops.export_scene.gltf(
            filepath=str(model),
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_texcoords=False,
            export_extras=True,
            export_animations=True,
            export_animation_mode='SCENE',
            export_optimize_animation_size=True,
            export_anim_slide_to_zero=True,
        )
        output.write_bytes(gzip.compress(model.read_bytes(), compresslevel=9, mtime=0))


if __name__ == '__main__':
    main(Path(sys.argv[sys.argv.index('--') + 1]))
