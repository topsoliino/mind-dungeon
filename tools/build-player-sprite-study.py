"""Build an editable Blender character and export the comparison sprite sheet.

Run from the repository root:
  blender -b --factory-startup -t 4 -P tools/build-player-sprite-study.py -- --output /tmp/player-study

The comparison page uses a WebP copy of guardian-atlas.png to reduce transfer size.
Convert the PNG with Pillow at quality 92, preserving its RGBA channels.
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector


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
    data.from_pydata(vertices, [], faces)
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


def create_rig():
    joints = {
        'Hips': ((0, 0, .97), (0, 0, 1.19), None),
        'Chest': ((0, 0, 1.16), (0, 0, 1.51), 'Hips'),
        'Head': ((0, 0, 1.49), (0, 0, 1.86), 'Chest'),
        'Mantle': ((0, .13, 1.43), (0, .25, .95), 'Chest'),
    }
    for side, sign in [('L', -1), ('R', 1)]:
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
    armature = bpy.data.armatures.new('Guardian skeleton')
    actor = bpy.data.objects.new('Guardian rig', armature)
    bpy.context.collection.objects.link(actor)
    bpy.context.view_layer.objects.active = actor
    actor.select_set(True)
    actor.show_in_front = True
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in joints.items():
        bone = armature.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return actor, joints


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

    for side, sign in [('L', -1), ('R', 1)]:
        bone = 'Arm.' + side
        shoulder, elbow, _ = rest[bone]
        wrist = rest['Glove.' + side][0]
        limb('Padded upper arm ' + side, shoulder, elbow, [(0, .097, .097), (.5, .093, .088), (1, .059, .062)],
             [joint, shadow], bone)
        profile('Segmented pauldron ' + side, [
                (1.303, sign * .307, .006, .100, .099), (1.39, sign * .302, -.002, .136, .122),
                (1.463, sign * .274, .007, .136, .131), (1.523, sign * .25, .009, .095, .101)],
                [shadow, steel, edge], bone)
        plate('Pauldron plate ' + side, [(sign * .19, -.082, 1.497), (sign * .32, -.120, 1.487),
              (sign * .425, -.087, 1.408), (sign * .329, -.116, 1.354), (sign * .217, -.112, 1.401)],
              .029, edge, bone, .008)
        limb('Vambrace ' + side, elbow, wrist, [(0, .072, .076), (.23, .09, .088),
             (.7, .067, .062), (.96, .046, .05)], [shadow, steel, edge, steel], 'Forearm.' + side)
        hand = rest['Glove.' + side][1]
        limb('Gauntlet ' + side, wrist, hand, [(0, .053, .054), (.61, .056, .057), (1, .044, .047)],
             [leather, shadow, steel], 'Glove.' + side)
        hip, knee, _ = rest['Thigh.' + side]
        ankle = rest['Boot.' + side][0]
        limb('Upper leg plate ' + side, hip, knee, [(0, .108, .113), (.34, .107, .102),
             (.78, .078, .079), (1, .074, .075)], [joint, shadow, steel], 'Thigh.' + side)
        limb('Ribbed greave ' + side, knee, ankle, [(0, .088, .095), (.17, .104, .103), (.52, .076, .076),
             (.92, .054, .056), (1, .058, .061)], [shadow, steel, edge, steel], 'Shin.' + side)
        plate('Knee boss ' + side, [(sign*.153-.079, -.133, .61), (sign*.153+.05, -.154, .62),
              (sign*.153+.096, -.116, .55), (sign*.153+.018, -.165, .494), (sign*.153-.066, -.13, .53)],
              .026, edge, 'Shin.' + side, .012)
        profile('Sabatons ' + side, [(.014, sign*.164, -.082, .083, .170), (.053, sign*.164, -.084, .087, .170),
                (.096, sign*.164, -.055, .076, .135), (.161, sign*.164, -.017, .06, .093)],
                [black, shadow, steel, edge], 'Boot.' + side)
        for y, z in [(-.183, .073), (-.128, .094)]:
            x = sign*.164
            plate('Articulated toe plate', [(x-.058, y, z), (x+.058, y, z), (x+.045, y, z-.013), (x-.045, y, z-.013)],
                  .012, edge, 'Boot.' + side, .003)

    # A broad steel blade, modeled around the grip axis so its silhouette
    # remains continuous through the wind-up and follow-through.
    a, end, _ = rest['Sword']
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


def point(bone, head, tail):
    head, tail = Vector(head), Vector(tail)
    a, b, _ = rest[bone]
    change = (Vector(b) - Vector(a)).rotation_difference(tail - head).to_matrix().to_4x4()
    matrix = Matrix.Translation(head) @ change @ Matrix.Translation(-Vector(a)) @ rig.data.bones[bone].matrix_local
    rig.pose.bones[bone].matrix = matrix
    bpy.context.view_layer.update()


def bend_joint(upper, lower, a, end, bias):
    a, end = Vector(a), Vector(end)
    ab = (Vector(rest[upper][1]) - Vector(rest[upper][0])).length
    bc = (Vector(rest[lower][1]) - Vector(rest[lower][0])).length
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


def pose(kind, t):
    phase = math.tau*t
    walking = kind == 'walk'
    strike = kind == 'attack'
    dash = kind == 'dash'
    gait = math.cos(phase) if walking else 0
    # Wind-up precedes the fast cut and a longer recovery.
    sweep, dip = 0, 0
    if strike:
        sweep = np.interp(t, [0,.19,.38,.56,.72,1], [0,-.52,-.68,.76,.97,0])
        dip = np.interp(t, [0,.32,.60,1], [0,-.055,-.10,0])
    if dash:
        dip = -.13*math.sin(math.pi*t)
    hips = Vector((.024*gait, .013 + .07*sweep, .976 + .017*math.cos(2*phase) + dip))
    chest = hips + Vector((-.024*gait, -.039 if walking else -.08*math.sin(math.pi*t) if dash else 0, .194))
    shoulders = Matrix.Rotation(-.095*gait + .39*sweep, 3, 'Z')
    head = chest + shoulders @ Vector((0, -.037 if walking else -.025*sweep, .332))
    point('Hips', hips, hips + Vector((.025*gait, 0, .21)))
    point('Chest', chest, head)
    point('Head', head, head + Vector((.015*gait, .01 if walking else .02*sweep, .37)))
    mantle_h = head + shoulders @ Vector((0, .142, -.032))
    point('Mantle', mantle_h, mantle_h + Vector((.045*gait + .06*sweep, .127 + .32*max(0, sweep) + .36*int(dash), -.46)))

    for side, sign in [('L', -1), ('R', 1)]:
        hip = hips + Vector((sign*.135, 0, .013))
        stride = sign*gait*.245 if walking else sign*.073 + .05*sweep
        heel = max(0, math.sin(phase)*sign)*.13 if walking else 0
        if dash:
            stride = sign*.20*(.65 + math.sin(math.pi*t))
            heel = max(0, math.sin(math.pi*t)) * (.13 if sign>0 else .04)
        ankle = Vector((sign*.164 + .012*gait, stride, .116 + heel))
        ankle = bend_joint('Thigh.' + side, 'Shin.' + side, hip, ankle, (sign*.12,-1,.03))
        point('Boot.' + side, ankle, ankle + Vector((sign*.014,-.146,.04 if heel>.03 else -.056)))

        shoulder = head + shoulders @ Vector((sign*.293, .028, -.053))
        wrist = Vector((sign*.401, -.178 if sign>0 else -.025, .983 + dip))
        if walking:
            wrist.y += sign*gait*.21
            wrist.z += max(0, sign*gait*.09)
        if dash:
            wrist.y += sign*.18
            wrist.z += .09
        if strike:
            wrist.x = sign*(.395+.058*abs(sweep)) + (.48*sweep if sign>0 else -.044*sweep)
            wrist.y = -.18 - (.21*max(0,sweep) if sign>0 else -.10*sweep)
            wrist.z += (.26*max(0,-sweep) if sign>0 else .02)
        wrist = bend_joint('Arm.' + side, 'Forearm.' + side, shoulder, wrist, (sign*.42, 1, -.1))
        hand = wrist + Vector((sign*.012,-.02 if sign<0 else -.079,-.086 if sign<0 else -.032))
        point('Glove.' + side, wrist, hand)
        if sign>0:
            blade = Vector((.22, -.50, .12 + .04*gait))
            if dash:
                blade = Vector((.28, .45, .085))
            if strike:
                blade = Vector((.83*sweep + .23, -.42, -.08 - .53*min(0,sweep)))
            point('Sword', wrist, wrist+blade)


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
    scene.render.resolution_x = scene.render.resolution_y = 128
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.fps = 12
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
    data.ortho_scale = 2.87
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
    size, facings = 128, 8
    atlas = np.empty((len(frames)*size, facings*size, 4), dtype=np.float32)
    for direction in range(facings):
        if preview and direction not in (0,3,7):
            continue
        # 0 is right; increasing directions follow the same clockwise order as the 2D bank.
        rig.rotation_euler.z = math.pi/2 - direction*math.pi/4
        for row, (kind, frame) in enumerate(frames):
            if preview and (kind, row) not in [('idle',0),('walk',7),('attack',23)]:
                continue
            scene.frame_set(frame)
            path = directory / f'{direction}-{row}.png'
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(str(path), check_existing=False)
            pixels = np.empty(size*size*4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            bpy.data.images.remove(image)
            atlas[(len(frames)-1-row)*size:(len(frames)-row)*size, direction*size:(direction+1)*size] = pixels.reshape(size,size,4)
    if not preview:
        image = bpy.data.images.new('Guardian sheet', width=facings*size, height=len(frames)*size, alpha=True)
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
    rig, rest = create_rig()
    model()
    scene = setup(opts.engine)
    frames = key_animations(scene, [('idle',4),('walk',8),('dash',6),('attack',9)])
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
