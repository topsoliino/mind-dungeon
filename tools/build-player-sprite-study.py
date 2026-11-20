"""Build an editable Blender character and export the comparison sprite sheet.

Run from the repository root:
  blender -b --factory-startup -t 4 -P tools/build-player-sprite-study.py -- --output /tmp/player-study

The comparison page uses a WebP copy of guardian-atlas.png to reduce transfer size.
Convert the PNG with Pillow at quality 89, preserving its RGBA channels.
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector


CLIPS = [('idle', 4), ('walk', 16), ('dash', 8), ('attack', 20), ('backhand', 20)]
CELL = 128
FACINGS = 8
ATLAS_COLUMNS = 24
STANCE = .48
STRIDE = .68
SIDES = [('L', -1), ('R', 1)]


def fitted(vertex, bone):
    """Fit the armor and its attachment points to the same compact silhouette."""
    x, y, z = vertex
    if bone == 'Sword':
        grip = design['Sword'][0]
        return fitted(grip, 'Glove.R') + Vector(vertex) - Vector(grip)
    if bone == 'Head':
        return Vector((x * .97, y, 1.427 + (z - 1.49) * .96))
    if bone in ('Chest', 'Mantle'):
        return Vector((x * 1.13, y * 1.045, z - .062))
    if bone.startswith(('Arm.', 'Forearm.', 'Glove.')):
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


def mesh(name, vertices, faces, mats, bone, bevel=.006, indices=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([fitted(vertex, bone) for vertex in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
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


def limb(name, a, b, widths, mats, bone, sides=8):
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
    return mesh(name, vertices, faces, mats, bone, indices=indices)


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
            'Forearm.' + side: (elbow, wrist, 'Arm.' + side),
            'Glove.' + side: (wrist, (wrist[0], wrist[1], wrist[2] - .09), 'Forearm.' + side),
            'Thigh.' + side: (hip, knee, 'Hips'),
            'Shin.' + side: (knee, ankle, 'Thigh.' + side),
            'Boot.' + side: (ankle, (ankle[0], -.14, .06), 'Shin.' + side),
        })
    wrist = joints['Glove.R'][0]
    joints['Sword'] = (wrist, (wrist[0] + .20, wrist[1] - .53, wrist[2] + .19), 'Glove.R')
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
        profile('Segmented pauldron ' + side, [
                (1.303, sign * .316, .006, .091, .102), (1.39, sign * .309, -.002, .131, .124),
                (1.452, sign * .285, .007, .130, .122), (1.493, sign * .27, .009, .095, .098)],
                [shadow, steel, edge], bone)
        plate('Pauldron plate ' + side, [(sign * .19, -.082, 1.497), (sign * .32, -.120, 1.487),
              (sign * .425, -.087, 1.408), (sign * .329, -.116, 1.354), (sign * .217, -.112, 1.401)],
              .029, edge, bone, .008)
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
    a, end, _ = design['Sword']
    grip = Vector(a)
    d = (Vector(end) - grip).normalized()
    u = d.cross(Vector((0, 0, 1))).normalized()
    v = d.cross(u)
    grip_end = grip + d * .107
    limb('Leather-wrapped sword grip', grip - d*.092, grip_end, [(0,.031,.033), (.2,.025,.027),
         (.82,.023,.024), (1,.027,.027)], [leather, brass, shadow], 'Sword')
    limb('Swept bronze crossguard', grip_end - u*.136, grip_end + u*.136, [
         (0,.022,.025), (.17,.036,.027), (.48,.033,.029), (.83,.036,.027), (1,.022,.025)],
         [shadow, brass, brass], 'Sword')
    vertices = []
    for distance, width in [(.112,.047), (.207,.060), (.699,.051), (.885,.001)]:
        center = grip + d*distance
        vertices.extend([tuple(center + u*width), tuple(center+v*.012), tuple(center-u*width), tuple(center-v*.012)])
    faces = [(row*4+i, row*4+(i+1)%4, (row+1)*4+(i+1)%4, (row+1)*4+i)
             for row in range(3) for i in range(4)]
    mesh('Longsword · four facets', vertices, faces, [shadow, steel, blade], 'Sword', .002,
         [2, 1, 0, 1] * 3)


def orient(bone, position, rotation):
    anchor = rest[bone][0]
    matrix = Matrix.Translation(position) @ rotation.to_4x4() @ Matrix.Translation(-anchor)
    rig.pose.bones[bone].matrix = matrix @ rig.data.bones[bone].matrix_local
    bpy.context.view_layer.update()


def point(bone, head, tail):
    a, b, _ = rest[bone]
    orientation = (b - a).rotation_difference(Vector(tail) - Vector(head)).to_matrix()
    orient(bone, head, orientation)


def attached(bone, anchor):
    frame = rig.pose.bones[bone].matrix @ rig.data.bones[bone].matrix_local.inverted()
    return frame @ anchor


def bend_joint(upper, lower, a, end, bias):
    a, end = Vector(a), Vector(end)
    ab = (rest[upper][1] - rest[upper][0]).length
    bc = (rest[lower][1] - rest[lower][0]).length
    delta = end - a
    axis = delta.normalized()
    distance = max(abs(ab - bc) + .001, min(ab + bc - .001, delta.length))
    offset = (ab*ab - bc*bc + distance*distance) / (2*distance)
    normal = Vector(bias) - axis * axis.dot(Vector(bias))
    knee = a + axis * offset + normal.normalized() * math.sqrt(max(0, ab*ab - offset*offset))
    end = a + axis * distance
    point(upper, a, knee)
    point(lower, knee, end)
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


# Time, torso yaw, forward shift, drop, pitch, sword hand target, blade azimuth/elevation.
STEADY = (0, 0, 0, .04, .414, -.168, .924, 24, 16)
ATTACKS = {
    'attack': [
        (0, *STEADY),
        (.16, .34, .055, .036, -.03, .481, .035, 1.135, 89, 40),
        (.31, .56, .067, .055, -.07, .546, .098, 1.291, 112, 52),
        (.39, .53, .042, .048, -.05, .523, .062, 1.294, 110, 49),
        (.50, -.14, -.133, .084, .23, .315, -.468, 1.193, 32, 8),
        (.61, -.63, -.168, .112, .25, -.161, -.405, 1.018, -81, -22),
        (.74, -.46, -.136, .092, .18, -.171, -.385, .965, -94, -26),
        (.91, -.12, -.044, .026, .08, .319, -.244, .921, -8, 8),
        (1, *STEADY),
    ],
    'backhand': [
        (0, *STEADY),
        (.14, -.24, -.036, .064, .11, .143, -.312, .874, -43, -23),
        (.31, -.54, .025, .082, .07, -.155, -.303, .865, -105, -29),
        (.39, -.56, .002, .089, .11, -.139, -.305, .891, -103, -25),
        (.51, .15, -.113, .072, .24, .139, -.465, 1.115, -18, 22),
        (.63, .58, -.101, .023, .10, .438, -.182, 1.415, 75, 55),
        (.77, .37, -.092, .027, .045, .461, -.139, 1.344, 76, 48),
        (.94, .064, -.018, .019, .04, .401, -.186, .976, 31, 21),
        (1, *STEADY),
    ],
}
BOOT_ROLL = [(0, -12), (.11, 0), (.35, 0), (STANCE, 25), (.68, 10), (.85, -14), (1, -12)]


def running_foot(phase):
    if phase < STANCE:
        # The moving body passes over a planted boot at constant speed.
        travel = STRIDE * (phase / STANCE - .5)
        lift = 0
    else:
        swing = (phase - STANCE) / (1 - STANCE)
        travel = STRIDE * (.5 - smooth(swing))
        lift = .145 * math.sin(math.pi * swing)**1.25
    pitch, = sample(BOOT_ROLL, phase)
    return travel, lift, math.radians(pitch)


def place_foot(side, sign, travel, lift, pitch, width=0):
    boot = 'Boot.' + side
    ankle = rest[boot][0]
    rotation = Euler((pitch, 0, sign * .10)).to_matrix()
    lowest = min((rotation @ (p - ankle)).z for p in soles[side])
    target = Vector((ankle.x + sign * width, travel, .012 + lift - lowest))
    hip = attached('Hips', rest['Thigh.' + side][0])
    end = bend_joint('Thigh.' + side, 'Shin.' + side, hip, target, (sign * .12, -1, .03))
    orient(boot, end, rotation)


def blade_vector(azimuth, elevation):
    yaw, pitch = math.radians(azimuth), math.radians(elevation)
    return Vector((math.sin(yaw)*math.cos(pitch), -math.cos(yaw)*math.cos(pitch), math.sin(pitch)))


def pose(kind, t):
    phase = math.tau*t
    step = math.cos(phase)
    run = kind == 'walk'
    dodge = math.sin(math.pi*t) if kind == 'dash' else 0
    attacking = kind in ATTACKS
    twist, forward, drop, pitch, hx, hy, hz, yaw, elev = sample(ATTACKS[kind], t) if attacking else STEADY
    if run:
        # Left/right weight transfer, opposing pelvis and chest rotation, and
        # a rise between strides. The head stabilizes above the moving chest.
        hips = rest['Hips'][0] + Vector((.033*math.sin(phase), -.039, -.079 + .026*math.cos(2*phase+.7)))
        pelvic_yaw = .12*step
        chest_yaw, pitch = -.205*step, .17+.025*math.sin(2*phase)
        hx, hy, hz = .413+.027*step, -.212-.13*step, .965+.045*step
        yaw, elev = 27+7*step, 12+7*step
    else:
        breath = .008*math.sin(phase) if kind == 'idle' else 0
        hips = rest['Hips'][0] + Vector((-.034*twist, forward-.071*dodge, -.035-drop-.12*dodge+breath))
        pelvic_yaw, chest_yaw = twist*.62, twist
        pitch += .25*dodge
        if dodge:
            hx, hy, hz = .44, -.13+.19*dodge, .91-.045*dodge
            yaw, elev = 66+48*dodge, 9
    orient('Hips', hips, Euler((pitch*.32, .055*step if run else -.035*twist, pelvic_yaw)).to_matrix())
    chest = attached('Hips', rest['Chest'][0])
    orient('Chest', chest, Euler((pitch, -.035*step if run else -.10*twist, chest_yaw)).to_matrix())
    head = attached('Chest', rest['Head'][0])
    orient('Head', head, Euler((pitch*.41, .019*step if run else 0, chest_yaw*.37)).to_matrix())

    mantle = attached('Chest', rest['Mantle'][0])
    flutter = .16+.071*math.sin(phase-.7) if run else .08 + .17*abs(twist) + .33*dodge
    orient('Mantle', mantle, Euler((flutter, .09*math.sin(phase-.8) if run else .27*twist, chest_yaw*.76)).to_matrix())

    for side, sign in SIDES:
        if run:
            travel, lift, foot_pitch = running_foot((t+(0 if sign<0 else .5))%1)
            width = -.016
        elif attacking:
            lead = -1 if kind == 'attack' else 1
            advance = smooth((t-.29)/.19) * (1-smooth((t-.77)/.23))
            moving = sign == lead
            travel = sign*.08 + advance*(-.23 if moving else .06)
            lift = .074 * (math.sin(math.pi*advance)**2) if moving else 0
            foot_pitch = .17 * advance if not moving else -.11 * (math.sin(math.pi*advance)**2)
            width = advance*.055
        else:
            travel, lift, foot_pitch = sign*(.08+.31*dodge), .05*dodge*(1+sign), .09*dodge*sign
            width = .035*dodge
        place_foot(side, sign, travel, lift, foot_pitch, width)

        shoulder = attached('Chest', rest['Arm.' + side][0])
        if sign>0:
            wrist = (hx, hy, hz)
        elif run:
            wrist = (-.402+.032*step, -.054+.246*step, .904+max(0, .093*step))
        else:
            ready = abs(twist)
            wrist = (-.402+.10*ready, -.085-.17*ready-.16*dodge, .898+.19*ready+.11*dodge)
        wrist = bend_joint('Arm.' + side, 'Forearm.' + side, shoulder, wrist, (sign*.50, .78, -.09))
        if sign>0:
            blade = blade_vector(yaw, elev)
            # The glove rotates with the grip, so the sword stays in the hand in the cut.
            hand = Vector((-.16*blade.y, -.53, -.68)) + blade*.28
            point('Glove.' + side, wrist, wrist + hand)
            point('Sword', wrist, wrist + blade)
        else:
            point('Glove.' + side, wrist, wrist + Vector((-.012, -.047, -.098)))


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
    for kind, count in clips:
        start = len(clips_by_frame)+1
        scene.timeline_markers.new(kind.title(), frame=start)
        for frame in range(count):
            index = start+frame
            scene.frame_set(index)
            looping = kind in ('idle','walk')
            pose(kind, frame/(count if looping else count-1))
            for bone in rig.pose.bones:
                bone.keyframe_insert(data_path='location', frame=index)
                bone.keyframe_insert(data_path='rotation_quaternion', frame=index)
                bone.keyframe_insert(data_path='scale', frame=index)
            clips_by_frame.append((kind,index))
    scene.frame_end = len(clips_by_frame)
    scene.frame_set(1)
    return clips_by_frame


def export(scene, frames, directory, preview):
    rows = math.ceil(len(frames) * FACINGS / ATLAS_COLUMNS)
    atlas = None if preview else np.zeros((rows*CELL, ATLAS_COLUMNS*CELL, 4), dtype=np.float32)
    for facing in range(FACINGS):
        if preview and facing not in (0, 1, 6):
            continue
        # 0 is right; increasing directions follow the 2D bank clockwise.
        rig.rotation_euler.z = math.pi/2 - facing*math.pi/4
        for row, (kind, frame) in enumerate(frames):
            if preview and kind == 'dash':
                continue
            scene.frame_set(frame)
            path = directory / f'{facing}-{row}.png'
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            if preview:
                continue
            image = bpy.data.images.load(str(path), check_existing=False)
            pixels = np.empty(CELL*CELL*4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            bpy.data.images.remove(image)
            y, x = divmod(row * FACINGS + facing, ATLAS_COLUMNS)
            y = rows - 1 - y
            atlas[y*CELL:(y+1)*CELL, x*CELL:(x+1)*CELL] = pixels.reshape(CELL,CELL,4)
    if atlas is not None:
        image = bpy.data.images.new('Guardian sheet', width=ATLAS_COLUMNS*CELL, height=rows*CELL, alpha=True)
        image.colorspace_settings.name = 'sRGB'
        image.pixels.foreach_set(atlas.reshape(-1))
        image.file_format = 'PNG'
        image.filepath_raw = str(directory/'guardian-atlas.png')
        image.save()


if __name__ == '__main__':
    arguments = argparse.ArgumentParser()
    arguments.add_argument('--output', type=Path, required=True)
    arguments.add_argument('--engine', default='CYCLES')
    arguments.add_argument('--preview', action='store_true')
    opts = arguments.parse_args(sys.argv[sys.argv.index('--') + 1:])
    directory = opts.output.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    design, soles = model_joints(), {}
    rig, rest = create_rig(design)
    model()
    scene = setup(opts.engine)
    frames = key_animations(scene, CLIPS)
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
