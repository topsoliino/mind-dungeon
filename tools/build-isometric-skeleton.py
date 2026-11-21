"""Run from repository root: blender -b -t 4 -P tools/build-isometric-skeleton.py.
Build the editable rig, then render its poses into eight transparent directional sheets.
Each sheet has animation time along X and camera-relative facing along Y.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Euler


out = Path.cwd() / 'beta/art/skeleton'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
V = Vector
pi = math.pi
FACINGS = 32  # 360 degrees, one baked view every 11.25°; runtime blends between views.
def material(name, color, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    node = m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color,1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = .62
    return m
ivory = material('Weathered ivory', (.64,.53,.35))
edge = material('Pale worn bone', (.86,.76,.54))
dark = material('Deep sockets', (.024,.018,.021))
teal = material('Faded petrol cloth', (.055,.15,.16))
bronze = material('Hammered bronze', (.44,.25,.085), .35)
steel = material('Blue iron', (.30,.40,.45), .5)
leather = material('Oxblood leather', (.19,.069,.034))
wood = material('Yew', (.34,.155,.052))
parts = []
joints = {}
def joint(name, pos, parent=None):
    joints[name] = (V(pos), parent)
def part(obj, name, bone, mat, kit='both'):
    obj.name = name
    obj.data.materials.append(mat)
    parts.append((obj,bone,kit))
def oval(name,bone,p,scale,mat=ivory,kit='both'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=p)
    obj=bpy.context.object
    obj.scale=scale
    part(obj,name,bone,mat,kit)
def rod(name,bone,a,b,r,r2=None,mat=ivory,kit='both'):
    a,b=V(a),V(b)
    bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=r if r2 is None else r2,
                                   depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    part(obj,name,bone,mat,kit)
def strip(name,bone,coords,mat,kit):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(coords,[],[(i,i+1,i+3,i+2) for i in range(0,len(coords)-2,2)])
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    part(obj,name,bone,mat,kit)

joint('Pelvis',(0,0,.89))
joint('Chest',(0,0,1.03),'Pelvis')
joint('Skull',(0,-.015,1.57),'Chest')
for side,s in [('R',-1),('L',1)]:
    for name,p,parent in [('Thigh',(s*.13,0,.90),'Pelvis'),('Shin',(s*.14,-.035,.52),'Thigh'),
                          ('Foot',(s*.14,.012,.12),'Shin'),('Arm',(s*.24,0,1.48),'Chest'),
                          ('Forearm',(s*.32,.02,1.19),'Arm'),('Hand',(s*.34,-.03,.94),'Forearm')]:
        joint(name+side,p,parent if parent in ('Pelvis','Chest') else parent+side)
    for name,end in [('Thigh','Shin'),('Shin','Foot'),('Arm','Forearm'),('Forearm','Hand')]:
        bone=name+side
        a=joints[bone][0]; b=joints[end+side][0];rad=.046 if name=='Thigh' else .034
        rod(name,bone,a,b,rad*1.1,rad*.72)
        oval('Condyle',bone,b,(rad*1.35,rad,rad),edge)
        if name in ('Shin','Forearm'):
            offset=V((s*.038,0,0))
            rod('Paired shaft',bone,a+offset*.65,b+offset,.017,.013)
    oval('Patella','Shin'+side,(s*.14,-.065,.52),(.055,.042,.06),edge)
    oval('Talus','Foot'+side,(s*.14,-.02,.09),(.063,.075,.049))
    for i in range(4):
        x=s*.14+(i-1.5)*.026
        rod('Toe','Foot'+side,(x,-.04,.075),(x,-.16+abs(i-1)*.009,.045),.021,.013)
    oval('Palm','Hand'+side,(s*.34,-.04,.91),(.05,.055,.055))
    for i in range(3):
        rod('Knuckle','Hand'+side,(s*.34+(i-1)*.025,-.068,.91),(s*.34+(i-1)*.025,-.082,.857),.014)
    oval('Iliac wing','Pelvis',(s*.093,0,.945),(.107,.089,.103))
    rod('Clavicle','Chest',(0,-.048,1.44),(s*.235,0,1.49),.026,.038,edge)
    for i in range(5):
        z=1.18+i*.055; w=.147+.054*math.sin((i+1)*pi/7)
        arc=[(s*.025,.035,z+.036),(s*w*.8,.065,z+.026),(s*w,.005,z),(s*w*.81,-.085,z-.026),(s*.04,-.106,z-.035)]
        for k,(a,b) in enumerate(zip(arc,arc[1:])):rod('Rib','Chest',a,b,.018,.016,edge)
for i in range(9):
    z=1+i*.065
    oval('Vertebra','Chest',(0,.028,z),(.047,.052,.034))
rod('Sternum','Chest',(0,-.107,1.19),(0,-.102,1.44),.027,.038)
oval('Cranium','Skull',(0,0,1.72),(.158,.13,.168),edge)
oval('Maxilla','Skull',(0,-.061,1.645),(.12,.095,.08))
oval('Jaw','Skull',(0,-.052,1.573),(.113,.081,.043))
for s in (-1,1):
    oval('Orbit','Skull',(s*.065,-.115,1.71),(.048,.023,.052),dark)
    rod('Brow','Skull',(s*.018,-.124,1.749),(s*.12,-.089,1.755),.022,.026,edge)
    oval('Zygoma','Skull',(s*.103,-.099,1.653),(.042,.037,.034),edge)
oval('Nasal cavity','Skull',(0,-.149,1.659),(.023,.015,.029),dark)
for i in range(6):
    oval('Tooth','Skull',((i-2.5)*.027,-.137+abs(i-2.5)*.004,1.609),(.013,.015,.024),edge)
oval('Belt','Pelvis',(0,-.004,.965),(.177,.104,.043),leather)
oval('Buckle','Pelvis',(0,-.105,.966),(.045,.014,.033),bronze)
strip('Split tabard','Pelvis',[(-.12,-.08,.95),(.10,-.09,.95),(-.1,-.116,.73),(.065,-.13,.69),(-.07,-.11,.64),(.04,-.13,.66)],teal,'both')
oval('Pauldron','ArmL',(.245,.002,1.48),(.112,.101,.081),bronze)
# Weapons are rigid attachments, with a separate flexing bowstring and nocked arrow.
grip=joints['HandR'][0]
def at(p,v):return tuple(p+V(v))
rod('Wrapped grip','HandR',at(grip,(0,0,-.14)),at(grip,(0,0,.10)),.025,.026,leather,'sabre')
rod('Quillon','HandR',at(grip,(-.09,0,.09)),at(grip,(.09,0,.09)),.021,.012,bronze,'sabre')
blade=[]
for h,w,bend in [(.10,.028,0),(.39,.039,-.014),(.61,.046,-.065),(.77,0,-.15)]:
    blade.extend([at(grip,(0,bend-w,h)),at(grip,(0,bend+w,h))])
strip('Curved falchion','HandR',blade,steel,'sabre')
bevel=[]
for a,b in zip(blade[::2],blade[1::2]):
    bevel.extend([a,tuple((V(a)+V(b))/2+V((.018,0,0)))])
strip('Ground bevel','HandR',bevel,edge,'sabre')
bow=joints['HandL'][0]
bowpts=[(0,.085,-.44),(0,-.005,-.35),(0,-.075,-.19),(0,-.02,0),(0,-.075,.19),(0,-.005,.35),(0,.085,.44)]
for i,(a,b) in enumerate(zip(bowpts,bowpts[1:])):
    rod('Bow limb','HandL',at(bow,a),at(bow,b),.014 if i in (0,5) else .021,mat=wood,kit='bow')
for i,s in enumerate((-1,1)):
    joint('String'+str(i),at(bow,(0,.085,s*.44)),'HandL')
    rod('String','String'+str(i),at(bow,(0,.085,s*.44)),at(bow,(0,.085,0)),.006,mat=edge,kit='bow')
joint('Arrow',at(bow,(0,.085,0)),'HandL')
rod('Nocked arrow','Arrow',at(bow,(0,.085,0)),at(bow,(0,-.56,0)),.011,mat=wood,kit='bow')
rod('Broadhead','Arrow',at(bow,(0,-.53,0)),at(bow,(0,-.62,0)),.031,0,steel,'bow')

arm=bpy.data.armatures.new('Ossuary skeleton')
rig=bpy.data.objects.new('Skeleton rig',arm);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,(p,parent) in joints.items():
    b=arm.edit_bones.new(name);b.head=p;b.tail=p+V((0,.08,0))
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
# Bind rest-space meshes to rigid bones. Keep two named weapon collections.
bpy.context.view_layer.update()
groups={}
for obj,bone,kit in parts:
    world=obj.matrix_world.copy()
    if kit=='sabre':
        world=Matrix.Translation(grip)@Matrix.Rotation(1.34,4,'X')@Matrix.Translation(-grip)@world
    obj.data.transform(world);obj.matrix_world=Matrix.Identity(4)
    group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    groups.setdefault(kit,[]).append(obj)
meshes={}
for kit,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs:obj.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
    ob=objs[0];ob.name='Skeleton • '+kit;ob.parent=rig
    mod=ob.modifiers.new('Skeleton joints','ARMATURE');mod.object=rig;meshes[kit]=ob
# Bind-pose coordinates face -Y. FK limb rotations use X for the stride and
# Z for torso twist. During a collapse each bone gets an independent floor pose.
clips={'idle':6,'run':10,'strike':10,'shoot':10,'death':10}

def rotation(x=0,y=0,z=0):return Euler((x,y,z)).to_matrix().to_4x4()
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
orig={name:Matrix.Translation(p) for name,(p,parent) in joints.items()}
def sample(clip,t):
    swing=math.sin(t*2*pi); cycle=math.cos(t*2*pi)
    local={n:Matrix.Identity(4) for n in joints}
    run=clip=='run'; shoot=clip=='shoot'
    local['Pelvis']=Matrix.Translation((.022*swing if run else 0,0,.044*abs(cycle) if run else .012*swing))
    local['Chest']=rotation(.15 if run else .028*swing,0,.12*swing if run else .03*swing)
    local['Skull']=rotation(-.07 if run else -.025*swing,0,-.045*swing)
    for side,sign in [('R',1),('L',-1)]:
        stride=sign*swing
        local['Thigh'+side]=rotation(.68*stride if run else .025*sign)
        local['Shin'+side]=rotation(.67*max(0,-stride) if run else .07)
        local['Foot'+side]=rotation(-.35*stride if run else 0)
        local['Arm'+side]=rotation(-.45*stride-.19 if run else -.17+.055*sign*swing,.05*sign)
        local['Forearm'+side]=rotation(-.48 if run else -.36)
    if clip=='strike':
        wind=ease(t/.48);cut=ease((t-.48)/.20);back=ease((t-.70)/.30)
        local['Chest']=rotation(.08+.25*cut*(1-back),0,-.65*wind+1.55*cut-.9*back)
        local['ArmR']=rotation(-.45-2.10*wind+1.86*cut+.24*back,-.67*wind+.82*cut-.15*back)
        local['ForearmR']=rotation(-.70-.50*wind+1.06*cut-.56*back)
    # Lower bow hand in locomotion, shoulder-high at full draw. Solve both
    # two-link arms to keep the drawing fingers on the nock.
    desired={}
    for n,(p,parent) in joints.items():
        desired[n]=(desired[parent]@orig[parent].inverted() if parent else Matrix.Identity(4))@orig[n]@local[n]
    if shoot:
        draw=ease(t/.58); release=ease((t-.62)/.09);lower=ease((t-.76)/.24)
        level=draw*(1-lower)
        left=V((.19,-.16-.28*level,1.14+.30*level))
        nock=left+V((0,.085+.38*draw*(1-release),0))
        right=nock+V((-.08-.10*release,.16*release,.024*release))
        for side,target,pole in [('L',left,V((.8,.1,1.12))),('R',right,V((-.72,.35,1.42)))]:
            a=desired['Arm'+side].translation;d=target-a;axis=d.normalized()
            l=(joints['Arm'+side][0]-joints['Forearm'+side][0]).length
            m=(joints['Hand'+side][0]-joints['Forearm'+side][0]).length
            length=min(d.length,l+m-.001);along=(l*l-m*m+length*length)/(2*length)
            bend=pole-a; bend=(bend-axis*bend.dot(axis)).normalized()
            elbow=a+axis*along+bend*math.sqrt(max(0,l*l-along*along))
            for limb,nextjoint,start,end in [('Arm','Forearm',a,elbow),('Forearm','Hand',elbow,target)]:
                vec=joints[nextjoint+side][0]-joints[limb+side][0]
                desired[limb+side]=Matrix.Translation(start)@vec.rotation_difference(end-start).to_matrix().to_4x4()
            desired['Hand'+side]=Matrix.Translation(target)
        for i,sign in enumerate((-1,1)):
            tip=left+V((0,.085,sign*.44));d=nock-tip;rest=V((0,0,-sign*.44))
            desired['String'+str(i)]=Matrix.Translation(tip)@rest.rotation_difference(d).to_matrix().to_4x4()@Matrix.Diagonal((1,1,d.length/.44,1))
        desired['Arrow']=Matrix.Translation(nock)@Matrix.Scale(.0001 if t>=.62 else 1,4)
    if clip=='death':
        for i,(name,(p,parent)) in enumerate(joints.items()):
            if name.startswith(('String','Arrow')):continue
            fall=ease((t-(i%4)*.028)/.71)
            rad=.10+.26*((i*7)%11)/10;ang=i*2.40
            end=V((p.x*.85+rad*math.cos(ang),rad*math.sin(ang),.08+(.09 if name=='Skull' else 0)))
            loc=desired[name].translation.lerp(end,fall)
            loc.z+=.055*abs(math.sin((t-.70)*pi*4))*max(0,1-(t-.70)/.30) if t>.70 else 0
            if name.startswith('Hand'):
                desired[name]=Matrix.Translation(loc)@rotation(0,1.48*fall,ang*fall)
                continue
            desired[name]=Matrix.Translation(loc)@rotation((1.46 if 'Foot' not in name else .2)*fall,.3*math.sin(i)*fall,ang*fall)
        for n in ('String0','String1','Arrow'):
            desired[n]=desired['HandL']@orig['HandL'].inverted()@orig[n]
    for n,(p,parent) in joints.items():
        basis=(desired[parent]@orig[parent].inverted()@orig[n] if parent else orig[n]).inverted()@desired[n]
        pb=rig.pose.bones[n];pb.matrix_basis=basis
        for prop in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=prop,frame=1+round(t*48))
for clip,count in clips.items():
    action=bpy.data.actions.new(clip);action.use_fake_user=True
    rig.animation_data_create().action=action
    for i in range(25):sample(clip,i/24)
scene.frame_end=49;scene.render.fps=48
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
meshes['bow'].hide_viewport=True;meshes['bow'].hide_render=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(out/'skeleton.blend'),compress=True)
# Batch evaluated Blender geometry into an orthographic contact sheet so one
# Cycles render covers every facing and sample of a clip.
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
scene.render.image_settings.file_format='WEBP';scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.quality=88
scene.render.film_transparent=True;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Ambient skylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.61,.69,.79,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
camdata=bpy.data.cameras.new('Atlas orthographic');cam=bpy.data.objects.new('Atlas camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.clip_end=300;cam.location=(0,0,20)
for name,color,power,direction in [('Key', (1,.85,.63),3.0,(.4,-.7,1)),('Rim',(.55,.72,1),1.9,(-1,.6,.4))]:
    light=bpy.data.lights.new(name,'SUN');light.energy=power;light.color=color;light.angle=.4
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj)
    obj.rotation_euler=(-V(direction)).to_track_quat('-Z','Y').to_euler()
for obj in meshes.values():obj.hide_render=True;obj.hide_viewport=False
mats=list(dict.fromkeys(m for ob in meshes.values() for m in ob.data.materials))
pitch=math.atan(1/math.sqrt(2));view=rotation(pitch-pi/2);cell=2.95
for kit in ('sabre','bow'):
    for clip in ('idle','run','shoot' if kit=='bow' else 'strike','death'):
        count=clips[clip];verts=[];faces=[];indices=[]
        rig.animation_data.action=bpy.data.actions[clip]
        for i in range(count):
            scene.frame_set(1+round(48*i/(count if clip in ('idle','run') else count-1)))
            deps=bpy.context.evaluated_depsgraph_get()
            for obj in (meshes['both'],meshes[kit]):
                ev=obj.evaluated_get(deps);mesh=ev.to_mesh()
                coords=[v.co.copy() for v in mesh.vertices]
                polys=[tuple(f.vertices) for f in mesh.polygons]
                ids=[mats.index(mesh.materials[f.material_index].original) for f in mesh.polygons]
                for row in range(FACINGS):
                    # Row zero faces the camera. A quarter-turn is FACINGS/4.
                    # Every row is a different evaluated 3D model, never a
                    # flat 2D sprite rotation.
                    transform=view@rotation(z=row*2*pi/FACINGS)
                    origin=V(((i+.5-count/2)*cell,(FACINGS/2-.5-row)*cell-.265*cell,0))
                    offset=len(verts);verts.extend(transform@v+origin for v in coords)
                    faces.extend(tuple(offset+j for j in poly) for poly in polys);indices.extend(ids)
                ev.to_mesh_clear()
        data=bpy.data.meshes.new('Pose batch');data.from_pydata(verts,[],faces)
        for m in mats:data.materials.append(m)
        data.polygons.foreach_set('material_index',indices)
        batch=bpy.data.objects.new('Pose batch',data);scene.collection.objects.link(batch)
        scene.render.resolution_x=count*96;scene.render.resolution_y=FACINGS*96
        camdata.ortho_scale=max(count,FACINGS)*cell
        scene.render.filepath=str(out/(kit+'-'+clip+'.webp'))
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(batch,do_unlink=True);bpy.data.meshes.remove(data)
