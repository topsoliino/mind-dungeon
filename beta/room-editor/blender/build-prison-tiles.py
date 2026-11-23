"""Guardian-lit, 512px orthographic prison floor and wall assets.
Runs in Blender's bundled Python, no addon required and no armatures.
The WALL is one material/style; two projections are rendered for the two
visible isometric directions. The floor uses exactly ONE tile style.
Output:
  /tmp/md-room-raw/floor-prison-01.png
  /tmp/md-room-raw/wall-prison-x.png
  /tmp/md-room-raw/wall-prison-y.png
  beta/room-editor/assets/source/prison-tiles.blend
"""
import argparse
import math
from pathlib import Path
import random
import sys
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'beta'/'room-editor'/'assets'/'source'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser=argparse.ArgumentParser()
parser.add_argument('--raw',default='/tmp/md-room-editor-raw')
parser.add_argument('--samples',type=int,default=56)
opt=parser.parse_args(args)
OUT=Path(opt.raw)
OUT.mkdir(parents=True,exist_ok=True)
SRC.mkdir(parents=True,exist_ok=True)
R=random.Random(31041984)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def srgb(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def rgba(hexcolor):
    return (*(srgb(int(hexcolor[i:i+2],16)/255) for i in (0,2,4)),1)

def material(name,dark,light,roughness=.84,metallic=0,scale=26,bump=.15):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    noise=mat.node_tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=scale
    noise.inputs['Detail'].default_value=4
    noise.inputs['Roughness'].default_value=.72
    coords=mat.node_tree.nodes.new('ShaderNodeTexCoord')
    mat.node_tree.links.new(coords.outputs['Generated'],noise.inputs['Vector'])
    ramp=mat.node_tree.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.22
    ramp.color_ramp.elements[1].position=.80
    ramp.color_ramp.elements[0].color=rgba(dark)
    ramp.color_ramp.elements[1].color=rgba(light)
    mat.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0])
    mat.node_tree.links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
    if bump:
        detail=mat.node_tree.nodes.new('ShaderNodeTexNoise')
        detail.inputs['Scale'].default_value=scale*5
        detail.inputs['Detail'].default_value=3
        mat.node_tree.links.new(coords.outputs['Generated'],detail.inputs['Vector'])
        relief=mat.node_tree.nodes.new('ShaderNodeBump')
        relief.inputs['Strength'].default_value=bump
        relief.inputs['Distance'].default_value=.014
        mat.node_tree.links.new(detail.outputs['Fac'],relief.inputs['Height'])
        mat.node_tree.links.new(relief.outputs['Normal'],bsdf.inputs['Normal'])
    mat.diffuse_color=rgba(light)
    return mat

stone=[
    material('Cold quarried prison slate 01','2d323d','747783',.86,scale=31,bump=.23),
    material('Smoky blue granite 02','313844','85818b',.89,scale=39,bump=.20),
    material('Warm flecked stone 03','433d40','969093',.82,scale=28,bump=.25),
    material('Smoke weathered limestone 04','30343e','777b81',.93,scale=47,bump=.25),
    material('Damp shaded slab 05','292e39','66636d',.90,scale=42,bump=.28)
]
mortar=material('Deep black charcoal mortar','15171f','31323c',.96,scale=64,bump=.33)
chipped=material('Stone broken bevel edges','3c393e','aba19c',.80,scale=76,bump=.22)
iron=material('Dark aged iron','242730','6e717b',.64,metallic=.71,scale=64,bump=.24)
rust=material('Warm oxide deposits','3c2b2a','99614a',.95,scale=71,bump=.20)

