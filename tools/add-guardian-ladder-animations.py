"""Bake true Blender ladder-climbing motion onto the existing Guardian armature.

Usage (repository root):
  blender -b beta/art/player-study/guardian.blend \
      -P tools/add-guardian-ladder-animations.py

Changes guardian.blend and guardian-frames.json in-place. Run the existing
export-guardian-web.py next to rebuild the actual 3D animation asset.

All coordinates are in the original armature's local Blender space (metres).
The game handles world-space vertical displacement; this take is in-place.
"""
import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'beta' / 'art' / 'player-study'
MANIFEST = ASSETS / 'guardian-frames.json'
BLEND = ASSETS / 'guardian.blend'
CLIMB_FRAMES = 48
CLIMB_NAMES = ('climb-up', 'climb-down')
LADDER_Y = -.36
LADDER_HALF_WIDTH = .31
RUNG_GAP = .30

builder_spec = importlib.util.spec_from_file_location(
    'guardian_pose_helpers', ROOT / 'tools' / 'build-player-sprite-study.py')
builder = importlib.util.module_from_spec(builder_spec)
builder_spec.loader.exec_module(builder_spec)

rig = bpy.data.objects.get('Guardian rig')
if rig is None or rig.type != 'ARMATURE':
    raise RuntimeError("Original Guardian rig missing from guardian.blend")
scene = bpy.context.scene
builder.rig = rig
builder.rest = {
    bone.name: (bone.head_local.copy(), bone.tail_local.copy(),
                bone.parent.name if bone.parent else None)
    for bone in rig.data.bones
}
required = {
    'Hips', 'Chest', 'Head', 'Mantle', 'Arm.L', 'Arm.R',
    'Forearm.L', 'Forearm.R', 'Glove.L', 'Glove.R',
    'Thigh.L', 'Thigh.R', 'Shin.L', 'Shin.R', 'Boot.L', 'Boot.R',
    'Pauldron.L', 'Pauldron.R', 'Grip.R',
}
missing = required - set(builder.rest)
if missing:
    raise RuntimeError('Guardian bones missing: ' + ', '.join(sorted(missing)))

manifest = json.loads(MANIFEST.read_text())
clips = manifest['clips']
original_end = max(start + count for name, (start, count) in clips.items()
                   if name not in CLIMB_NAMES)
first_start = original_end
clip_ranges = {
    'climb-up': [first_start, CLIMB_FRAMES],
    'climb-down': [first_start + CLIMB_FRAMES, CLIMB_FRAMES],
}
# Idempotent: repeated runs always replace the same two blocks.
for name, span in clip_ranges.items():
    if name in clips and clips[name] != span:
        raise RuntimeError(f'Unexpected {name} range in manifest: {clips[name]}')
    clips[name] = span


def ease(t):
    t = max(0.0, min(1.0, t))
    return t*t*(3-2*t)


def envelope(t):
    # Anticipation and recovery are real portions of the action, not frame
    # snaps. The middle section repeats alternate locked hand/foot contacts.
    return ease(t/.15) * (1-ease((t-.84)/.16))


def arm_ik(side, sign, wrist_target, shoulder_rot, roll):
    arm = 'Arm.' + side
    shoulder = builder.attached('Chest', builder.rest[arm][0])
    wrist = builder.bend_joint(
        arm, 'Forearm.' + side, shoulder, wrist_target,
        (sign*.72, .38, -.23), 1.05
    )
    builder.point('Glove.' + side, wrist,
                  wrist + Vector((-.008*sign, -.10, .005)))
    delta = (rig.pose.bones[arm].matrix
             @ rig.data.bones[arm].matrix_local.inverted())
    follow = shoulder_rot.to_quaternion().slerp(delta.to_quaternion(), .36)
    builder.orient('Pauldron.' + side, shoulder, follow.to_matrix())
    return wrist


def foot_ik(side, sign, ankle_target):
    thigh = 'Thigh.' + side
    hip = builder.attached('Hips', builder.rest[thigh][0])
    ankle = builder.bend_joint(
        thigh, 'Shin.' + side, hip, ankle_target,
        (sign*.31, -.46, -.03), 1.04
    )
    builder.point('Boot.' + side, ankle, ankle + Vector((0, -.17, -.045)))


