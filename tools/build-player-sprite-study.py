"""Build an editable Blender guardian and export the practice sprites.

Run from the repository root:
  blender -b --factory-startup -t 4 -P tools/build-player-sprite-study.py -- --output /tmp/player-study

Pack the browser assets with Pillow after rendering:
  python tools/pack-player-sprite-study.py /tmp/player-study beta/art/player-study
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector


CELL = 128
FACINGS = 8
GAITS = {
    # Forward foot travel during stance, duty factor, swing clearance, trunk lean.
    'walk': (.77, .60, .081, .015),
    'sprint': (.92, .34, .300, .505),
}
GAIT_BLENDS = {'gait-one': 1/3, 'gait-two': 2/3}
WALK_FOOT_CENTER = .105
WALK_CYCLE = .56
CONSUMPTION = {'eat': (24, 1.43), 'drink': (25, 1.57)}
INTERACTIONS = {
    'chest': {'frames': 26, 'duration': 1.55, 'distance': .91, 'event': .59},
    'pickup': {'frames': 18, 'duration': .92, 'distance': .63, 'side': -.12, 'event': .46},
    'knowledge': {'frames': 44, 'duration': 3.32, 'event': .85},
}
CROUCHED_INTERACTIONS = ('chest', 'pickup')
CROUCH_ENTRIES = {f'crouch-from-sprint-{phase}': phase/4 for phase in range(4)}
CROUCH_EXITS = {f'crouch-up-{phase}': phase/4 for phase in range(4)}
CHEST_HINGE = Vector((0, -1.15, .51))
CHEST_LID_DEPTH = .48
VAULT_FRAMES = 19
VAULT_ENTRIES = {f'vault-in-{phase}': phase/4 for phase in range(4)}
VAULT = {'start': -1.20, 'end': 1.21, 'radius': .44, 'height': .83, 'duration': .52, 'exitPhase': .5,
         'path': [(0,0),(.17,.11),(.29,.205),(.335,.238),(.48,.46),(.68,.70),(.84,.86),(1,1)]}
ROLL_FRAMES = 28
ROLL_RECOVERY = 22
ROLL_ENTRIES = {f'roll-in-{stride}-{phase}': (stride, phase/4)
                for stride in ('walk', *GAIT_BLENDS, 'sprint') for phase in range(4)}
ROLL_EXITS = {'roll-out-walk': 'walk', 'roll-out-sprint': 'sprint'}
WEAPON_TYPES = ('sword', 'hammer')
CHARGE_FRAMES = 6
HEAVY_FRAMES = 22
CHARGE_CLIPS = {f'charge-{weapon}-{light}': (weapon, light)
                for weapon in WEAPON_TYPES for light in ('down', 'up')}
HEAVY_CLIPS = {f'heavy-{weapon}': weapon for weapon in WEAPON_TYPES}
ROLL_ATTACK_FRAMES = 18
ROLL_ATTACKS = {f'roll-attack-{weapon}': weapon for weapon in WEAPON_TYPES}
ROLL_ATTACK_LANDINGS = {f'{name}-landing': name for name in ROLL_ATTACKS}
ROLL_ATTACK_GAITS = {f'{name}-{gait}-{phase}': (name, gait, phase/4)
                     for name in ROLL_ATTACKS for gait in ('walk','sprint') for phase in range(2)}
# Model-space travel, shared by the rig's planted feet and the game's movement.
ATTACK_MOTION = {
    'heavy-sword': {'distance': .53, 'advance': [.075, .35]},
    'heavy-hammer': {'distance': .47, 'advance': [.130, .335], 'impactFrame': 7},
    'roll-attack-sword': {'distance': .36, 'advance': [.07, .49]},
    'roll-attack-hammer': {'distance': .28, 'advance': [.10, .50]},
}
CLIPS = [('idle', 4), ('walk', 16), ('sprint', 16), ('down', 20), ('up', 20),
         *((name, 16) for name in GAIT_BLENDS), ('roll', ROLL_FRAMES),
         *((name, 2) for name in ROLL_ENTRIES), *((name, 4) for name in ROLL_EXITS),
         *((name, CHARGE_FRAMES) for name in CHARGE_CLIPS),
         *((name, HEAVY_FRAMES) for name in HEAVY_CLIPS),
         *((name, ROLL_ATTACK_FRAMES) for name in ROLL_ATTACKS),
         *((name, 4) for name in ROLL_ATTACK_LANDINGS),
         *((name, 2) for name in ROLL_ATTACK_GAITS),
         *((name, frames) for name, (frames, _) in CONSUMPTION.items()),
         ('vault', VAULT_FRAMES), *((name, 2) for name in VAULT_ENTRIES),
         ('crouch-idle', 4), ('sneak', 16), ('crouch-down', 9),
         *((name, 9) for name in CROUCH_ENTRIES), *((name, 9) for name in CROUCH_EXITS),
         *((name, interaction['frames']) for name, interaction in INTERACTIONS.items()),
         *((name+'-crouched', INTERACTIONS[name]['frames']) for name in CROUCHED_INTERACTIONS),
         *((name+'-walk', frames) for name, (frames, _) in CONSUMPTION.items())]
SIDES = [('L', -1), ('R', 1)]


def fitted(vertex, bone):
    """Fit the armor and its attachment points to the same compact silhouette."""
    x, y, z = vertex
    if bone in ('Grip.R', 'Hammer.R'):
        grip = design['Grip.R'][0]
        return fitted(grip, 'Glove.R') + Vector(vertex) - Vector(grip)
    if bone == 'Prop.L':
        wrist = design['Glove.L'][0]
        return fitted(wrist, 'Glove.L') + Vector(vertex) - Vector(wrist)
    if bone in ('Head', 'Visor'):
        return Vector((x * .97, y, 1.427 + (z - 1.49) * .96))
    if bone in ('Chest', 'Mantle'):
        return Vector((x * 1.13, y * 1.045, z - .062))
    if bone.startswith(('Arm.', 'Forearm.', 'Glove.', 'Pauldron.')):
        return Vector((x * 1.10, y, z - .061))
    if bone == 'Hips':
        return Vector((x * 1.08, y, z - .044))
    return Vector((x * 1.07, y, z * .955))


def material(name, color, roughness=.61, metal=0):
    mat = bpy.data.materials.new(name)
    rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in rgb)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    return mat


def mesh(name, vertices, faces, mats, bone, bevel=.006, indices=None, collection=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([fitted(vertex, bone) for vertex in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    if collection is None:
        collection = weapon_collections['sword'] if bone == 'Grip.R' else body
    collection.objects.link(obj)
    for mat in mats:
        data.materials.append(mat)
    if indices:
        for poly, index in zip(data.polygons, indices):
            poly.material_index = index
    modifier = obj.modifiers.new('Forged edges', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 2
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = .16
    normal = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = Matrix.Identity(4)
    return obj


def profile(name, levels, mats, bone, sides=8, phase=math.pi / 8):
    vertices = [(cx + rx * math.cos(phase + i * math.tau / sides),
                 cy + ry * math.sin(phase + i * math.tau / sides), z)
                for z, cx, cy, rx, ry in levels for i in range(sides)]
    faces = [tuple(reversed(range(sides)))]
    colors = [0]
    for row in range(len(levels) - 1):
        for i in range(sides):
            a = row * sides + i
            b = row * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
            colors.append((row + (1 if i in (2, 3, 4) else 0)) % len(mats))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    colors.append(len(mats) - 1)
    return mesh(name, vertices, faces, mats, bone, indices=colors)


def plate(name, points, thickness, mat, bone, bevel=.005):
    front = [tuple(point) for point in points]
    back = [(x, y + thickness, z) for x, y, z in front]
    size = len(front)
    sides = [(i, (i + 1) % size, size + (i + 1) % size, size + i) for i in range(size)]
    return mesh(name, front + back, [tuple(range(size)), tuple(reversed(range(size, size * 2))), *sides],
                [mat], bone, bevel)


def limb(name, a, b, widths, mats, bone, sides=8, collection=None):
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    u = axis.cross(Vector((0, 1, 0))).normalized()
    v = axis.cross(u)
    vertices = [tuple(a.lerp(b, fraction) + u * rx * math.cos(i * math.tau / sides)
                      + v * ry * math.sin(i * math.tau / sides))
                for fraction, rx, ry in widths for i in range(sides)]
    faces = [tuple(reversed(range(sides)))]
    indices = [0]
    for row in range(len(widths) - 1):
        for i in range(sides):
            k = row * sides + i
            n = row * sides + (i + 1) % sides
            faces.append((k, n, n + sides, k + sides))
            indices.append((i + row) % len(mats))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    indices.append(len(mats) - 1)
    return mesh(name, vertices, faces, mats, bone, indices=indices, collection=collection)


def model_joints():
    joints = {
        'Hips': ((0, 0, .97), (0, 0, 1.19), None),
        'Chest': ((0, 0, 1.16), (0, 0, 1.51), 'Hips'),
        'Head': ((0, 0, 1.49), (0, 0, 1.86), 'Chest'),
        'Mantle': ((0, .13, 1.43), (0, .25, .95), 'Chest'),
    }
    for side, sign in SIDES:
        shoulder, elbow, wrist = ((sign * .292, 0, 1.43), (sign * .373, .014, 1.174),
                                   (sign * .389, -.045, .942))
        hip, knee, ankle = ((sign * .135, 0, .99), (sign * .153, -.052, .544),
                            (sign * .164, .005, .116))
        joints.update({
            'Arm.' + side: (shoulder, elbow, 'Chest'),
            'Pauldron.' + side: (shoulder, elbow, 'Chest'),
            'Forearm.' + side: (elbow, wrist, 'Arm.' + side),
            'Glove.' + side: (wrist, (wrist[0], wrist[1], wrist[2] - .09), 'Forearm.' + side),
            'Thigh.' + side: (hip, knee, 'Hips'),
            'Shin.' + side: (knee, ankle, 'Thigh.' + side),
            'Boot.' + side: (ankle, (ankle[0], -.14, .06), 'Shin.' + side),
        })
    wrist = joints['Glove.R'][0]
    joints['Grip.R'] = (wrist, (wrist[0] + .20, wrist[1] - .53, wrist[2] + .19), 'Glove.R')
    joints['Hammer.R'] = (*joints['Grip.R'][:2], 'Grip.R')
    joints['Visor'] = ((0, -.03, 1.763), (.105, -.03, 1.763), 'Head')
    wrist = joints['Glove.L'][0]
    joints['Prop.L'] = (wrist, (wrist[0], wrist[1], wrist[2]+.18), 'Glove.L')
    return joints


def create_rig(joints):
    rest = {name: (fitted(head, name), fitted(tail, name), parent)
            for name, (head, tail, parent) in joints.items()}
    armature = bpy.data.armatures.new('Guardian skeleton')
    actor = bpy.data.objects.new('Guardian rig', armature)
    bpy.context.collection.objects.link(actor)
    bpy.context.view_layer.objects.active = actor
    actor.select_set(True)
    actor.show_in_front = True
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in rest.items():
        bone = armature.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return actor, rest


def model():
    steel = material('Blued steel', '778997', .51, .33)
    edge = material('Pale forged edges', 'ccd1ca', .48, .23)
    shadow = material('Gunmetal insets', '343f54', .61, .15)
    leather = material('Oxblood leather', '583633')
    joint = material('Padded graphite undercoat', '232534')
    brass = material('Old bronze rivets', 'c4a577', .52, .26)
    crimson = material('Wine-red wool', '983c48')
    scarlet = material('Raised crimson stitching', 'd67973')
    burgundy = material('Mantle lining', '502c40')
    black = material('Seams and visor', '161b28')
    blade = material('Honed edge', 'e2dfce', .35, .25)
    profile('Quilted gambeson', [(.90, 0, .015, .185, .123), (1.08, 0, .02, .215, .136),
            (1.34, 0, .015, .234, .14), (1.47, 0, .015, .19, .111)], [joint, shadow], 'Chest')
    profile('Waist and fauld', [(.91, 0, .016, .232, .144), (.98, 0, .012, .224, .144),
            (1.075, 0, .004, .184, .134)], [shadow, steel, edge], 'Hips')
    profile('Battle cuirass', [(1.055, 0, .008, .177, .128), (1.15, 0, -.006, .198, .147),
            (1.29, 0, -.012, .231, .168), (1.404, 0, .006, .273, .142),
            (1.478, 0, .015, .181, .113)], [shadow, steel, edge, steel], 'Chest')
    plate('Ridged breastplate', [(-.180, -.127, 1.38), (-.075, -.166, 1.426), (0, -.18, 1.391),
          (.084, -.169, 1.424), (.178, -.128, 1.379), (.147, -.158, 1.233),
          (0, -.186, 1.181), (-.15, -.155, 1.233)], .036, steel, 'Chest', .014)
    plate('Etched breastplate crest', [(-.055, -.19, 1.327), (-.015, -.195, 1.327),
          (-.015, -.195, 1.373), (.014, -.195, 1.373), (.014, -.195, 1.327),
          (.055, -.19, 1.327), (.055, -.19, 1.304), (.014, -.195, 1.304), (.014, -.197, 1.245),
          (0, -.198, 1.233), (-.015, -.197, 1.245), (-.015, -.195, 1.304), (-.055, -.19, 1.304)],
          .019, crimson, 'Chest')
    profile('Waist belt', [(1.007, 0, .004, .214, .154), (1.079, 0, .004, .202, .15)],
            [leather, leather], 'Hips')
    plate('Bronze clasp', [(-.041, -.151, 1.068), (.041, -.151, 1.068), (.04, -.154, 1.018), (-.04, -.154, 1.018)],
          .014, brass, 'Hips', .009)
    for x in (-.147, -.088, .088, .147):
        plate('Belt rivet', [(x - .012, -.137, 1.058), (x + .012, -.137, 1.058),
              (x + .012, -.137, 1.034), (x - .012, -.137, 1.034)], .01, brass, 'Hips')
    plate('Tabard', [(-.08, -.164, 1.068), (.086, -.163, 1.068), (.105, -.159, .801),
          (.028, -.173, .76), (-.096, -.158, .793)], .015, crimson, 'Hips')
    plate('Tabard hem', [(-.096, -.166, .80), (.028, -.181, .775), (.105, -.166, .81),
          (.105, -.166, .792), (.028, -.181, .757), (-.096, -.166, .782)], .01, brass, 'Hips')

    profile('Ribbed gorget', [(1.423, 0, 0, .146, .123), (1.522, 0, -.002, .114, .099)],
            [shadow, edge], 'Chest')
    profile('Close helm', [(1.515, 0, -.004, .097, .102), (1.55, 0, -.004, .133, .122),
            (1.655, 0, .004, .151, .145), (1.788, 0, .015, .147, .131),
            (1.887, 0, .021, .103, .091), (1.924, 0, .024, .042, .052)], [shadow, steel, steel, edge], 'Head', 12)
    plate('Visor and cheek plates', [(-.124, -.115, 1.78), (-.065, -.144, 1.798), (.062, -.144, 1.798),
          (.127, -.112, 1.78), (.115, -.133, 1.616), (.051, -.156, 1.55),
          (-.051, -.156, 1.55), (-.115, -.133, 1.617)], .04, steel, 'Visor', .01)
    plate('Visor slit', [(-.105, -.145, 1.736), (0, -.170, 1.739), (.105, -.145, 1.736),
          (.091, -.153, 1.705), (0, -.175, 1.71), (-.091, -.153, 1.705)], .012, black, 'Visor')
    plate('Raised brow', [(-.12, -.141, 1.759), (0, -.176, 1.765), (.12, -.141, 1.759),
          (.10, -.154, 1.74), (0, -.178, 1.745), (-.10, -.154, 1.74)], .02, edge, 'Visor')
    plate('Visor center ridge', [(-.012, -.179, 1.743), (.011, -.179, 1.743), (.021, -.181, 1.595),
          (0, -.184, 1.572), (-.021, -.181, 1.595)], .02, edge, 'Visor')
    for x in (-.071, -.038, .038, .071):
        plate('Visor vent', [(x - .006, -.161, 1.665), (x + .006, -.161, 1.667),
              (x + .007, -.163, 1.625), (x - .007, -.163, 1.623)], .007, black, 'Visor')
    # A low plume follows the shell, with segmented edges visible from the side.
    profile('Crimson crest', [(1.86, 0, .024, .025, .106), (1.922, 0, .048, .034, .107),
            (1.987, 0, .083, .026, .095), (1.956, 0, .162, .021, .071)],
            [burgundy, crimson, scarlet], 'Head')

    # The half mantle is a draped mesh with fixed trim and a separately keyed bone.
    rows = [
        [(-.15, .133, 1.47), (-.013, .162, 1.459), (.14, .148, 1.456), (.28, .103, 1.44)],
        [(-.114, .153, 1.29), (.002, .171, 1.285), (.151, .162, 1.27), (.265, .187, 1.235)],
        [(-.079, .177, 1.055), (.036, .206, 1.002), (.17, .195, .978), (.26, .246, .985)],
        [(-.054, .218, .789), (.059, .274, .739), (.172, .252, .762), (.275, .299, .808)],
        [(-.054, .220, .764), (.059, .277, .712), (.172, .255, .737), (.275, .302, .782)],
    ]
    quads = [(i * 4 + j, i * 4 + j + 1, (i + 1) * 4 + j + 1, (i + 1) * 4 + j)
             for i in range(len(rows) - 1) for j in range(3)]
    mantle = mesh('Half mantle with woven border', [p for row in rows for p in row], quads,
                  [crimson, burgundy, brass], 'Mantle', .003,
                  [0, 1, 0] * 3 + [2, 2, 2])
    solid = mantle.modifiers.new('Wool thickness', 'SOLIDIFY')
    solid.thickness = .01

    for side, sign in SIDES:
        bone = 'Arm.' + side
        shoulder, elbow, _ = design[bone]
        wrist = design['Glove.' + side][0]
        limb('Padded upper arm ' + side, shoulder, elbow, [(0, .097, .097), (.5, .093, .088), (1, .059, .062)],
             [joint, shadow], bone)
        pauldron = 'Pauldron.' + side
        profile('Segmented pauldron ' + side, [
                (1.303, sign * .316, .006, .091, .102), (1.39, sign * .309, -.002, .131, .124),
                (1.452, sign * .285, .007, .130, .122), (1.493, sign * .27, .009, .095, .098)],
                [shadow, steel, edge], pauldron)
        plate('Pauldron plate ' + side, [(sign * .19, -.082, 1.497), (sign * .32, -.120, 1.487),
              (sign * .425, -.087, 1.408), (sign * .329, -.116, 1.354), (sign * .217, -.112, 1.401)],
              .029, edge, pauldron, .008)
        limb('Vambrace ' + side, elbow, wrist, [(0, .072, .076), (.23, .09, .088),
             (.7, .067, .062), (.96, .046, .05)], [shadow, steel, edge, steel], 'Forearm.' + side)
        hand = design['Glove.' + side][1]
        limb('Gauntlet ' + side, wrist, hand, [(0, .053, .054), (.61, .056, .057), (1, .044, .047)],
             [leather, shadow, steel], 'Glove.' + side)
        hip, knee, _ = design['Thigh.' + side]
        ankle = design['Boot.' + side][0]
        limb('Upper leg plate ' + side, hip, knee, [(0, .108, .113), (.34, .107, .102),
             (.78, .078, .079), (1, .074, .075)], [joint, shadow, steel], 'Thigh.' + side)
        limb('Ribbed greave ' + side, knee, ankle, [(0, .088, .095), (.17, .104, .103), (.52, .076, .076),
             (.92, .054, .056), (1, .058, .061)], [shadow, steel, edge, steel], 'Shin.' + side)
        plate('Knee boss ' + side, [(sign*.153-.079, -.133, .61), (sign*.153+.05, -.154, .62),
              (sign*.153+.096, -.116, .55), (sign*.153+.018, -.165, .494), (sign*.153-.066, -.13, .53)],
              .026, edge, 'Shin.' + side, .012)
        boot = profile('Sabatons ' + side, [(.014, sign*.164, -.070, .086, .158), (.053, sign*.164, -.072, .088, .161),
                (.096, sign*.164, -.045, .078, .130), (.161, sign*.164, -.017, .06, .093)],
                [black, shadow, steel, edge], 'Boot.' + side)
        soles[side] = [vertex.co.copy() for vertex in boot.data.vertices]
        for y, z in [(-.183, .073), (-.128, .094)]:
            x = sign*.164
            plate('Articulated toe plate', [(x-.058, y, z), (x+.058, y, z), (x+.045, y, z-.013), (x-.045, y, z-.013)],
                  .012, edge, 'Boot.' + side, .003)

    # A broad steel blade, modeled around the grip axis so its silhouette
    # remains continuous through the wind-up and follow-through.
    a, end, _ = design['Grip.R']
    grip = Vector(a)
    d = (Vector(end) - grip).normalized()
    u = d.cross(Vector((0, 0, 1))).normalized()
    v = d.cross(u)
    grip_end = grip + d * .107
    limb('Leather-wrapped sword grip', grip - d*.092, grip_end, [(0,.031,.033), (.2,.025,.027),
         (.82,.023,.024), (1,.027,.027)], [leather, brass, shadow], 'Grip.R')
    limb('Swept bronze crossguard', grip_end - u*.136, grip_end + u*.136, [
         (0,.022,.025), (.17,.036,.027), (.48,.033,.029), (.83,.036,.027), (1,.022,.025)],
         [shadow, brass, brass], 'Grip.R')
    vertices = []
    for distance, width in [(.112,.047), (.207,.060), (.699,.051), (.885,.001)]:
        center = grip + d*distance
        vertices.extend([tuple(center + u*width), tuple(center+v*.012), tuple(center-u*width), tuple(center-v*.012)])
    faces = [(row*4+i, row*4+(i+1)%4, (row+1)*4+(i+1)%4, (row+1)*4+i)
             for row in range(3) for i in range(4)]
    mesh('Longsword · four facets', vertices, faces, [shadow, steel, blade], 'Grip.R', .002,
         [2, 1, 0, 1] * 3)

    hammer = weapon_collections['hammer']
    limb('War hammer · leather and ash haft', grip-d*.32, grip+d*.645,
         [(0,.027,.027), (.10,.030,.030), (.32,.024,.024), (.85,.023,.023), (1,.039,.039)],
         [leather, brass, leather, shadow], 'Hammer.R', collection=hammer)
    head = grip + d*.542
    # A narrow peen, an eye around the haft, then the short square poll.
    # The striking face is the last ring, perpendicular to the length of the head.
    vertices = [tuple(head + u*x + v*y + d*z)
                for x, height, width in [(-.245,.018,.032), (-.075,.083,.077),
                                          (.135,.070,.062), (.215,.071,.064)]
                for y,z in [(-width,-height), (width,-height), (width,height), (-width,height)]]
    faces = [(3,2,1,0), (12,13,14,15)]
    for row in range(3):
        faces.extend((row*4+i, row*4+(i+1)%4, (row+1)*4+(i+1)%4, (row+1)*4+i)
                     for i in range(4))
    mesh('War hammer · forged head', vertices, faces, [shadow, steel, edge, brass],
         'Hammer.R', .012, [0,2, 0,1,0,1, 1,0,1,0, 0,1,0,1], collection=hammer)
    return consumption_props(black, brass)


def consumption_props(black, brass):
    flesh = material('Face in the lifted helm', 'bd8063')
    face = plate('Face under the visor', [(-.094,-.148,1.725), (0,-.173,1.746), (.092,-.148,1.725),
                 (.072,-.159,1.576), (0,-.168,1.544), (-.074,-.157,1.578)], .015, flesh, 'Head', .01)
    mouth = plate('Mouth under the visor', [(-.037,-.174,1.604), (.033,-.175,1.605),
                  (.029,-.175,1.584), (-.029,-.175,1.582)], .008, black, 'Head', .004)
    crust = material('Bread crust', 'b96b2d')
    crumb = material('Bread crumb', 'edc483')
    toast = material('Baked bread ridges', 'd58b3f')
    enamel = material('Enamel tankard', '69a8a2', .46, .22)
    inside = material('Inside the tankard', '203f48')
    wrist = Vector(design['Prop.L'][0])
    def rings(levels):
        return [(wrist.z+z, wrist.x+x, wrist.y+y, rx, ry) for z,x,y,rx,ry in levels]

    loaf = profile('Bread roll', rings([(.017,0,-.058,.077,.068), (.051,0,-.060,.123,.091),
                   (.120,0,-.053,.115,.077), (.167,.012,-.042,.065,.047)]),
                   [crust, toast, crumb], 'Prop.L', 10)
    bite = profile('Bitten bread roll', rings([(.020,0,-.060,.075,.064), (.053,0,-.068,.111,.083),
                   (.093,-.010,-.083,.093,.059), (.112,-.021,-.088,.053,.038)]),
                   [crust, toast, crumb], 'Prop.L', 10)
    center_x, center_y = -.022, -.075
    # Double wall and a dark interior make the rim readable when the tankard tilts.
    cup = profile('Enamel tankard · open bowl', rings([
        (.018,center_x,center_y,.077,.073), (.041,center_x,center_y,.093,.088),
        (.184,center_x,center_y,.106,.099), (.218,center_x,center_y,.112,.104),
        (.222,center_x,center_y,.090,.082), (.192,center_x,center_y,.083,.077),
        (.049,center_x,center_y,.067,.064)]), [enamel, enamel, brass, brass, inside, inside], 'Prop.L', 12)
    handle_points = []
    for index in range(10):
        t = index*math.tau/10
        for a in range(6):
            angle = a*math.tau/6
            r = .026*math.cos(angle)
            handle_points.append(tuple(wrist+Vector((-.095+(.060+r)*math.cos(t),
                                 center_y+.026*math.sin(angle), .123+(.076+r)*math.sin(t)))))
    handle_faces = [(i*6+j, ((i+1)%10)*6+j, ((i+1)%10)*6+(j+1)%6, i*6+(j+1)%6)
                    for i in range(10) for j in range(6)]
    handle = mesh('Tankard handle', handle_points, handle_faces, [brass], 'Prop.L', .004)
    ruby = material('Ruby', 'c63f59', .26, .15)
    glint = material('Ruby facets', 'ec8491', .30, .12)
    gem = profile('Ruby · held loot', rings([(-.026,0,-.074,.022,.019), (.008,0,-.08,.068,.046),
                   (.055,0,-.08,.062,.043), (.079,0,-.08,.034,.025)]),
                  [ruby, glint, ruby, glint], 'Prop.L', 8)
    return {'face': (face,mouth), 'bread': (loaf,), 'bite': (bite,), 'cup': (cup,handle), 'ruby': (gem,)}


def scholar_book():
    asset = bpy.data.collections.new('Scholar’s book · reusable prop')
    asset.asset_mark()
    asset.asset_data.description = 'Leather-bound study book, closed and ready to place on shelves or tables'
    leather = material('Book · forest leather', '315d55', .60)
    gold = material('Book · embossed brass', 'bf9861', .46, .18)
    edges = material('Book · parchment edges', 'bd9c73', .70)
    paper = material('Book · cream parchment', 'e7d1a5', .72)
    ink = material('Book · faded ink', '72554b', .78)
    red = material('Book · bookmark ribbon', 'a3484b', .75)

    def hinge(name, height):
        obj = bpy.data.objects.new(name, None)
        asset.objects.link(obj)
        obj.location.z = height
        return obj

    def box(name, at, size, surface, parent=None, bevel=.006, turn=0):
        x,y,z = size
        verts = [(a*x/2,b*y/2,c*z/2) for c in (-1,1) for a,b in ((-1,-1),(1,-1),(1,1),(-1,1))]
        faces = [(3,2,1,0), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        asset.objects.link(obj)
        obj.parent, obj.location, obj.rotation_euler.z = parent, at, turn
        data.materials.append(surface)
        if bevel:
            mod = obj.modifiers.new('Rounded corners', 'BEVEL')
            mod.width, mod.segments = bevel, 2
        return obj

    cover = hinge('Book · cover hinge', .105)
    leaf = hinge('Book · page hinge', .071)
    box('Book · back cover', (.107,0,.013), (.248,.354,.026), leather)
    box('Book · spine', (-.013,0,.053), (.048,.350,.106), leather, bevel=.014)
    for y in (-.113, .113):
        box('Book · raised spine band', (-.014,y,.055), (.050,.018,.108), gold)
    box('Book · front cover', (.108,0,.003), (.248,.354,.025), leather, cover)
    for x in (.014,.202):
        box('Book · cover tooling', (x,0,.016), (.010,.304,.004), gold, cover, .001)
    for y in (-.148,.148):
        box('Book · cover tooling', (.108,y,.016), (.205,.010,.004), gold, cover, .001)
    box('Book · cover emblem', (.108,0,.017), (.069,.069,.006), gold, cover, .006, math.pi/4)
    box('Book · bookmark', (.054,.170,.052), (.023,.063,.007), red, bevel=.002)
    box('Book · sewn page block', (.110,0,.047), (.211,.314,.041), edges)
    for z in (.035,.045,.055,.065):
        box('Book · cut page edges', (.110,0,z), (.214,.316,.003), paper, bevel=.001)
    box('Book · inside cover pages', (.105,0,-.020), (.207,.313,.014), paper, cover, .004)
    box('Book · turning leaf', (.106,0,.004), (.209,.312,.008), paper, leaf, .002)
    for y, width in zip((-.092,-.045,.003,.052,.095),(.133,.165,.150,.165,.107)):
        for parent, z in ((None,.070), (cover,-.028), (leaf,.011), (leaf,-.002)):
            box('Book · ruled ink', (.102,y,z), (width,.011,.002), ink, parent, .001)
    # The decoration is a closed standalone asset. Animate copies of its objects
    # in the held instance while sharing the same mesh and material data.
    for obj in asset.objects:
        if obj == leaf or obj.parent == leaf:
            obj.hide_render = obj.hide_viewport = True
    animated = bpy.data.collections.new('Scholar’s book · reading rig')
    copies = {}
    for obj in asset.objects:
        duplicate = obj.copy()
        animated.objects.link(duplicate)
        copies[obj] = duplicate
    for obj, duplicate in copies.items():
        duplicate.parent = copies.get(obj.parent)
    held = bpy.data.objects.new('Held scholar’s book', None)
    body.objects.link(held)
    held.parent = rig
    held.instance_type = 'COLLECTION'
    held.instance_collection = animated
    return held, copies[cover], copies[leaf], tuple(obj for obj in animated.objects if obj.parent==copies[leaf])


def chest_preview():
    collection = bpy.data.collections.new('Chest · interaction reference')
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new('Chest reference', None)
    collection.objects.link(root)
    root.parent = rig
    hinge = bpy.data.objects.new('Chest lid hinge', None)
    collection.objects.link(hinge)
    hinge.parent = root
    hinge.location = CHEST_HINGE
    oak = material('Chest · weathered oak', '79513d')
    band = material('Chest · brass bands', 'ad8152', .45, .26)

    def box(name, center, size, surface, parent):
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.object
        for owner in tuple(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)
        obj.name, obj.parent, obj.location = name, parent, center
        for vertex in obj.data.vertices:
            for axis in range(3):
                vertex.co[axis] *= size[axis]
        obj.data.materials.append(surface)
        bevel = obj.modifiers.new('Rounded edges', 'BEVEL')
        bevel.width, bevel.segments = .014, 2
        return obj

    center = CHEST_HINGE.y+CHEST_LID_DEPTH/2
    box('Chest floor', (0,center,.035), (.88,.48,.07), oak, root)
    for x in (-.42,.42):
        box('Chest side', (x,center,.27), (.06,.48,.47), oak, root)
    for y in (center-.21,center+.21):
        box('Chest wall', (0,y,.27), (.86,.06,.47), oak, root)
    box('Chest lid', (0,.24,.045), (.9,.50,.09), oak, hinge)
    for x in (-.30,.30):
        box('Lid band', (x,.24,.098), (.07,.51,.025), band, hinge)
        box('Chest band', (x,center+.249,.27), (.07,.02,.46), band, root)
    box('Lid latch', (0,.507,.035), (.12,.03,.11), band, hinge)
    return collection, hinge


def orient(bone, position, rotation):
    anchor = rest[bone][0]
    matrix = Matrix.Translation(position) @ rotation.to_4x4() @ Matrix.Translation(-anchor)
    rig.pose.bones[bone].matrix = matrix @ rig.data.bones[bone].matrix_local
    bpy.context.view_layer.update()


def point(bone, head, tail, stretch=1):
    a, b, _ = rest[bone]
    direction = (b-a).normalized()
    orientation = direction.rotation_difference(Vector(tail)-Vector(head)).to_matrix()
    if stretch != 1:
        extension = Matrix.Identity(3)
        for row in range(3):
            for column in range(3):
                extension[row][column] += (stretch-1)*direction[row]*direction[column]
        orientation @= extension
    orient(bone, head, orientation)


def attached(bone, anchor):
    frame = rig.pose.bones[bone].matrix @ rig.data.bones[bone].matrix_local.inverted()
    return frame @ anchor


def bend_joint(upper, lower, a, end, bias, stretch=1):
    a, end = Vector(a), Vector(end)
    ab = (rest[upper][1] - rest[upper][0]).length
    bc = (rest[lower][1] - rest[lower][0]).length
    delta = end - a
    scale = max(1, min(stretch, (delta.length+.001)/(ab+bc)))
    ab *= scale
    bc *= scale
    axis = delta.normalized()
    distance = max(abs(ab - bc) + .001, min(ab + bc - .001, delta.length))
    offset = (ab*ab - bc*bc + distance*distance) / (2*distance)
    normal = Vector(bias) - axis * axis.dot(Vector(bias))
    knee = a + axis * offset + normal.normalized() * math.sqrt(max(0, ab*ab - offset*offset))
    end = a + axis * distance
    point(upper, a, knee, scale)
    point(lower, knee, end, scale)
    return end


def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3 - 2*t)


def sample(keys, time):
    for (start, *a), (end, *b) in zip(keys, keys[1:]):
        if time <= end:
            blend = smooth((time - start) / (end - start))
            return [x + (y - x)*blend for x, y in zip(a,b)]
    return keys[-1][1:]


def sample_attack(keys, time):
    # Carry speed across successive strike poses. Stop the curve at reversals so
    # the blade never overshoots a loaded guard or the hammer's floor contact.
    def tangent(index, channel):
        if index == 0 or index == len(keys)-1:
            return 0
        before, center, after = keys[index-1:index+2]
        incoming = (center[channel]-before[channel])/(center[0]-before[0])
        outgoing = (after[channel]-center[channel])/(after[0]-center[0])
        return 2*incoming*outgoing/(incoming+outgoing) if incoming*outgoing > 0 else 0

    for index, (a, b) in enumerate(zip(keys, keys[1:])):
        if time <= b[0]:
            interval = b[0]-a[0]
            t = (time-a[0])/interval
            return [x+(y-x)*smooth(t) + interval*t*(1-t)*(
                    (1-t)*tangent(index, channel) - t*tangent(index+1, channel))
                    for channel, (x, y) in enumerate(zip(a[1:], b[1:]), start=1)]
    return keys[-1][1:]


# Time, torso yaw, forward shift, drop, pitch, sword hand target, blade azimuth/elevation.
STEADY = (0, 0, 0, .04, .414, -.168, .924, 24, 16)
# Each guard is shared at the exact exported frames where the combo can chain.
HIGH_GUARD = (.70, .051, .062, -.09, .39, .12, 1.42, 121, 61)
LOW_GUARD = (-.73, -.135, .126, .235, -.246, -.35, .890, -118, -27)
LIGHT_GUARDS = {'down': HIGH_GUARD, 'up': LOW_GUARD}
HEAVY_GUARDS = {
    'sword': (.90, .064, .11, -.149, .421, .172, 1.410, 142, 64),
    'hammer': (.03, .030, -.025, -.115, .137, .004, 1.792, 177, 26),
}
ATTACKS = {
    'down': [
        (0, *STEADY),
        (.15, .30, .060, .038, -.025, .459, .020, 1.093, 66, 35),
        (6/19, *HIGH_GUARD),
        (.39, .80, .048, .025, -.125, .407, -.007, 1.539, 109, 85),
        (.47, .32, -.103, .082, .19, .419, -.500, 1.384, 62, 35),
        (.53, -.39, -.188, .171, .33, .040, -.670, 1.064, -31, -21),
        (.61, -.89, -.179, .169, .31, -.303, -.336, .841, -143, -29),
        (13/19, *LOW_GUARD),
        (.83, -.44, -.088, .055, .15, -.094, -.330, .915, -75, -28),
        (.93, -.14, -.035, .025, .07, .316, -.213, .916, -8, 4),
        (1, *STEADY),
    ],
    'up': [
        (0, *STEADY),
        (.10, -.27, -.073, .063, .115, .078, -.297, .858, -52, -29),
        (4/19, *LOW_GUARD),
        (.29, -.85, -.080, .183, .25, -.306, -.302, .752, -141, -37),
        (.37, -.46, -.153, .121, .27, -.121, -.573, .960, -64, -9),
        (.45, .18, -.191, -.012, .055, .306, -.613, 1.312, 23, 49),
        (.54, .80, -.063, -.036, -.10, .522, -.269, 1.613, 86, 77),
        (.61, .86, .017, .039, -.103, .498, .049, 1.519, 116, 68),
        (13/19, *HIGH_GUARD),
        (.84, .26, .019, .035, .015, .444, -.057, 1.185, 67, 36),
        (1, *STEADY),
    ],
}
for name, (weapon, light) in CHARGE_CLIPS.items():
    ATTACKS[name] = [(0, *LIGHT_GUARDS[light]), (1, *HEAVY_GUARDS[weapon])]

# The sword finishes across the hips, set up for a rising light cut.
# The hammer rebounds into a high guard, ready for a descending light cut.
ATTACKS.update({
    'heavy-sword': [
        (0, *HEAVY_GUARDS['sword']),
        (2/21, 1.06, .014, .053, -.21, .478, .115, 1.573, 151, 66),
        (4/21, .72, -.120, .112, .14, .477, -.310, 1.523, 89, 62),
        (6/21, -.13, -.171, .218, .34, .241, -.695, 1.174, -6, 18),
        (8/21, -.92, -.169, .266, .45, -.276, -.510, .831, -105, -27),
        (11/21, -1.13, -.111, .202, .34, -.330, -.312, .808, -156, -18),
        (16/21, *LOW_GUARD),
        (.89, -.39, -.091, .064, .15, .018, -.298, .908, -63, -18),
        (1, *STEADY),
    ],
    'heavy-hammer': [
        (0, *HEAVY_GUARDS['hammer']),
        (2/21, .05, .018, -.021, -.20, .154, .009, 1.918, 174, 40),
        (3/21, .04, -.030, -.022, -.035, .141, -.121, 1.86, 135, 73),
        (4/21, .03, -.126, -.030, .27, .124, -.440, 1.644, 18, 76),
        (5/21, .01, -.211, .082, .56, .113, -.729, 1.267, 6, 29),
        (6/21, -.02, -.265, .267, .79, .103, -.752, .842, 4, 9),
        (7/21, -.045, -.291, .465, .96, .099, -.643, .272, 0, -8),
        (8/21, -.065, -.314, .421, 1.01, .105, -.635, .332, -2, -9),
        (9/21, -.09, -.311, .370, 1.02, .115, -.625, .379, -4, -11),
        (11/21, -.10, -.266, .348, .84, .132, -.606, .483, 6, -12),
        (13/21, .10, -.137, .296, .47, .190, -.382, .889, 30, 14),
        (14/21, .31, -.057, .174, .19, .289, -.145, 1.188, 62, 45),
        (16/21, *HIGH_GUARD),
        (.90, .29, .020, .032, .02, .459, -.038, 1.105, 56, 32),
        (1, *STEADY),
    ],
    'roll-attack-sword': [
        (0, *STEADY),
        (3/17, -.63, -.170, .235, .37, -.132, -.380, .785, -97, -32),
        (5/17, -.47, -.134, .179, .28, -.080, -.467, .889, -71, -18),
        (7/17, .20, -.193, .066, .10, .304, -.589, 1.267, 19, 43),
        (9/17, .88, -.037, .011, -.11, .495, -.141, 1.533, 112, 73),
        (12/17, *HIGH_GUARD),
        (15/17, .35, -.012, .039, .008, .422, -.007, 1.14, 63, 43),
        (1, *STEADY),
    ],
    'roll-attack-hammer': [
        (0, *STEADY),
        (3/17, .66, -.102, .218, .32, .393, .030, .784, 108, -23),
        (5/17, .56, -.121, .219, .27, .456, -.337, .852, 79, -12),
        (7/17, -.09, -.181, .218, .29, .227, -.614, .857, 8, -8),
        (9/17, -.83, -.153, .228, .32, -.252, -.490, .825, -83, -7),
        (12/17, *LOW_GUARD),
        (15/17, -.35, -.084, .073, .146, -.002, -.273, .898, -68, -15),
        (1, *STEADY),
    ],
})


def gait_foot(phase, stride, stance, clearance, running):
    heel, push = (-9, 36) if running else (-17, 26)
    if phase < stance:
        # The moving body passes over a planted boot at constant speed.
        travel = stride * (phase / stance - .5)
        lift = 0
        pitch, = sample([(0, heel), (.19, 0), (.62, 0), (1, push)], phase/stance)
    else:
        swing = (phase - stance) / (1 - stance)
        if running:
            # Match the planted foot's backward velocity into and out of swing.
            # Let the heel trail after push-off before the knee brings it forward.
            arc = math.sin(math.pi * swing)
            carry = (1 - stance) / (math.tau * stance)
            follow_through = carry*math.sin(math.tau*swing)*(1 - .38*arc)
            progress = smooth(swing) - follow_through - .075*arc**2
            height = arc**1.22 * (1.30 - .60*swing)
            pitch = heel + (push - heel)*(1 - smooth(swing)) + 11*math.sin(math.tau*swing)
        else:
            arc = math.sin(math.pi*swing)
            carry = (1-stance)/(math.tau*stance)
            progress = smooth(swing) - carry*math.sin(math.tau*swing)*(1-.65*arc) - .102*arc**2
            height = arc**1.45 * (.89+.25*swing)
            pitch, = sample([(0, push), (.32, 20), (.55, 5), (.81, -15), (1, heel)], swing)
        travel = stride * (.5 - progress)
        lift = clearance * height
    if running:
        travel += .046
    else:
        travel += WALK_FOOT_CENTER
    return travel, lift, math.radians(pitch)


def place_foot(side, sign, travel, lift, pitch, width=0, splay=1, sidestep=0):
    boot = 'Boot.' + side
    ankle = rest[boot][0]
    rotation = Euler((pitch, 0, sign * .10 * splay)).to_matrix()
    lowest = min((rotation @ (p - ankle)).z for p in soles[side])
    target = Vector((ankle.x + sign * width + sidestep, travel, .012 + lift - lowest))
    hip = attached('Hips', rest['Thigh.' + side][0])
    end = bend_joint('Thigh.' + side, 'Shin.' + side, hip, target, (sign * .12 * splay, -1, .03))
    orient(boot, end, rotation)


def blade_vector(azimuth, elevation):
    yaw, pitch = math.radians(azimuth), math.radians(elevation)
    return Vector((math.sin(yaw)*math.cos(pitch), -math.cos(yaw)*math.cos(pitch), math.sin(pitch)))


def pulse(t, start, peak, end):
    return smooth((t-start)/(peak-start))*smooth((end-t)/(end-peak))


def attack_deformation(kind, t):
    if kind == 'down':
        return pulse(t, .326, .438, .545), pulse(t, .47, .559, .68)
    if kind == 'up':
        return pulse(t, .35, .49, .655), pulse(t, .216, .306, .415)
    if kind == 'heavy-sword':
        return pulse(t, 0, .20, .385), pulse(t, .246, .415, .724)
    if kind == 'heavy-hammer':
        return pulse(t, 0, .138, .28), pulse(t, .27, .415, .69)
    if kind == 'roll-attack-sword':
        return pulse(t, .24, .47, .66), pulse(t, .09, .23, .40)
    if kind == 'roll-attack-hammer':
        return pulse(t, .22, .385, .55), pulse(t, .14, .28, .66)
    return 0, 0


HAMMER_LIGHT_CONTACT = {
    'down': [(0, .32, -.86, -.40), (8/19, .32, -.86, -.40),
             (9/19, -.45, -.61, -.66), (10/19, -.80, .28, -.53), (1, -.80, .28, -.53)],
    'up': [(0, .47, -.66, .59), (7/19, .47, -.66, .59), (8/19, .76, .02, .65),
           (9/19, .49, .63, .60), (1, .49, .63, .60)],
    'roll-attack-hammer': [(0, 0, -1, 0), (5/17, 0, -1, 0), (7/17, -.7,-.7,0),
                           (9/17, -1,.22,0), (1, -1,.22,0)],
}


def orient_hammer(wrist, shaft, kind=None, t=0):
    a, b, _ = rest['Hammer.R']
    rest_shaft = (b-a).normalized()
    # Set the resting grip a quarter turn around the haft, before aiming the poll.
    grip_twist = Matrix.Rotation(math.pi/2, 3, rest_shaft)
    rotation = rest_shaft.rotation_difference(shaft).to_matrix() @ grip_twist
    face = rotation @ rest_shaft.cross(Vector((0,0,1))).normalized()
    if kind == 'heavy-hammer':
        weight = pulse(t, .11, 7/21, .72)
        toward = Vector((0, -.05, -1))
    elif kind in HAMMER_LIGHT_CONTACT:
        start, full = {'down': (.33,.414), 'up': (.229,.358),
                       'roll-attack-hammer': (.19,.276)}[kind]
        weight = smooth((t-start)/(full-start))*smooth((.676-t)/.137)
        toward = Vector(sample(HAMMER_LIGHT_CONTACT[kind],t))
    else:
        weight = 0
    if weight:
        striking_face = toward - shaft*shaft.dot(toward)
        if striking_face.length_squared > .001:
            angle = math.atan2(shaft.dot(face.cross(striking_face)), face.dot(striking_face))
            orient('Hammer.R', wrist, Matrix.Rotation(angle*weight, 3, shaft) @ rotation)
            return
    orient('Hammer.R', wrist, rotation)


def attack_step(kind, t, front):
    motion = ATTACK_MOTION[kind]
    start, end = motion['advance']
    root_travel = motion['distance']*smooth((t-start)/(end-start))
    if kind == 'heavy-sword':
        start, end, lift = (.035, .245, .075) if front else (.228, .55, .067)
    elif kind == 'heavy-hammer':
        # Throw the body's weight past the feet. The hammer lands before the
        # lead boot catches the body, then the trailing boot comes underneath.
        start, end, lift = (.136, .388, .150) if front else (.173, .507, .202)
    else:
        start, end, lift = (.045, .31, .073) if front else (.41, .70, .058)
    step = max(0, min(1, (t-start)/(end-start)))
    travel = root_travel - motion['distance']*smooth(step)
    if kind == 'heavy-hammer':
        if front:
            reach = .30*pulse(t, .218, .402, .668)
        else:
            reach, = sample([(0, 0), (.28, 0), (8/21, -.044),
                             (9/21, .25), (10/21, .29), (.695, 0), (1, 0)], t)
        travel -= reach
    return travel, lift*math.sin(math.pi*step)**2


def trail_mantle(chest_rotation, lift, sway, yaw):
    # Set the clearance in chest space so leaning or banking never pushes the
    # hanging fabric into the armor. Keep the flutter relative to the shoulders.
    anchor = attached('Chest', rest['Mantle'][0]) + chest_rotation @ Vector((0, .035, 0))
    orient('Mantle', anchor, chest_rotation @ Euler((lift, sway, yaw)).to_matrix())


def pose(kind, t):
    phase = math.tau*t
    step = math.cos(phase)
    gait = GAITS.get(kind)
    running = kind == 'sprint'
    attacking = kind in ATTACKS
    attack_keys = ATTACKS.get(kind)
    twist, forward, drop, pitch, hx, hy, hz, yaw, elev = sample_attack(attack_keys, t) if attacking else STEADY
    stretch, squash = attack_deformation(kind, t)
    double_grip = 0
    if kind == 'heavy-hammer':
        double_grip = 1-smooth((t-.532)/.223)
    elif kind.startswith('charge-hammer-'):
        double_grip = smooth(t)
    if gait:
        stride, stance, clearance, lean = gait
        half_step = (t % .5)*2
        if running:
            # Carry the hips through toe-off, then let the chest and head follow.
            suspension = math.cos(math.tau*(half_step-.86))
            bob, nod = sample([(0, .012, .010), (.23, -.053, .053), (.55, .009, .008),
                               (.84, .055, -.020), (1, .012, .010)], half_step)
            shift = .023
            fore = -.132 - .019*math.cos(math.tau*(half_step-.73))
            drop = .178
            pelvic_yaw = .118*math.cos(phase+.13)
            chest_yaw = -.157*math.cos(phase-.42)
            yaw, elev = 20, 7
        else:
            bob, nod = sample([(0, -.010, .005), (.22, -.016, .007), (.53, .022, -.004),
                               (.70, .027, -.008), (1, -.010, .005)], half_step)
            shift, fore, drop = .040, .048, .073
            pelvic_yaw = .112*math.cos(phase-.13)
            chest_yaw = -.049*math.cos(phase-.32)
            yaw, elev = 21, 13
        # At mid-stance the pelvis shifts towards the actual loaded foot.
        hips = rest['Hips'][0] + Vector((-shift*math.sin(phase-.12), fore, -drop+bob))
        pitch = lean + nod
    else:
        breath = .008*math.sin(phase) if kind == 'idle' else 0
        hips = rest['Hips'][0] + Vector((-.041*twist, forward, -.035-drop+breath))
        pelvic_yaw, chest_yaw = twist*.62, twist
    hip_roll = (.032 if running else .038)*math.sin(phase-.1) if gait else -.035*twist
    hip_pitch = pitch*(.39 if gait else .32)
    orient('Hips', hips, Euler((hip_pitch, hip_roll, pelvic_yaw)).to_matrix())
    chest = attached('Hips', rest['Chest'][0])
    chest_roll = -(.047 if running else .019)*math.sin(phase-.36) if gait else -.10*twist
    chest_rotation = Euler((pitch, chest_roll, chest_yaw)).to_matrix()
    spine_height = 1 + .185*stretch - .22*squash
    spine_width = 1 + .12*squash - .07*stretch
    orient('Chest', chest, chest_rotation @ Matrix.Diagonal((spine_width, spine_width, spine_height)))
    head = attached('Chest', rest['Head'][0])
    if running:
        head.z -= .007*suspension
        head_rotation = Euler((pitch*.84 - .012, chest_roll*.64, chest_yaw*.67))
    else:
        head_rotation = Euler((pitch*.33, .012*step if gait else 0, chest_yaw*.33))
    orient('Head', head, head_rotation.to_matrix())

    if running:
        lift = .15 + .061*math.sin(phase-.7) + .026*math.sin(2*phase-1.1)
        trail_mantle(chest_rotation, lift, .041*math.sin(phase-.8), -.24*chest_yaw)
    else:
        mantle = attached('Chest', rest['Mantle'][0])
        flutter = .042 + .034*math.sin(phase-.7) if gait else .08 + .17*abs(twist)
        sway = .067*math.sin(phase-.8) if gait else .27*twist
        orient('Mantle', mantle, Euler((flutter, sway, chest_yaw*.76)).to_matrix())

    for side, sign in reversed(SIDES):
        if gait:
            foot_phase = (t+(0 if sign<0 else .5))%1
            travel, lift, foot_pitch = gait_foot(foot_phase, stride, stance, clearance, running)
            width = -.032 if running else -.067
        elif attacking:
            # Keep the feet paired with the torso pose at both combo handoffs.
            travel, lift, width = sign*.08, 0, .05*abs(twist)
            if kind in ATTACK_MOTION:
                offset, lift = attack_step(kind, t, sign < 0)
                travel += offset
            foot_pitch = .18*smooth(-forward/.15) if sign > 0 else 0
        else:
            travel, lift, foot_pitch, width = sign*.08, 0, 0, 0
        place_foot(side, sign, travel, lift, foot_pitch, width, splay=.5 if kind == 'walk' else 1)

        arm = 'Arm.'+side
        shoulder = attached('Chest', rest[arm][0])
        if gait:
            # The wrist trails the leg rhythm, with a softer elbow on the free side.
            swing = math.cos(phase-.49)
            if sign>0:
                reach = .108 if running else .040
                offset = (.065, -.173-reach*swing, (-.344 if running else -.405)+.035*swing)
                blade_lag = math.cos(phase-.71) if running else swing
                yaw += (6 if running else 3)*blade_lag
                elev += (10 if running else 3)*blade_lag
            else:
                reach = .285 if running else .098
                drive = .084*(1 - math.cos(phase-.58)) if running else .020*max(0, -swing)
                offset = (-.053, -.048+reach*swing, (-.385 if running else -.412)+drive)
            wrist = shoulder + Vector(offset)
        elif sign>0:
            wrist = (hx, hy, hz)
        else:
            ready = abs(twist)
            wrist = (-.402+.10*ready, -.085-.17*ready, .898+.19*ready)
            wrist = Vector(wrist) + Vector((-.137*stretch, .12*stretch, .035*squash))
            if double_grip:
                wrist = wrist.lerp(grip_wrist - blade*.185, double_grip)
        extension = 1 + .21*stretch + .085*squash + .22*double_grip
        wrist = bend_joint(arm, 'Forearm.' + side, shoulder, wrist, (sign*.50, .78, -.09), extension)

        # A pauldron is strapped to the cuirass and only follows part of the arm swing.
        arm_delta = rig.pose.bones[arm].matrix @ rig.data.bones[arm].matrix_local.inverted()
        follow = .36 if attacking else .20 if running else .13 if gait else .15
        armor_rotation = chest_rotation.to_quaternion().slerp(arm_delta.to_quaternion(), follow)
        orient('Pauldron.'+side, shoulder, armor_rotation.to_matrix())

        if sign>0:
            blade = blade_vector(yaw, elev)
            grip_wrist = wrist
            hand = Vector((-.16*blade.y, -.53, -.68)) + blade*.28
            point('Glove.' + side, wrist, wrist + hand)
            point('Grip.R', wrist, wrist + blade)
            orient_hammer(wrist, blade, kind, t)
        else:
            lag = .08*math.sin(phase-.72) if gait else 0
            hand = Vector((-.012, -.047+lag*.16, -.098))
            if double_grip:
                hand = hand.lerp(Vector((.045, -.073, -.053)) + blade*.035, double_grip)
            point('Glove.' + side, wrist, wrist + hand)


def pose_snapshot():
    return [bone.matrix_basis.copy() for bone in rig.pose.bones]


# Torso pitch, head pitch, shoulder turn, left wrist target, prop tilt, mouth contact.
CONSUMPTION_POSES = {
    'eat': [
        (0, .04,.013,0, -.402,-.085,.898,0,0),
        (.14, .14,.29,-.12, -.417,.048,.833,9,0),
        (.26, .11,.21,-.13, -.396,-.146,1.019,-12,0),
        (.39, .075,.13,-.08, -.306,-.343,1.235,-20,.20),
        (.49, .137,.33,.015, -.139,-.260,1.381,12,1),
        (.53, .148,.37,.022, -.122,-.270,1.371,9,1),
        (.60, .074,.16,-.043, -.246,-.267,1.285,-11,.39),
        (.66, .032,.02,-.05, -.32,-.229,1.137,-6,0),
        (.71, .083,.18,-.055, -.341,-.218,1.087,7,0),
        (.75, .031,-.035,-.04, -.354,-.216,1.036,-9,0),
        (.81, .072,.144,-.025, -.373,-.174,.970,10,0),
        (.88, .031,-.025,-.02, -.397,-.104,.903,4,0),
        (1, .04,.013,0, -.402,-.085,.898,0,0)
    ],
    'drink': [
        (0, .04,.013,0, -.402,-.085,.898,0,0),
        (.13, .121,.276,-.12, -.428,.044,.836,6,0),
        (.25, .085,.185,-.13, -.399,-.159,1.047,-7,0),
        (.39, -.019,-.11,-.072, -.281,-.324,1.310,-24,.49),
        (.48, -.136,-.343,-.020, -.175,-.312,1.470,-56,1),
        (.56, -.197,-.49,-.008, -.132,-.346,1.517,-78,1),
        (.625, -.150,-.40,-.008, -.132,-.346,1.491,-69,1),
        (.695, -.221,-.58,.014, -.132,-.346,1.526,-88,1),
        (.75, -.126,-.31,-.011, -.190,-.371,1.432,-67,.79),
        (.835, .037,.14,-.106, -.327,-.257,1.164,-22,0),
        (.928, .118,.21,-.096, -.406,-.111,.900,-6,0),
        (1, .04,.013,0, -.402,-.085,.898,0,0)
    ],
}


def visor_open(t):
    return smooth((t-.127)/.20)*smooth((.974-t)/.14)


def consumption_pose(kind, t, phase=None):
    if phase is None:
        pose('idle', 0)
    else:
        gait_pose('walk', phase)
    if t in (0, 1):
        return
    lean, nod, twist, x, y, z, tilt, touch = sample_attack(CONSUMPTION_POSES[kind],t)
    chest_rotation = Euler((lean, .022*math.sin(t*math.tau), twist)).to_matrix()
    orient('Chest', attached('Hips', rest['Chest'][0]), chest_rotation)
    head_rotation = Euler((nod, -.047*math.sin(t*math.pi), twist*.68)).to_matrix()
    orient('Head', attached('Chest', rest['Head'][0]), head_rotation)
    visor = Matrix.Rotation(math.radians(-92)*visor_open(t), 3, 'X')
    orient('Visor', attached('Head', rest['Visor'][0]), head_rotation @ visor)

    prop_rotation = Euler((math.radians(tilt), -.05, twist*.50)).to_matrix()
    lip = Vector((-.022,.019,.222)) if kind == 'drink' else Vector((.004,.016,.138))
    mouth = attached('Head', fitted((-.012,-.177,1.596),'Head'))
    wrist = Vector((x,y,z)).lerp(mouth-prop_rotation@lip, touch)
    shoulder = attached('Chest', rest['Arm.L'][0])
    wrist = bend_joint('Arm.L', 'Forearm.L', shoulder, wrist, (-.71,.41,-.29), 1.13)
    point('Glove.L', wrist, wrist+prop_rotation@Vector((.020,-.075,-.018)))
    orient('Prop.L', wrist, prop_rotation)
    arm_delta = rig.pose.bones['Arm.L'].matrix @ rig.data.bones['Arm.L'].matrix_local.inverted()
    orient('Pauldron.L', shoulder, chest_rotation.to_quaternion().slerp(arm_delta.to_quaternion(), .25).to_matrix())

    relax = smooth(t/.27)*smooth((1-t)/.20)
    shoulder = attached('Chest', rest['Arm.R'][0])
    wrist = Vector((.414,-.168,.924)).lerp(Vector((.449,-.051,.816)),relax)
    wrist = bend_joint('Arm.R', 'Forearm.R', shoulder, wrist, (.5,.78,-.09))
    blade = blade_vector(24+24*relax, 16-45*relax)
    point('Glove.R', wrist, wrist+Vector((-.16*blade.y,-.53,-.68))+blade*.28)
    point('Grip.R', wrist, wrist+blade)
    orient_hammer(wrist,blade)


def prop_visibility(kind, t):
    visible = set()
    if kind in ('pickup', 'pickup-crouched') and INTERACTIONS['pickup']['event'] <= t < .84:
        visible.add('ruby')
    if kind == 'knowledge' and .14 <= t < .95:
        visible.add('book')
    kind = kind.removesuffix('-walk')
    if kind in CONSUMPTION:
        if visor_open(t) > .32:
            visible.add('face')
        if kind == 'eat' and .24 <= t < .80:
            visible.add('bread' if t < .53 else 'bite')
        if kind == 'drink' and .24 <= t < .91:
            visible.add('cup')
    return visible


def blend_pose(source, target, weight):
    for bone, a, b in zip(rig.pose.bones, source, target):
        bone.matrix_basis = a.lerp(b, weight)
    bpy.context.view_layer.update()


def gait_pose(kind, phase):
    if kind in GAITS:
        pose(kind, phase)
    else:
        weight = GAIT_BLENDS[kind]
        pose('walk', phase)
        walk = pose_snapshot()
        pose('sprint', phase)
        blend_pose(walk, pose_snapshot(), weight)
        # Keep the boots planted at the blended cadence even as the torso changes pose.
        walk_stride, walk_stance, walk_lift, _ = GAITS['walk']
        run_stride, run_stance, run_lift, _ = GAITS['sprint']
        stance = walk_stance + (run_stance-walk_stance)*weight
        travel = walk_stride/walk_stance*(1-weight) + run_stride/run_stance*weight
        stride = travel*stance
        clearance = walk_lift + (run_lift-walk_lift)*weight
        for side, sign in SIDES:
            foot_phase = (phase + (0 if sign < 0 else .5)) % 1
            slow = gait_foot(foot_phase, stride, stance, clearance, False)
            fast = gait_foot(foot_phase, stride, stance, clearance, True)
            y, lift, pitch = (a+(b-a)*weight for a, b in zip(slow, fast))
            place_foot(side, sign, y, lift, pitch, -.067+.035*weight, splay=.5+.5*weight)


def roll_pose(t):
    if t in (0, 1):
        pose('idle', 0)
        return
    # The free arm receives the dive before the weight moves across the back.
    reach, tuck, foot_forward, fold, clearance = sample([
        (0, 0, 0, 0, 0, 0),
        (.10, .32, .25, -.15, .16, 0),
        (.22, .94, .12, .24, .09, .1),
        (.30, 1, .31, .21, .28, 0),
        (.38, .66, .60, .04, .55, 0),
        (.46, .12, .91, -.04, .83, 0),
        (.59, 0, 1, -.09, .88, 0),
        (.70, 0, .78, -.24, .65, 0),
        (.82, .26, .60, -.16, .32, 0),
        (.94, .13, .25, -.02, .11, 0),
        (1, 0, 0, 0, 0, 0),
    ], t)
    shoulder_load = smooth((t-.23)/.16)*(1 - smooth((t-.58)/.20))
    pivot = rest['Hips'][0] + Vector((0, 0, -.035))
    orient('Hips', pivot, Euler((.065*fold, 0, .04*shoulder_load)).to_matrix())
    chest = attached('Hips', rest['Chest'][0])
    chest_rotation = Euler((.04 + .67*fold, .09*shoulder_load, .15*shoulder_load)).to_matrix()
    orient('Chest', chest, chest_rotation)
    chin = smooth((t-.29)/.115)*(1 - smooth((t-.57)/.21))
    head = attached('Chest', rest['Head'][0]).lerp(chest + Vector((.085, .085, .129)), .92*chin)
    orient('Head', head, Euler((.013 + 1.42*chin, -.08*shoulder_load, 0)).to_matrix())
    mantle = attached('Chest', rest['Mantle'][0])
    mantle_rotation = Euler((.08 + .80*fold + .50*reach, -.17*shoulder_load, .07*shoulder_load))
    orient('Mantle', mantle, mantle_rotation.to_matrix())

    draw_in = smooth(t/.20)*(1 - smooth((t-.77)/.23))
    blade = blade_vector(24 + 89*draw_in, 16 + 11*draw_in)
    for side, sign in SIDES:
        boot = 'Boot.' + side
        ankle = rest[boot][0]
        # Fold the ankles toward the pelvis during inversion, then bring them under it.
        target = Vector((ankle.x + sign*.025*tuck,
                         sign*(.080 - .023*tuck) + foot_forward - .23*tuck,
                         .012 + ankle.z - min(p.z for p in soles[side]) + .57*tuck))
        foot_rotation = Euler((.76*tuck - .19*foot_forward, 0, sign*.10)).to_matrix()
        hip = attached('Hips', rest['Thigh.' + side][0])
        foot = bend_joint('Thigh.' + side, 'Shin.' + side, hip, target, (sign*.20, -1, .04))
        orient(boot, foot, foot_rotation)

        arm = 'Arm.' + side
        shoulder = attached('Chest', rest[arm][0])
        if sign < 0:
            wrist = Vector((-.402 + .074*reach, -.085 - .49*reach + .030*fold,
                            .898 + .53*reach + .20*fold))
            direction = Vector((-.012, -.047-.53*reach, -.098+.34*reach))
        else:
            wrist = Vector((.414-.026*reach, -.168-.24*reach-.08*fold, .924+.26*reach+.27*fold))
            direction = Vector((-.16*blade.y, -.53, -.68)) + blade*.28
        wrist = bend_joint(arm, 'Forearm.' + side, shoulder, wrist, (sign*.61, .68, -.16))
        arm_rotation = rig.pose.bones[arm].matrix @ rig.data.bones[arm].matrix_local.inverted()
        pad = chest_rotation.to_quaternion().slerp(arm_rotation.to_quaternion(), .26)
        orient('Pauldron.' + side, shoulder, pad.to_matrix())
        point('Glove.' + side, wrist, wrist + direction)
        if sign > 0:
            point('Grip.R', wrist, wrist + blade)

    # Bank about the lead shoulder and fit the lowest part of the pose to the floor.
    turn = Euler((math.tau*smooth(t), -.49*shoulder_load, .045*shoulder_load)).to_matrix()
    lowest = math.inf
    for bone, vertices in contact_mesh.items():
        if bone == 'Mantle':
            continue
        delta = rig.pose.bones[bone].matrix @ rig.data.bones[bone].matrix_local.inverted()
        lowest = min(lowest, min((turn @ (delta @ v - pivot)).z for v in vertices))
    advance = -.11*reach + .06*fold
    displacement = Vector((-.028*shoulder_load, advance, .012 + clearance - lowest))
    root = Matrix.Translation(displacement) @ turn.to_4x4() @ Matrix.Translation(-pivot)
    rig.pose.bones['Hips'].matrix = root @ rig.pose.bones['Hips'].matrix
    bpy.context.view_layer.update()

    fold_mantle_at_floor()
    wrist = rig.pose.bones['Grip.R'].head.copy()
    blade = turn @ blade
    # Keep the drawn sword close to the right side and above the floor during the turn.
    lower_limit = -max(0, wrist.z-.042)/.885
    if blade.z < lower_limit:
        flat = Vector((blade.x, blade.y, 0)).normalized()
        blade = flat*math.sqrt(1 - lower_limit**2) + Vector((0, 0, lower_limit))
    point('Grip.R', wrist, wrist + blade)
    orient_hammer(wrist, blade)

    edge = min(t/.105, (1-t)/.135)
    if edge < 1:
        roll = pose_snapshot()
        pose('idle', 0)
        blend_pose(pose_snapshot(), roll, smooth(edge))
        ground_roll_edge()


def fold_mantle_at_floor():
    bone = rig.pose.bones['Mantle']
    anchor = bone.head.copy()
    delta = bone.matrix @ rig.data.bones['Mantle'].matrix_local.inverted()
    offsets = [delta @ vertex - anchor for vertex in contact_mesh['Mantle']]
    floor = .024 - anchor.z
    if min(v.z for v in offsets) >= floor:
        return
    # Fold the hem about its shoulder attachment when it reaches the floor.
    lo, hi = 0, 2.15
    for _ in range(12):
        angle = (lo+hi)/2
        pivot = Matrix.Rotation(-angle, 3, 'X')
        if min((pivot @ v).z for v in offsets) < floor:
            lo = angle
        else:
            hi = angle
    orient('Mantle', anchor, Matrix.Rotation(-hi, 3, 'X') @ delta.to_3x3())


def ground_roll_edge():
    lowest = math.inf
    for side, _ in SIDES:
        name = 'Boot.'+side
        delta = rig.pose.bones[name].matrix @ rig.data.bones[name].matrix_local.inverted()
        lowest = min(lowest, min((delta @ p).z for p in soles[side]))
    if lowest < .012:
        root = rig.pose.bones['Hips']
        root.matrix = Matrix.Translation((0, 0, .012-lowest)) @ root.matrix
        bpy.context.view_layer.update()


def vault_pose(t):
    if t == 0:
        gait_pose('sprint', 0)
        return
    if t == 1:
        gait_pose('sprint', VAULT['exitPhase'])
        return

    # Hips rise while the chest banks toward the supporting hand.
    height, forward, side, pitch, bank = sample([
        (0, -.171,-.13,0,.50,0), (.17,-.105,-.192,.015,.68,-.085),
        (.295,.084,-.162,.065,.96,-.31), (6/18,.167,-.151,.073,.966,-.39),
        (.43,.19,-.113,.094,.98,-.47),
        (.55,.204,-.087,.088,.91,-.53), (.65,.18,-.051,.104,.66,-.26),
        (.80,.033,-.079,.041,.46,-.06), (1,-.171,-.13,0,.50,0),
    ],t)
    hips = rest['Hips'][0] + Vector((side,forward,height))
    orient('Hips',hips,Euler((pitch*.36,bank*.43,-bank*.26)).to_matrix())
    chest = attached('Hips',rest['Chest'][0])
    torso = Euler((pitch,bank,-bank*.18)).to_matrix()
    orient('Chest',chest,torso)
    orient('Head',attached('Chest',rest['Head'][0]),Euler((pitch*.44,bank*.27,0)).to_matrix())
    trail_mantle(torso, .12+.22*math.sin(t*math.pi), -.08*bank, .11*bank)

    # Reach the far side with two tucked boots, then extend the leading leg.
    leg_paths = {
        'L': [(0,-.29,0,-9,0), (.18,.28,.09,27,.08), (.31,.27,.76,35,.24),
              (.41,.13,.95,14,.35), (.55,-.06,1.02,-14,.34), (.67,-.32,.92,-24,.26),
              (.78,-.355,.34,-21,.115), (.87,-.26,0,-14,.027), (1,.10,.17,19,0)],
        'R': [(0,.15,.14,15,0), (.19,.45,.08,36,.02), (.32,.36,.81,36,.17),
              (.43,.24,1.02,22,.26), (.56,.14,1.08,6,.30), (.68,-.05,.99,-8,.22),
              (.80,.026,.53,16,.13), (.89,.058,.25,24,.053), (1,-.39,0,-9,0)]
    }
    for side_name, sign in SIDES:
        travel,lift,angle,shift = sample(leg_paths[side_name],t)
        place_foot(side_name,sign,travel,lift,math.radians(angle),-.027,sidestep=shift)

    # Use the same forward displacement as the browser. The planted hand slides
    # a short distance across the lid as the hips travel past it.
    for (before, start), (after, end) in zip(VAULT['path'],VAULT['path'][1:]):
        if t <= after:
            progress = start+(end-start)*(t-before)/(after-before)
            break
    root = VAULT['start']+(VAULT['end']-VAULT['start'])*progress
    skim = -.21+.33*smooth((t-.32)/.29)
    support = smooth((t-.245)/.10)*smooth((.72-t)/.13)
    catch = Vector((-.268,root-skim,VAULT['height']+.083))
    wrist = Vector(sample([(0,-.34,-.12,.99), (.25,-.44,-.49,.94),
                           (.55,-.49,-.23,.98), (.79,-.41,.17,1.06),
                           (1,-.37,-.11,.98)],t)).lerp(catch,support)
    shoulder = attached('Chest',rest['Arm.L'][0])
    wrist = bend_joint('Arm.L','Forearm.L',shoulder,wrist,(-.62,.64,.05),1.075)
    point('Glove.L',wrist,wrist+Vector((-.025,-.084,-.048)))
    orient('Pauldron.L',shoulder,torso)

    shoulder = attached('Chest',rest['Arm.R'][0])
    offset = Vector(sample([(0,.059,-.19,-.36),(.28,.18,.02,-.32),
                            (.55,.24,.09,-.37),(.75,.17,-.09,-.38),
                            (1,.059,-.19,-.36)],t))
    wrist = bend_joint('Arm.R','Forearm.R',shoulder,shoulder+offset,(.5,.78,-.09))
    yaw,elev = sample([(0,21,7),(.28,55,24),(.56,78,26),(.75,49,17),(1,21,7)],t)
    blade = blade_vector(yaw,elev)
    point('Glove.R',wrist,wrist+Vector((-.16*blade.y,-.53,-.68))+blade*.28)
    point('Grip.R',wrist,wrist+blade)
    orient_hammer(wrist,blade)
    orient('Pauldron.R',shoulder,torso)

    # Preserve cadence at both ends of the maneuver.
    blend = min(t/.19,(1-t)/.18)
    if blend < 1:
        airborne = pose_snapshot()
        phase = t*.9 if t<.5 else (VAULT['exitPhase']-(1-t)*.6)%1
        gait_pose('sprint',phase)
        blend_pose(pose_snapshot(),airborne,smooth(blend))
        ground_roll_edge()


def lower_body(drop, fore, lean, bank=0, turn=0):
    hips = rest['Hips'][0] + Vector((0, fore, -drop))
    orient('Hips', hips, Euler((lean*.37, bank*.30, turn*.55)).to_matrix())
    torso = Euler((lean, bank, turn)).to_matrix()
    orient('Chest', attached('Hips', rest['Chest'][0]), torso)
    trail_mantle(torso, .045, -.14*bank, -.20*turn)
    return torso


def reach_arm(side, sign, wrist_goal, finger_direction, torso):
    shoulder = attached('Chest', rest['Arm.'+side][0])
    wrist = bend_joint('Arm.'+side, 'Forearm.'+side, shoulder, wrist_goal, (sign*.83, .45, -.24), 1.08)
    point('Glove.'+side, wrist, wrist+Vector(finger_direction))
    arm = rig.pose.bones['Arm.'+side].matrix @ rig.data.bones['Arm.'+side].matrix_local.inverted()
    orient('Pauldron.'+side, shoulder, torso.to_quaternion().slerp(arm.to_quaternion(), .30).to_matrix())
    return wrist


def grip_weapon(wrist, yaw, elevation):
    shaft = blade_vector(yaw, elevation)
    point('Grip.R', wrist, wrist+shaft)
    orient_hammer(wrist, shaft)


def crouch_pose(phase=None, breath=0):
    cycle = 0 if phase is None else phase*math.tau
    swing = 0 if phase is None else math.sin(cycle)
    bob = .003*math.sin(breath*math.tau) if phase is None else .020*math.cos(2*cycle+.55)
    torso = lower_body(.365-bob, .063, .59 if phase is not None else .53, -.045*swing, .08*swing)
    orient('Head', attached('Chest', rest['Head'][0]), Euler((.17, .025*swing, .035*swing)).to_matrix())
    for side, sign in SIDES:
        if phase is None:
            travel, lift, pitch = sign*.075+.028, 0, 0
        else:
            travel, lift, pitch = gait_foot((phase+(0 if sign<0 else .5))%1, .39, .64, .058, False)
            travel -= .077
            pitch *= .57
        place_foot(side, sign, travel, lift, pitch, .013)
        stagger = sign*.084*swing
        wrist = reach_arm(side, sign, (sign*.34,-.322+stagger,.71+sign*.032*swing),
                          (0,-.72,-.40), torso)
        if sign > 0:
            grip_weapon(wrist, 24-6*swing, 9+7*swing)


def crouch_transition(kind, t):
    if kind in CROUCH_EXITS:
        crouch_pose(CROUCH_EXITS[kind]+.12*t)
        source = pose_snapshot()
        pose('idle', 0)
    else:
        if kind in CROUCH_ENTRIES:
            gait_pose('sprint', (CROUCH_ENTRIES[kind]+.16*t)%1)
        else:
            pose('idle', 0)
        source = pose_snapshot()
        crouch_pose()
    blend_pose(source, pose_snapshot(), smooth(t))
    ground_roll_edge()


def chest_lid(t):
    return sample([(0,0),(.42,0),(.52,.36),(.59,.76),(.68,1.64),(.77,1.45),(1,1.48)],t)[0]


def read_book(t):
    pose('idle', 0)
    base = pose_snapshot()
    read = smooth((t-.26)/.16)*smooth((.94-t)/.13)
    lean = .055+.085*read
    torso = Euler((lean, .018*read, -.043*read)).to_matrix()
    orient('Chest', attached('Hips', rest['Chest'][0]), torso)
    trail_mantle(torso, .025, 0, 0)
    nod = .16+.23*read+.043*math.sin(t*math.tau*3)*read
    orient('Head', attached('Chest', rest['Head'][0]), Euler((nod, .035*read, -.04*read)).to_matrix())
    center = Vector(sample([
        (0,-.41,.02,.85),(.14,-.38,.015,.88),(.24,-.20,-.32,1.09),
        (.36,-.114,-.395,1.155),(.53,-.095,-.379,1.139),(.70,-.111,-.398,1.17),
        (.84,-.126,-.368,1.15),(.95,-.39,.007,.89),(1,-.41,.02,.85),
    ],t))
    pitch, bank, yaw = sample([(0,.68,-.88,.15),(.23,-.22,-.31,.06),
                               (.38,-.17,-.12,.02),(.80,-.20,-.10,.04),(1,.68,-.88,.15)],t)
    orientation = Euler((pitch, bank, yaw))
    space = orientation.to_matrix()
    book.location, book.rotation_euler = center, orientation
    cover_angle = -math.pi*.972*read
    cover.rotation_euler.y = cover_angle
    cover.location.z = .105-.031*read

    turn = next(((t-start)/(stop-start) for start,stop in ((.445,.565),(.635,.755)) if start<=t<stop), None)
    turning = turn is not None
    leaf.rotation_euler.y = -math.pi*smooth(turn) if turning else 0
    for obj in leaves:
        obj.hide_render = obj.hide_viewport = not turning
    reach_arm('L', -1, center+space@Vector((-.096,.069,-.028)), space@Vector((.48,-.55,.31)), torso)

    rest_hand = Vector((.418,.065,.887))
    reading_hand = center+space@Vector((.235,.071,.090))
    assist = smooth((t-.20)/.075)*smooth((.92-t)/.095)
    if turning:
        # The fingers push the outer corner up, then the page settles by itself.
        follow = 1-smooth((turn-.56)/.43)
        pivot = Matrix.Rotation(max(leaf.rotation_euler.y, -1.63), 3, 'Y')
        edge = Vector((0,0,.071))+pivot@Vector((.199,.078,.024))
        reading_hand = reading_hand.lerp(center+space@edge, follow)
    elif .26 <= t <= .41 or .82 <= t <= .93:
        pivot = Matrix.Rotation(max(cover_angle,-1.33), 3, 'Y')
        edge = Vector((0,0,cover.location.z))+pivot@Vector((.211,.090,.018))
        follow = smooth((t-.26)/.045)*smooth((.41-t)/.05) if t<.5 else smooth((t-.82)/.035)
        reading_hand = reading_hand.lerp(center+space@edge, follow)
    wrist = reach_arm('R', 1, rest_hand.lerp(reading_hand,assist), (-.42,-.52,-.42), torso)
    stow = smooth((t-.07)/.12)*smooth((1-t)/.12)
    grip_weapon(wrist.lerp(rest_hand,stow), 25+125*stow, 12-46*stow)
    blend_pose(base, pose_snapshot(), smooth(t/.13)*smooth((1-t)/.105))


def interaction_pose(kind, t, crouched):
    if crouched:
        crouch_pose()
    else:
        pose('idle',0)
    if t in (0, 1):
        return
    base = pose_snapshot()
    if kind == 'chest':
        drop, fore, lean, nod = sample([
            (0,.18,-.025,.15,.10), (.25,.42,-.016,.55,.61), (.40,.445,-.088,.64,.63),
            (.54,.435,-.125,.70,.48), (.62,.368,-.104,.73,.27), (.73,.39,-.027,.31,.39),
            (1,.18,.037,.14,.08)], t)
    else:
        drop, fore, lean, nod = sample([
            (0,.15,.03,.13,.11), (.28,.43,-.020,.73,.74), (.46,.572,-.151,1.02,.81),
            (.58,.46,-.075,.79,.56), (.78,.20,.025,.28,.21), (1,.13,.03,.10,.10)], t)
    if crouched:
        drop = max(drop, .30)
    twist = (0 if kind == 'chest' else -.13)*math.sin(math.pi*t)
    torso = lower_body(drop, fore, lean, .30*twist, twist)
    orient('Head', attached('Chest', rest['Head'][0]), Euler((nod, .25*twist, twist*.8)).to_matrix())
    for side, sign in SIDES:
        foot = sign*.105-.04*math.sin(math.pi*t) if kind != 'chest' else sign*.058
        place_foot(side, sign, foot, 0, 0, .025)

    for side, sign in SIDES:
        fingers = (0,-.57,-.54)
        if kind == 'chest':
            start = Vector((sign*.35,-.18,.77))
            if sign > 0:
                start = Vector((.40,.03,.65))
            lift = Matrix.Rotation(chest_lid(min(t,.59)), 3, 'X')
            lip = CHEST_HINGE+lift@Vector((sign*.258,CHEST_LID_DEPTH,.065))
            weight = smooth((t-.23)/.15)*smooth((.78-t)/.185)
            unit = lift@Vector((0,-.96,-.20))
            wrist_goal = start.lerp(lip-.070*unit, weight)
            fingers = Vector(fingers).lerp(unit, weight)
        elif sign > 0:
            wrist_goal = (.405,.014,.57)
        else:
            wrist_goal = sample([
                (0,-.35,-.14,.82),(.32,-.30,-.38,.39),(.46,-.105,-.56,.087),
                (.58,-.16,-.53,.262),(.71,-.23,-.33,.61),(.84,-.37,-.035,.67),(1,-.36,-.11,.79)],t)
            fingers = (0,-.71,-.67+.60*smooth((t-.46)/.20))
        wrist = reach_arm(side, sign, wrist_goal, fingers, torso)
        if sign > 0:
            if kind == 'chest':
                stow = smooth((t-.14)/.15)*smooth((.88-t)/.15)
                grip_weapon(wrist.lerp(Vector((.42,.09,.67)),stow), 25+125*stow, 12-46*stow)
            else:
                grip_weapon(wrist, 31, -15)
        else:
            orient('Prop.L', wrist, Euler((.18*math.sin(math.pi*t),0,0)).to_matrix())
    weight = smooth(t/.21)*smooth((1-t)/.18)
    blend_pose(base, pose_snapshot(), weight)
    ground_roll_edge()


def animation_pose(kind, frame, count):
    rig.pose.bones['Visor'].matrix_basis = Matrix.Identity(4)
    rig.pose.bones['Prop.L'].matrix_basis = Matrix.Identity(4)
    interaction = kind.removesuffix('-crouched')
    if kind == 'knowledge':
        read_book(frame/(count-1))
        return
    if interaction in CROUCHED_INTERACTIONS:
        interaction_pose(interaction, frame/(count-1), interaction != kind)
        return
    if kind == 'crouch-idle' or kind == 'sneak':
        crouch_pose(breath=frame/count) if kind == 'crouch-idle' else crouch_pose(frame/count)
        return
    if kind == 'crouch-down' or kind in CROUCH_ENTRIES or kind in CROUCH_EXITS:
        crouch_transition(kind, frame/(count-1))
        return
    consume = kind.removesuffix('-walk')
    if consume in CONSUMPTION:
        phase = frame/count*CONSUMPTION[consume][1]/WALK_CYCLE % 1 if consume != kind else None
        consumption_pose(consume, frame/(count-1), phase)
        return
    if kind == 'vault':
        vault_pose(frame/(count-1))
        return
    if kind in VAULT_ENTRIES:
        step = frame+1
        gait_pose('sprint',(VAULT_ENTRIES[kind]+step/16)%1)
        entry = pose_snapshot()
        vault_pose(step/(VAULT_FRAMES-1))
        blend_pose(entry,pose_snapshot(),smooth(step/3))
        ground_roll_edge()
        return
    if kind in ROLL_ENTRIES:
        stride, phase = ROLL_ENTRIES[kind]
        step = frame + 1
        gait_pose(stride, (phase + step/16) % 1)
        source = pose_snapshot()
        roll_pose(step/(ROLL_FRAMES-1))
        blend_pose(source, pose_snapshot(), smooth(step/3))
        ground_roll_edge()
    elif kind in ROLL_EXITS:
        index = ROLL_RECOVERY + frame + 1
        roll_pose(index/(ROLL_FRAMES-1))
        source = pose_snapshot()
        gait_pose(ROLL_EXITS[kind], ((index-ROLL_FRAMES+1)/16) % 1)
        blend_pose(source, pose_snapshot(), smooth((frame+1)/5))
        ground_roll_edge()
    elif kind in ROLL_ATTACK_LANDINGS:
        roll_pose((ROLL_RECOVERY+frame)/(ROLL_FRAMES-1))
        if frame:
            source = pose_snapshot()
            pose(ROLL_ATTACK_LANDINGS[kind], frame/(ROLL_ATTACK_FRAMES-1))
            blend_pose(source, pose_snapshot(), smooth(frame/(count-1)))
            ground_roll_edge()
    elif kind in ROLL_ATTACK_GAITS:
        attack, gait, phase = ROLL_ATTACK_GAITS[kind]
        step = frame+1
        gait_pose(gait, (phase+step/16)%1)
        source = pose_snapshot()
        pose(attack, step/(ROLL_ATTACK_FRAMES-1))
        blend_pose(source, pose_snapshot(), smooth(step/3))
        ground_roll_edge()
    elif kind == 'roll':
        roll_pose(frame/(count-1))
    elif kind in ROLL_ATTACKS and frame in (0,count-1):
        pose('idle', 0)
    elif kind in GAIT_BLENDS or kind in GAITS:
        gait_pose(kind, frame/count)
    else:
        pose(kind, frame/(count if kind == 'idle' else count-1))


def light(name, color, energy, position, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.color, data.energy, data.shape, data.size = color, energy, 'DISK', size
    lamp = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(lamp)
    lamp.location = position
    lamp.rotation_euler = (Vector((0,0,1.1)) - lamp.location).to_track_quat('-Z','Y').to_euler()


def setup(engine):
    scene = bpy.context.scene
    scene.render.engine = engine
    if engine == 'CYCLES':
        scene.cycles.samples = 32
        scene.cycles.max_bounces = 3
        scene.cycles.use_denoising = False
    else:
        scene.eevee.taa_render_samples = 12
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = scene.render.resolution_y = CELL
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.fps = 24
    scene.world = bpy.data.worlds.new('Cool ambient fill')
    scene.world.color = (.15,.15,.15)
    scene.view_settings.view_transform = 'AgX'
    lamp_settings = [
        ('Torch key', (1,.82,.65), 370, (-3,-4,5.5), 3.3),
        ('Slate fill', (.65,.79,1), 220, (3,-1,3), 3.5),
        ('Silver rim', (.90,.94,1), 410, (1,3,4), 2.4),
    ]
    for args in lamp_settings:
        light(*args)
    data = bpy.data.cameras.new('Fixed gameplay lens')
    cam = bpy.data.objects.new('Fixed gameplay lens', data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    data.type = 'ORTHO'
    data.ortho_scale = 3.23
    data.lens = 50
    cam.location = (0,-5.8,4.1)
    cam.rotation_euler = (Vector((0,0,1.01)) - cam.location).to_track_quat('-Z','Y').to_euler()
    return scene


def key_animations(scene, clips):
    clips_by_frame = []
    layout = {}
    for kind, count in clips:
        start = len(clips_by_frame)+1
        layout[kind] = [start-1, count]
        scene.timeline_markers.new(kind.title(), frame=start)
        rotations = {}
        for frame in range(count):
            index = start+frame
            scene.frame_set(index)
            animation_pose(kind, frame, count)
            if kind == 'knowledge':
                for obj in (book, cover):
                    obj.keyframe_insert(data_path='location',frame=index)
                    obj.keyframe_insert(data_path='rotation_euler',frame=index)
                leaf.keyframe_insert(data_path='rotation_euler',frame=index)
                for obj in leaves:
                    for flag in ('hide_render','hide_viewport'):
                        obj.keyframe_insert(data_path=flag,frame=index)
            visible = prop_visibility(kind, frame/(count-1))
            chest_visible = kind in ('chest', 'chest-crouched')
            for obj in chest_collection.objects:
                obj.hide_render = obj.hide_viewport = not chest_visible
                for flag in ('hide_render','hide_viewport'):
                    obj.keyframe_insert(data_path=flag,frame=index)
            lid.rotation_euler.x = chest_lid(frame/(count-1)) if chest_visible else 0
            lid.keyframe_insert(data_path='rotation_euler',frame=index)
            for group, objects in props.items():
                for obj in objects:
                    obj.hide_render = obj.hide_viewport = group not in visible
                    for flag in ('hide_render','hide_viewport'):
                        obj.keyframe_insert(data_path=flag,frame=index)
            for bone in rig.pose.bones:
                rotation = bone.rotation_quaternion
                if bone.name in rotations:
                    if rotation.dot(rotations[bone.name]) < 0:
                        rotation.negate()
                rotations[bone.name] = rotation.copy()
                bone.keyframe_insert(data_path='location', frame=index)
                bone.keyframe_insert(data_path='rotation_quaternion', frame=index)
                bone.keyframe_insert(data_path='scale', frame=index)
            clips_by_frame.append((kind,index))
    scene.frame_end = len(clips_by_frame)
    scene.frame_set(1)
    return clips_by_frame, layout


def export(scene, frames, directory, preview):
    layer = bpy.context.view_layer.layer_collection
    layer.children[chest_collection.name].exclude = True
    body_layer = layer.children[body.name]
    for part, weapon in [('body', None), ('weapon', 'sword'), ('hammer', 'hammer')]:
        # Only weapon pixels unobstructed by the body reach the weapon layers.
        body_layer.holdout = weapon is not None
        for name, collection in weapon_collections.items():
            layer.children[collection.name].exclude = name != weapon
        for facing in range(FACINGS):
            if preview and facing not in (0, 1, 2):
                continue
            rig.rotation_euler.z = math.pi/2 - facing*math.pi/4
            for row, (kind, frame) in enumerate(frames):
                if preview and kind.removesuffix('-walk') not in (
                        'walk', 'sprint', 'gait-one', 'gait-two', 'roll', 'sneak',
                        *CHARGE_CLIPS, *HEAVY_CLIPS, *ROLL_ATTACKS, *CONSUMPTION, *INTERACTIONS, 'vault'):
                    continue
                if weapon and kind in CHARGE_CLIPS and CHARGE_CLIPS[kind][0] != weapon:
                    continue
                if weapon and kind in HEAVY_CLIPS and HEAVY_CLIPS[kind] != weapon:
                    continue
                if weapon and kind.startswith('roll-attack-') and not kind.startswith(f'roll-attack-{weapon}'):
                    continue
                scene.frame_set(frame)
                path = directory / f'{part}-{facing}-{row}.png'
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    arguments = argparse.ArgumentParser()
    arguments.add_argument('--output', type=Path, required=True)
    arguments.add_argument('--engine', default='CYCLES')
    arguments.add_argument('--preview', action='store_true')
    opts = arguments.parse_args(sys.argv[sys.argv.index('--') + 1:])
    directory = opts.output.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = bpy.data.collections.new('Guardian armor and body')
    weapon_collections = {'sword': bpy.data.collections.new('Grip.R · Longsword'),
                          'hammer': bpy.data.collections.new('Grip.R · War hammer')}
    for collection in (body, *weapon_collections.values()):
        bpy.context.scene.collection.children.link(collection)
    design, soles = model_joints(), {}
    rig, rest = create_rig(design)
    props = model()
    book, cover, leaf, leaves = scholar_book()
    props['book'] = (book,)
    chest_collection, lid = chest_preview()
    bpy.context.view_layer.objects.active = rig
    temporary = {obj for objects in props.values() for obj in objects}
    contact_mesh = {}
    for obj in body.objects:
        if obj in temporary:
            continue
        bone = 'Head' if obj.parent_bone == 'Visor' else obj.parent_bone
        contact_mesh.setdefault(bone, []).extend(v.co.copy() for v in obj.data.vertices)
    scene = setup(opts.engine)
    frames, layout = key_animations(scene, CLIPS)
    (directory/'clips.json').write_text(json.dumps(layout) + '\n')
    hammer_motion = ATTACK_MOTION['heavy-hammer']
    scene.frame_set(layout['heavy-hammer'][0] + hammer_motion['impactFrame'] + 1)
    hammer_head = bpy.data.objects['War hammer · forged head']
    face = [hammer_head.matrix_world @ vertex.co for vertex in hammer_head.data.vertices[-4:]]
    contact = sum(face, Vector())/len(face)
    hammer_motion['floorContact'] = [contact.x, -contact.y]
    scene.frame_set(1)
    (directory/'attack-motion.json').write_text(json.dumps(ATTACK_MOTION) + '\n')
    (directory/'vault.json').write_text(json.dumps(VAULT) + '\n')
    (directory/'interactions.json').write_text(json.dumps(INTERACTIONS) + '\n')
    durations = {name: duration for name, (_, duration) in CONSUMPTION.items()}
    (directory/'consumption.json').write_text(json.dumps({'walkCycle': WALK_CYCLE, 'durations': durations}) + '\n')
    bpy.context.view_layer.layer_collection.children[weapon_collections['hammer'].name].exclude = True
    rig.rotation_euler.z = math.pi/4
    rig.select_set(False)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'guardian.blend'), compress=True)
    print('GROUND_PIVOT', tuple(world_to_camera_view(scene, scene.camera, Vector((0,0,0)))), flush=True)
    export(scene, frames, directory, opts.preview)
