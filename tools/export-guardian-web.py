"""Export the existing Blender guardian's meshes and keyed rig for the web.

Run with:
blender -b beta/art/player-study/guardian.blend -P tools/export-guardian-web.py -- beta/art/player-study/guardian-rig.glb.gz
"""
import gzip
import sys
from tempfile import TemporaryDirectory
from pathlib import Path

import bpy


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
