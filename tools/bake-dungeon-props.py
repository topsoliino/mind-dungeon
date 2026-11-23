"""blender -b -P tools/bake-dungeon-props.py -- path/to/treasure_chest.gltf output_dir
Use Poly Haven's CC0 treasure_chest glTF including its referenced textures and BIN.
Sprites are square, with the floor anchor at their centre. One tile = 1 Blender unit.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
from math import pi, sin, cos
source,out=sys.argv[sys.argv.index('--')+1:]
out=Path(out);out.mkdir(exist_ok=True,parents=True)
b=bpy; b.ops.wm.read_factory_settings(use_empty=True)
scene=b.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16
scene.cycles.use_denoising=False
scene.render.film_transparent=True
scene.world=b.data.worlds.new('Cool ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.57,.64,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
def aim(o,target):
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
b.ops.object.camera_add(location=(7,-7,7*math.sqrt(2/3)))
cam=b.context.object;aim(cam,(0,0,0));cam.data.type='ORTHO';scene.camera=cam
for pos,power,size,color in [((-3,-4,6),650,4,(1,.84,.68)),((3,2,4),560,3,(.63,.82,1))]:
 b.ops.object.light_add(type='AREA',location=pos);o=b.context.object;aim(o,(0,0,.75))
 o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
def render(name,span):
 cam.data.ortho_scale=span
 scene.render.resolution_x=scene.render.resolution_y=round(span*144)
 scene.render.resolution_percentage=100
 scene.render.filepath=str(out/(name+'.png'));b.ops.render.render(write_still=True)
if source!='fixtures':
 b.ops.import_scene.gltf(filepath=source)
 lid=b.data.objects['treasure_chest_lid'];lock=b.data.objects['treasure_chest_lock']
 for opened in (False,True):
  lid.rotation_mode='XYZ';lid.rotation_euler.x=math.radians(-78 if opened else 0);lock.hide_render=opened
  for turn in range(4):
   angle=-pi/4-turn*pi/2
   cam.location.x=math.sqrt(98)*cos(angle);cam.location.y=math.sqrt(98)*sin(angle);aim(cam,(0,0,0))
   render(('chest-open-' if opened else 'chest-')+str(turn),2.6)
cam.location.x=7;cam.location.y=-7;aim(cam,(0,0,0))
for o in list(scene.objects):
 if o.type=='MESH':b.data.objects.remove(o,do_unlink=True)
def material(name,dark,light,metal,scale,rough):
 m=b.data.materials.new(name);m.use_nodes=True;tree=m.node_tree
 bs=tree.nodes['Principled BSDF'];bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 n=tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=4
 tex=tree.nodes.new('ShaderNodeTexCoord');tree.links.new(tex.outputs['Object'],n.inputs[0])
 ramp=tree.nodes.new('ShaderNodeValToRGB')
 for e,c in zip(ramp.color_ramp.elements,[dark,light]):e.color=(*c,1)
 tree.links.new(n.outputs['Fac'],ramp.inputs[0]);tree.links.new(ramp.outputs[0],bs.inputs['Base Color'])
 bump=tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=.035
 tree.links.new(n.outputs[0],bump.inputs['Height']);tree.links.new(bump.outputs[0],bs.inputs['Normal'])
 return m
stone=material('Chipped basalt',(.018,.022,.028),(.27,.24,.20),.08,10,.73)
iron=material('Forged iron',(.015,.02,.025),(.16,.15,.13),.83,19,.39)
brass=material('Old bronze',(.06,.035,.02),(.53,.32,.12),.72,12,.35)
wood=material('Blackened oak',(.018,.009,.006),(.18,.085,.038),.06,8,.69)
glow=material('Seal enamel',(.04,.24,.32),(.24,.65,.79),.25,8,.33)
shader=glow.node_tree.nodes['Principled BSDF'];shader.inputs['Emission Color'].default_value=(.08,.75,1,1);shader.inputs['Emission Strength'].default_value=2.4
def block(x,y,z,w,d,h,m,rot=0):
 b.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=b.context.object;o.dimensions=(w,d,h)
 b.ops.object.transform_apply(location=False,rotation=False,scale=True);o.rotation_euler.y=rot
 o.data.materials.append(m);mod=o.modifiers.new('Worn edges','BEVEL');mod.width=min(.017,min(w,d,h)*.16);mod.segments=2
 o.modifiers.new('Face normals','WEIGHTED_NORMAL')
def bar(x1,z1,x2,z2,y,w,m):
 block((x1+x2)/2,y,(z1+z2)/2,w,.035,math.hypot(x2-x1,z2-z1),m,math.atan2(x2-x1,z2-z1))
for width in range(2,7):
 height=1.95;clear=width-.38;slats=width*4
 for j in range(slats):
  x=clear*((j+.5)/slats-.5);block(x,0,.89,clear/slats-.012,.17,1.78,wood)
 for side in [-1,1]:
  for j in range(5):block(side*(width/2-.095),0,(j+.5)*height/5,.20,.34,height/5-.013,stone)
  for z in [.23,.77,1.51]:
   block(side*clear/4,-.106,z,clear/2-.025,.063,.087,iron)
   for frac in [.12,.5,.88]:block(side*clear*frac/2,-.148,z,.042,.023,.045,brass)
  for x in [side*.045,side*(clear/2-.07)]:block(x,-.103,.88,.055,.062,1.76,iron)
 for j in range(width*2):
  block((j+.5)*width/(width*2)-width/2,0,1.86,.49,.35,.21,stone)
 # Capstones, raised lock plates and forged ring pulls cast real shadows.
 for side in [-1,1]:
  for z in [.12,1.72]:
   block(side*(width/2-.11),-.01,z,.32,.41,.14,stone)
  block(side*.18,-.13,.62,.12,.06,.23,brass)
  b.ops.mesh.primitive_torus_add(location=(side*.18,-.19,.57),rotation=(pi/2,0,0),
   major_radius=.065,minor_radius=.015,major_segments=20,minor_segments=8)
  b.context.object.data.materials.append(iron)
 for j in range(8):
  angle=j*pi/4
  bar(.365*cos(angle),.98+.365*sin(angle),.414*cos(angle),.98+.414*sin(angle),-.19,.019,glow)
 for radius,mat,w in [(.36,brass,.055),(.30,glow,.018)]:
  for j in range(24):
   a=j*2*pi/24;c=(j+1)*2*pi/24
   bar(radius*cos(a),.98+radius*sin(a),radius*cos(c),.98+radius*sin(c),-.17,w,mat)
 for (x,z),(u,v) in zip([(0,.75),(-.12,.98),(0,1.20),(.12,.98)], [(-.12,.98),(0,1.20),(.12,.98),(0,.75)]):bar(x,z,u,v,-.18,.035,glow)
 if source!='fixtures':render('seal-'+str(width),max(5,width*1.2))
 for obj in scene.objects:
  if obj.type=='MESH' and obj.active_material==glow:obj.hide_render=True
 render('spent-'+str(width),max(5,width*1.2))
 for o in list(scene.objects):
  if o.type=='MESH':b.data.objects.remove(o,do_unlink=True)

# An octagonal basalt lectern with bronze mouldings and an illuminated codex.
def drum(z,low,high,height,mat,sides=8):
 b.ops.mesh.primitive_cone_add(vertices=sides,radius1=low,radius2=high,depth=height,location=(0,0,z))
 o=b.context.object;o.data.materials.append(mat)
 edge=o.modifiers.new('Rounded moulding','BEVEL');edge.width=.012;edge.segments=3
 o.modifiers.new('Face normals','WEIGHTED_NORMAL')
for args in [(.06,.54,.54,.12,stone),(.15,.51,.41,.07,brass),(.24,.43,.31,.12,stone),
 (.50,.31,.34,.43,stone),(.72,.34,.37,.04,brass),(.82,.37,.51,.16,stone),
 (.925,.52,.52,.05,brass),(.98,.51,.46,.07,stone)]:drum(*args)
paper=material('Parchment',(.38,.22,.08),(.94,.80,.54),0,18,.88)
for side in [-1,1]:
 tilt=-side*.16
 block(side*.185,0,1.055,.385,.54,.04,wood,tilt)
 block(side*.18,0,1.09,.36,.50,.055,paper,tilt)
 for row in range(6):
  block(side*.18,-.16+row*.06,1.12,.21-(row%3)*.021,.009,.007,brass,tilt)
for j in range(8):
 a=(j+.5)*pi/4
 b.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.044,location=(.323*cos(a),.323*sin(a),.58))
 b.context.object.data.materials.append(glow)
render('altar',2.6)
