"""Mind Dungeon Room Atelier: original unrigged Blender furniture.
Build from repository root (Blender 3.4+):
 blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P beta/room-editor/blender/build-room-kit.py -- --raw /tmp/md-room-raw

The source room-kit.blend and all eight 384px orthographic views are generated
from real modeled meshes. Nothing in the live game's art/greybox is changed.
"""
import argparse
import json
import math
import os
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'beta' / 'room-editor' / 'assets'
RAW = Path('/tmp/md-room-raw')
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--raw', default=str(RAW))
parser.add_argument('--samples', type=int, default=40)
opt = parser.parse_args(args)
RAW = Path(opt.raw)
RAW.mkdir(parents=True, exist_ok=True)
(OUT/'source').mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for mesh in list(bpy.data.meshes):
    if not mesh.users:
        bpy.data.meshes.remove(mesh)


def hex_linear(code):
    rgb = tuple(int(code[i:i+2], 16)/255 for i in (0, 2, 4))
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def material(name, color, roughness=.74, metal=0, secondary=None, grain=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*hex_linear(color), 1)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = m.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    if secondary:
        tex = nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = grain or 14
        tex.inputs['Detail'].default_value = 3
        tex.inputs['Roughness'].default_value = .67
        coord = nodes.new('ShaderNodeTexCoord')
        m.node_tree.links.new(coord.outputs['Generated'], tex.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .16
        ramp.color_ramp.elements[0].color = (*hex_linear(code=color), 1)
        ramp.color_ramp.elements[1].position = .84
        ramp.color_ramp.elements[1].color = (*hex_linear(code=secondary), 1)
        m.node_tree.links.new(tex.outputs['Fac'], ramp.inputs[0])
        m.node_tree.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    return m


oak = material('Guardian-style antique oak | warm umber', '725342', .77,
               secondary='9e7556', grain=19)
oak_dark = material('Weathered endgrain and oak joints', '423128', .83,
                    secondary='624c3e', grain=24)
oak_light = material('Worn exposed plank edges', '987456', .69,
                     secondary='c19a6b', grain=18)
iron = material('Hammered wrought iron | cool steel', '525a65', .56, .77,
                secondary='848d98', grain=35)
iron_black = material('Forged rivet iron | black', '2b2c32', .69, .64)
highlight = material('Worn nail caps | silver abrasion', 'a89d92', .48, .75)


def cube(name, location, size, m, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(m)
    if bevel:
        mod = ob.modifiers.new('soft worn physical edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        if hasattr(mod, 'affect'):
            mod.affect = 'EDGES'
        mod.profile = .5
        ob.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return ob


def cylinder(name, location, radius, depth, m, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=depth, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(m)
    bevel = ob.modifiers.new('machined roundover', 'BEVEL')
    bevel.width = .005
    bevel.segments = 2
    ob.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return ob


def make_model(name, fn):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
    root = bpy.context.object
    root.name = name + ' | pivot at floor center'
    before = set(bpy.context.scene.objects)
    fn()
    for ob in list(bpy.context.scene.objects):
        if ob != root and ob not in before and ob.type == 'MESH':
            ob.parent = root
            ob.matrix_parent_inverse = root.matrix_world.inverted()
    return root


def build_table():
    # Real, thickness-aware board assembly: individual planks, tapered
    # squared legs, iron lateral braces and metal corner reinforcements.
    for x in (-.74, .74):
        for y in (-.34,.34):
            cube('Oak leg, forged square mortise', (x,y,.425),
                 (.125,.125,.83),oak_dark,.019)
            cube('Iron leg shoe', (x,y,.065),(.139,.139,.12),iron_black,.009)
            cube('Tenon / joint cap', (x,y,.82),(.16,.16,.1),oak_light,.015)
    for y in (-.37,.37):
        cube('Long side apron with joinery', (0,y,.73),
             (1.48,.105,.17),oak_dark,.018)
        cube('Iron apron band', (0,y,.667),(1.52,.033,.035),iron,.008)
    for x in (-.73,.73):
        cube('Short side apron', (x,0,.735),(.083,.71,.17),oak_dark,.011)
    for i in range(5):
        y=-.42+i*.21
        cube('Individually weathered top plank %d'%i,
             (0,y,.91+(i%3)*.004),(1.83,.206,.115),
             [oak,oak_light,oak,oak_dark,oak][i],.014)
        # End grain board separation physically exists rather than
        # being a flat rectangle painted with simulated seams.
        for x in (-.84,.84):
            cylinder('Hammered flush nail', (x,y,.977+(i%3)*.004),
                     .014,.009,iron_black,10)
    for y in (-.33,.33):
        cube('Iron table end plate', (0,y,.977),(1.69,.024,.010),iron,.002)
    for x in (-.73,.73):
        cube('Distressed wooden cross stretcher', (x,0,.28),
             (.075,.72,.075),oak_dark,.008)


def build_chair():
    # A prison chair, square silhouette; robust seated scale 0.78x0.79
    # to fit the game's collision and vaulting envelope.
    for x in (-.29,.29):
        for y in (-.30,.30):
            height=1.24 if y<0 else .61
            cube('Square chair leg', (x,y,height/2),
                 (.105,.103,height),oak_dark,.015)
            cube('Foot iron binding', (x,y,.055),(.108,.107,.11),iron_black,.008)
    for y in (-.27,.27):
        cube('Chair rail', (0,y,.38),(.53,.055,.095),oak,.009)
    for x in (-.28,.28):
        cube('Cross stretcher', (x,0,.29),(.065,.62,.085),oak_dark,.008)
    for i in range(4):
        x=-.285+i*.19
        cube('Separate carved chair seat plank', (x,0,.657),
             (.187,.72,.102),[oak,oak_light,oak,oak_dark][i],.016)
    # Taller backrest, pierced by independent vertical planks.
    cube('Upper broad oak backrest', (0,-.305,1.25),(.71,.11,.16),oak_light,.021)
    cube('Lower backrest frame', (0,-.306,.85),(.68,.078,.085),oak_dark,.010)
    for x in (-.22,0,.22):
        cube('Separate backrest stave', (x,-.307,1.055),
             (.115,.068,.43),oak,.018)
    for x in (-.29,.29):
        for z in (.76,1.19):
            cylinder('Iron brace nail', (x,-.365,z),.016,.011,
                     iron_black,10)
    for x in (-.29,.29):
        cube('Seat bracket / nail strip', (x,0,.58),
             (.05,.63,.027),iron,.008)


def area(name, location, watts, color, size):
    bpy.ops.object.light_add(type='AREA', location=location)
    lamp=bpy.context.object
    lamp.name=name;lamp.data.energy=watts
    lamp.data.color=color;lamp.data.shape='DISK';lamp.data.size=size
    direction=Vector((0,0,.5))-lamp.location
    lamp.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    return lamp


table = make_model('Prison Table · unrigged',build_table)
chair = make_model('Prison Chair · unrigged',build_chair)

# Original Guardian-style 35.26° isometric camera, warm key + blue fill.
bpy.ops.object.camera_add(location=(-5.0,-5.0,5.72))
camera=bpy.context.object
camera.name='Shared isometric orthographic camera'
look=Vector((0,0,.72))
direction=look-camera.location
camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=3.35
camera.data.lens=50
bpy.context.scene.camera=camera
area('Guardian warm key',(-3.2,-4.4,6.8),950,(1.0,.84,.68),4.2)
area('Guardian blue fill',(4.4,2.2,5.2),420,(.68,.79,1.0),3.9)
area('Guardian shoulder rim',(-1.8,3.0,3.3),310,(1.0,.92,.82),2.1)
world=bpy.context.scene.world
if not world:
    world=bpy.data.worlds.new('Guardian neutral atmosphere')
    bpy.context.scene.world=world
world.use_nodes=True
background=world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value=(.28,.32,.40,1)
background.inputs['Strength'].default_value=.58

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=max(12,min(96,opt.samples))
scene.cycles.use_denoising=True
scene.render.resolution_x=512
scene.render.resolution_y=512
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
try:
    scene.view_settings.view_transform='Filmic'
    scene.view_settings.look='High Contrast'
    scene.view_settings.exposure=.10
    scene.view_settings.gamma=1
except Exception:
    scene.view_settings.look='Medium High Contrast'
try:scene.camera.data.lens=50
except:pass

for name,rig in [('table',table),('chair',chair)]:
    for other in (table,chair):
        show=other==rig
        for ob in (other,*other.children):
            ob.hide_render=not show
    for rot in (0,90,180,270):
        rig.rotation_euler.z=math.radians(rot)
        scene.render.filepath=str(RAW/('%s-%s.png'%(name,rot)))
        bpy.ops.render.render(write_still=True)
        print('RENDERED',name,rot,scene.render.filepath,flush=True)
    rig.rotation_euler.z=0
for other in (table,chair):
    for ob in (other,*other.children):ob.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/'room-kit.blend'),check_existing=False)
print('Saved editable source',OUT/'source'/'room-kit.blend',flush=True)
