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
    'heavy-hammer': {'distance': .32, 'advance': [.10, .35], 'impactFrame': 7},
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
         *((name, 2) for name in ROLL_ATTACK_GAITS)]
SIDES = [('L', -1), ('R', 1)]


def fitted(vertex, bone):
    """Fit the armor and its attachment points to the same compact silhouette."""
    x, y, z = vertex
    if bone in ('Grip.R', 'Hammer.R'):
        grip = design['Grip.R'][0]
        return fitted(grip, 'Glove.R') + Vector(vertex) - Vector(grip)
    if bone == 'Head':
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
          (-.051, -.156, 1.55), (-.115, -.133, 1.617)], .04, steel, 'Head', .01)
    plate('Visor slit', [(-.105, -.145, 1.736), (0, -.170, 1.739), (.105, -.145, 1.736),
          (.091, -.153, 1.705), (0, -.175, 1.71), (-.091, -.153, 1.705)], .012, black, 'Head')
    plate('Raised brow', [(-.12, -.141, 1.759), (0, -.176, 1.765), (.12, -.141, 1.759),
          (.10, -.154, 1.74), (0, -.178, 1.745), (-.10, -.154, 1.74)], .02, edge, 'Head')
    plate('Visor center ridge', [(-.012, -.179, 1.743), (.011, -.179, 1.743), (.021, -.181, 1.595),
          (0, -.184, 1.572), (-.021, -.181, 1.595)], .02, edge, 'Head')
    for x in (-.071, -.038, .038, .071):
        plate('Visor vent', [(x - .006, -.161, 1.665), (x + .006, -.161, 1.667),
              (x + .007, -.163, 1.625), (x - .007, -.163, 1.623)], .007, black, 'Head')
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
        (2/21, .05, .016, -.065, -.20, .154, .006, 1.891, 174, 40),
        (4/21, .03, -.084, .035, .17, .144, -.421, 1.655, 11, 67),
        (5/21, .01, -.155, .174, .43, .132, -.665, 1.211, 6, 25),
        (7/21, -.04, -.183, .475, .69, .101, -.558, .323, 0, -8),
        (8/21, -.07, -.198, .484, .72, .107, -.555, .347, -2, -10),
        (9/21, -.09, -.204, .479, .73, .114, -.551, .398, -4, -13),
        (12/21, -.09, -.114, .319, .42, .146, -.491, .683, 9, -4),
        (14/21, .32, -.019, .166, .11, .295, -.131, 1.179, 62, 45),
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
    return travel, lift, math.radians(pitch)


def place_foot(side, sign, travel, lift, pitch, width=0, splay=1):
    boot = 'Boot.' + side
    ankle = rest[boot][0]
    rotation = Euler((pitch, 0, sign * .10 * splay)).to_matrix()
    lowest = min((rotation @ (p - ankle)).z for p in soles[side])
    target = Vector((ankle.x + sign * width, travel, .012 + lift - lowest))
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
        return pulse(t, 0, .107, .26), pulse(t, .24, .387, .666)
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
    rotation = rest_shaft.rotation_difference(shaft)
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
            orient('Hammer.R', wrist, Matrix.Rotation(angle*weight, 3, shaft) @ rotation.to_matrix())
            return
    orient('Hammer.R', wrist, rotation.to_matrix())


def attack_step(kind, t, front):
    motion = ATTACK_MOTION[kind]
    start, end = motion['advance']
    root_travel = motion['distance']*smooth((t-start)/(end-start))
    if kind == 'heavy-sword':
        start, end, lift = (.035, .245, .075) if front else (.228, .55, .067)
    else:
        start, end, lift = (.045, .31, .073) if front else (.41, .70, .058)
    step = max(0, min(1, (t-start)/(end-start)))
    travel = root_travel - motion['distance']*smooth(step)
    return travel, lift*math.sin(math.pi*step)**2


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
            shift, fore, drop = .040, .027, .061
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

    mantle = attached('Chest', rest['Mantle'][0])
    if gait:
        flutter = (.40 if running else .042) + (.079 if running else .034)*math.sin(phase-.7)
        if running:
            flutter += .045*math.sin(2*phase-1.1)
    else:
        flutter = .08 + .17*abs(twist)
    orient('Mantle', mantle, Euler((flutter, .067*math.sin(phase-.8) if gait else .27*twist, chest_yaw*.76)).to_matrix())

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


def animation_pose(kind, frame, count):
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
                if preview and kind not in ('walk', 'sprint', 'gait-one', 'gait-two', 'roll',
                                           *CHARGE_CLIPS, *HEAVY_CLIPS, *ROLL_ATTACKS):
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
    model()
    contact_mesh = {}
    for obj in body.objects:
        bone = obj.parent_bone
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