def climbing_pose(direction, t, idle_basis):
    # Clear only the in-memory pose; old Blender keys/takes are untouched.
    for bone in rig.pose.bones:
        bone.matrix_basis = idle_basis[bone.name].copy()
    bpy.context.view_layer.update()

    activity = envelope(t)
    up = direction == 'climb-up'
    # Two full left/right climbing exchanges, with phase offset for descent.
    phase = math.tau * (t-.14)/.72 * 2 + (0 if up else math.pi)
    sway = math.sin(phase)
    vertical_bob = .038 * math.sin(2*phase) * activity
    hip_at = builder.rest['Hips'][0] + Vector((
        .025*sway*activity, -.035*activity, vertical_bob))
    builder.orient('Hips', hip_at,
                   Euler((.075*activity, .025*sway*activity,
                          .032*sway*activity)).to_matrix())
    chest_at = builder.attached('Hips', builder.rest['Chest'][0])
    chest_orientation = Euler((.24*activity, .025*sway*activity,
                               -.04*sway*activity))
    builder.orient('Chest', chest_at, chest_orientation.to_matrix())
    builder.orient(
        'Head', builder.attached('Chest', builder.rest['Head'][0]),
        Euler((.075*activity, 0, .025*sway*activity)).to_matrix())
    builder.orient(
        'Mantle', builder.attached('Chest', builder.rest['Mantle'][0]),
        Euler((-.14*activity + .05*math.sin(phase-.6)*activity, 0, 0)).to_matrix())

    # The wrists lock near visible rungs while the opposite hand reaches.
    # The ankle targets alternate with the arms in opposing support phases.
    for side, sign in (('L', -1), ('R', 1)):
        arm_phase = phase + (0 if sign < 0 else math.pi)
        hand_shift = math.sin(arm_phase)
        foot_shift = math.sin(arm_phase + math.pi)
        hand_target = Vector((
            sign*LADDER_HALF_WIDTH,
            LADDER_Y - .012*math.cos(arm_phase)*activity,
            1.59 + .13*hand_shift*activity + .05*vertical_bob
        ))
        foot_height = .155 + .27*max(0, foot_shift)*activity
        foot_target = Vector((
            sign*.17, LADDER_Y+.075,
            foot_height
        ))
        # Move only toward these targets as the hands first grab the rails;
        # recover the original planted pose as the hero steps off.
        start_wrist = builder.rest['Glove.'+side][0]
        start_ankle = builder.rest['Boot.'+side][0]
        hand_target = start_wrist.lerp(hand_target, activity)
        foot_target = start_ankle.lerp(foot_target, activity)
        arm_ik(side, sign, hand_target, chest_orientation, hand_shift)
        foot_ik(side, sign, foot_target)
    # The free right hand sheaths/releases the sword while climbing.
    wrist = rig.pose.bones['Glove.R'].head.copy()
    builder.point('Grip.R', wrist, wrist + Vector((.02, -.19, -.09)))

    # At a climb-up finish, both hands press on the lip and the leading
    # boot passes it. Downward descent instead plants feet first at the foot.
    exit_amount = ease((t-.83)/.16)
    if exit_amount and up:
        builder.orient(
            'Chest', builder.attached('Hips', builder.rest['Chest'][0]),
            Euler((.24*activity+.24*exit_amount,
                   .02*sway*activity, -.035*sway*activity)).to_matrix())
    elif exit_amount:
        builder.orient(
            'Hips', builder.rest['Hips'][0] + Vector((0,-.02*activity,vertical_bob)),
            Euler((.04*activity, 0, .0)).to_matrix())
    bpy.context.view_layer.update()


def create_guides():
    # Non-rendering ladder reference in the Blender scene: these meshes do
    # NOT go into the exported game model (export selects only hero meshes).
    name = 'Ladder guide · Blender only'
    collection = bpy.data.collections.get(name)
    if collection is not None:
        return
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    def bar(label, start, end, radius):
        d = Vector(end)-Vector(start)
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=d.length,
                                             location=(Vector(start)+Vector(end))*.5)
        obj = bpy.context.object
        obj.name = label
        for source in tuple(obj.users_collection):
            source.objects.unlink(obj)
        collection.objects.link(obj)
        obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        obj.hide_render = True
        obj.display_type = 'WIRE'
    for x in (-.38,.38):
        bar('Ladder rail reference', (x,LADDER_Y,.07),(x,LADDER_Y,2.26),.019)
    for i in range(8):
        z=.16+RUNG_GAP*i
        bar('Rung reference',(-.38,LADDER_Y,z),(.38,LADDER_Y,z),.015)
    for obj in collection.objects:
        obj.select_set(False)


def bake():
    create_guides()
    action = rig.animation_data.action if rig.animation_data else None
    if action is None:
        raise RuntimeError('Existing keyed Blender Guardian Action missing')
    scene.frame_set(1)
    idle_basis = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
    pose_bones = list(rig.pose.bones)
    for direction, (start, count) in clip_ranges.items():
        former = {}
        scene.timeline_markers.new(
            direction.upper().replace('-', ' · '), frame=start+1)
        for i in range(count):
            frame = start+1+i
            t = i/(count-1)
            scene.frame_set(frame)
            climbing_pose(direction, t, idle_basis)
            for bone in pose_bones:
                q = bone.rotation_quaternion
                if bone.name in former and q.dot(former[bone.name]) < 0:
                    q.negate()
                former[bone.name] = q.copy()
                for channel in ('location','rotation_quaternion','scale'):
                    bone.keyframe_insert(data_path=channel,frame=frame)
    scene.frame_start = 1
    scene.frame_end = max(scene.frame_end,
        max(start+count for start,count in clip_ranges.values()))
    scene.frame_set(1)
    rig['ladder_clips'] = 'climb-up, climb-down'
    rig['ladder_rung_gap_m'] = RUNG_GAP
    rig['ladder_baked_frame_rate'] = scene.render.fps
    manifest['ladder'] = {
        'clips': clip_ranges,
        'rungSpacingMeters': RUNG_GAP,
        'modelSpace': 'in-place / authored on existing Guardian rig',
        'entryFraction': .15, 'exitFraction': .16,
        'notes': 'Alternating hand/foot grips with analytic two-bone IK keys',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False,
                                   separators=(',',':'))+'\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
    print('GUARDIAN_LADDER_BAKED',clip_ranges,
          'frame_end',scene.frame_end,'bones',len(pose_bones),flush=True)


if __name__ == '__main__':
    bake()