def cube(name,loc,dims,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    ob=bpy.context.object
    ob.name=name;ob.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod=ob.modifiers.new('chipped stone edge','BEVEL')
        mod.width=min(bevel,min(dims)*.22)
        mod.segments=2
        ob.modifiers.new('weighted stone normals','WEIGHTED_NORMAL')
    return ob

def pebble(name,loc,radius,mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=radius,location=loc)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(mat)
    ob.scale=(1.4,.62,.30)
    return ob

def collect(name,fn):
    before=set(bpy.context.scene.objects)
    bpy.ops.object.empty_add(type='PLAIN_AXES')
    root=bpy.context.object;root.name=name
    fn()
    for ob in list(bpy.context.scene.objects):
        if ob!=root and ob not in before and ob.type=='MESH':
            ob.parent=root
            ob.matrix_parent_inverse=root.matrix_world.inverted()
    return root

def floor_piece():
    cube('Dark gap grout bed (1x1 tile)',(0,0,-.052),(1.0,1.0,.072),mortar,.015)
    # Independent raised stone polygons, bevelled at corners. Shadows in the
    # REAL grout, not the old flat 2D grey grid. One seamless repeatable tile.
    for row in range(3):
        for col in range(2):
            x0=-.5+col*.5+.009
            y0=-.5+row/3+.007
            w=.5-.018
            h=1/3-.016
            z=.012+R.uniform(-.012,.013)
            top=.047+R.uniform(.004,.024)
            color=stone[(row*3+col*2)%len(stone)]
            block=cube('Ashlar slab %d-%d'%(col,row),
                (x0+w*.5,y0+h*.5,z), (w,h,top),color,.022)
            block.rotation_euler.z=R.uniform(-.004,.004)
            # Exposed polished chips, irregular gouges and actual pebbles.
            if (row+col)%2==0:
                px=x0+w*R.uniform(.14,.81)
                py=y0+h*R.uniform(.13,.85)
                pebble('embedded grain / quartz fleck',
                       (px,py,z+top/2+.004),R.uniform(.007,.016),chipped)
            if (row+col)%3==0:
                px=x0+w*.68;py=y0+h*.61
                chip=cube('razor thin old hairline fracture',
                          (px,py,z+top/2+.001),
                          (.085,.0025,.002),mortar,.0005)
                chip.rotation_euler.z=R.uniform(-.8,.8)
    for i in range(8):
        x=R.uniform(-.48,.48);y=R.uniform(-.48,.48)
        # Very small dark grit in mortar joints, intentionally subtle.
        if i%2==0:pebble('dark grit', (x,y,-.004),.006,mortar)

def wall_piece():
    # X-oriented length1 wall; rotated 90deg for Y-facing sprite.
    cube('Dark mortar core, 2m high',(0,0,.98),(1.0,.226,1.96),mortar,.005)
    for row in range(6):
        z0=row*(1.96/6)
        count=3 if row%2 else 2
        spacing=1/count
        for col in range(count):
            x0=-.5+col*spacing+.010
            x1=-.5+(col+1)*spacing-.010
            width=x1-x0
            height=1.96/6-.018
            centerZ=z0+height/2+.013
            randZ=R.uniform(-.003,.003)
            mat=stone[(row+col*2)%len(stone)]
            cube('Rough-hewn wall block %d-%d'%(row,col),
                ((x0+x1)*.5,-.002,centerZ+randZ),
                (width,.245+R.uniform(-.008,.012),height),mat,.022)
            # Each course contains real, dark chipped seams.
            if (row+col)%4==1:
                cube('scuffed hairline at mortar',
                     (x0+width*.23,-.128,centerZ),
                     (.005,.002,.085),mortar,.001)
            if row%2==1 and col==0:
                cube('oxidized water mineral stain',
                     (x0+width*.56,-.133,centerZ-.06),
                     (.026,.003,.10),rust,.001)
    cube('Heavy worn capstone', (0,0,1.965),(1.07,.27,.11),stone[2],.018)
    cube('Stone base plinth',(0,0,.075),(1.055,.282,.14),stone[4],.015)
    # A few tiny forged spikes visible under the coping line.
    for i in (-.36,.02,.34):
        cube('ancient iron masonry dowel',
             (i,-.137,1.928),(.033,.025,.04),iron,.004)

floor=collect('1 × 1 prison floor tile',floor_piece)
wall=collect('1 × 2 prison wall module',wall_piece)
wall.scale.z=.8660254037844
wall.rotation_euler.z=0

bpy.ops.object.camera_add(location=(-5.0,-5.0,5.0))
camera=bpy.context.object
camera.name='AlleyStudy 35.264° isometric orthographic view'
camera.data.type='ORTHO'
bpy.context.scene.camera=camera

def aim(loc):
    look=Vector((0,0,loc))
    camera.location=(-5.0,-5.0,5.0+loc)
    direction=look-camera.location
    camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()

def area(name,loc,watts,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    lamp=bpy.context.object;lamp.name=name
    lamp.data.energy=watts;lamp.data.color=color
    lamp.data.shape='DISK';lamp.data.size=size
    direction=Vector((0,0,.5))-lamp.location
    lamp.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()

area('Guardian warm key | high contrast',(-3.2,-4.4,6.8),950,(1.0,.84,.68),4.2)
area('Guardian cold fill | restrained',(4.4,2.2,5.2),420,(.68,.79,1.0),3.9)
area('Guardian warm rim',(-1.8,3.0,3.3),310,(1,.92,.82),2.1)
world=bpy.context.scene.world
if not world:
    world=bpy.data.worlds.new('Dungeon high contrast neutral atmosphere')
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
scene.view_settings.view_transform='Filmic'
try:scene.view_settings.look='High Contrast'
except Exception:scene.view_settings.look='Medium High Contrast'
scene.view_settings.exposure=.10
scene.view_settings.gamma=1.0

def show(which):
    for root in (floor,wall):
        visible=root==which
        for obj in (root,*root.children):
            obj.hide_render=not visible

show(floor)
camera.data.ortho_scale=2.65
aim(0)
scene.render.filepath=str(OUT/'floor-prison-01.png')
bpy.ops.render.render(write_still=True)
print('AUTHORED BLENDER TILE',scene.render.filepath,flush=True)
show(wall)
camera.data.ortho_scale=3.25
aim(.8660254037844)
for axis,degrees in (('x',0),('y',90)):
    wall.rotation_euler.z=math.radians(degrees)
    scene.render.filepath=str(OUT/('wall-prison-%s.png'%axis))
    bpy.ops.render.render(write_still=True)
    print('AUTHORED BLENDER WALL',axis,scene.render.filepath,flush=True)
wall.rotation_euler.z=0
for root in (floor,wall):
    for obj in (root,*root.children):obj.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'prison-tiles.blend'),check_existing=False)
print('Editable Blender tile source',SRC/'prison-tiles.blend',flush=True)
