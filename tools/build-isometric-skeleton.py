"""Mind Dungeon: FRESH bare skeleton, built from the Guardian's original art pipeline.

Replaces the former enemy entirely. Geometry comes from the Guardian builder's
mesh/profile/limb/plate vocabulary (artist sRGB -> scene-linear BSDF, beveled
faces, weighted normals), while motion uses the Guardian's actual two-bone IK,
planted feet, counter-rotated trunk, torso-driven arms, and phase-keyed attacks.
The old skeletal primitives, shader tweaks, armor and motion curves are gone.

CLI from repository root:
  MIND_DUNGEON_RIG_ONLY=1 blender -b --factory-startup -t 4 \
    --python-exit-code 1 -P tools/build-isometric-skeleton.py

The three downstream object names/actions are the stable gameplay API:
  "Skeleton rig"; "Skeleton • both/sabre/bow";
  "idle", "run", "strike", "shoot", "death".
"""
import math
import os
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Euler

out=Path.cwd()/'beta/art/skeleton'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.view_settings.view_transform='Standard'
try:scene.view_settings.look='Medium High Contrast'
except (TypeError,ValueError):pass

pi=math.pi
V=Vector
FACINGS=32
PIXELS=128
def srgb_to_linear(v):
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

def material(name,hex_color,roughness=.67,metal=0):
    # COPIED CONTRACT from Guardian's build-player-sprite-study.py.
    rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    linear=tuple(srgb_to_linear(v) for v in rgb)
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*linear,1)
    m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*linear,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Metallic'].default_value=metal
    return m

# One graphic value family, as with the Guardian's blue steel, ivory edge,
# graphite recess, and restrained scarlet. NO armor or cloth at all.
bone=material('Ossuary ivory bone','b9b7aa',.65)
pale=material('Ossuary pale sunlit bone','e1dfd2',.59)
worn=material('Ossuary mineral ochre seams','7d7770',.77)
cavity=material('Ossuary graphite bone recess','292b32',.80)
patina=material('Ossuary cool grey bone facet','979b9c',.69)
steel=material('Ossuary forged sabre steel','778997',.51,.33)
steel_edge=material('Ossuary honed sabre edge','ccd1ca',.48,.23)
leather=material('Ossuary weapon grip','583633',.78)
bronze=material('Ossuary guard brass','c4a577',.52,.26)
wood=material('Ossuary bow yew','72513d',.77)
stringmat=material('Ossuary bowstring','d1c9ab',.8)

# Same world scale, anatomical pivots and elbow/knee targets as the Guardian;
# its Hips/Chest/Arm/Forearm/Thigh/Shin/Boot solver can be used unchanged.
SIDES=[('L',-1),('R',1)]
design={
 'Hips':((0,0,.965),(0,0,1.17),None),
 'Chest':((0,0,1.16),(0,0,1.49),'Hips'),
 'Neck':((0,-.008,1.47),(0,-.009,1.625),'Chest'),
 'Head':((0,-.010,1.616),(0,-.010,1.895),'Neck'),
}
for side,sign in SIDES:
    shoulder=(sign*.276,0,1.43)
    elbow=(sign*.355,.012,1.168)
    wrist=(sign*.373,-.036,.942)
    hip=(sign*.13,0,.985)
    knee=(sign*.146,-.045,.538)
    ankle=(sign*.155,-.003,.115)
    design.update({
        'Arm.'+side:(shoulder,elbow,'Chest'),
        'Forearm.'+side:(elbow,wrist,'Arm.'+side),
        'Hand.'+side:(wrist,(wrist[0],wrist[1]-.045,wrist[2]-.086),'Forearm.'+side),
        'Thigh.'+side:(hip,knee,'Hips'),
        'Shin.'+side:(knee,ankle,'Thigh.'+side),
        'Foot.'+side:(ankle,(ankle[0],-.145,.072),'Shin.'+side),
    })
right=design['Hand.R'][0]
left=design['Hand.L'][0]
design['Grip.R']=(right,(right[0],right[1],right[2]+.24),'Hand.R')
design['Bow.L']=(left,(left[0],left[1],left[2]+.35),'Hand.L')
design['String0']=( (left[0],left[1]+.04,left[2]-.41),
                    (left[0],left[1]-.06,left[2]),'Bow.L')
design['String1']=( (left[0],left[1]+.04,left[2]+.41),
                    (left[0],left[1]-.06,left[2]),'Bow.L')
design['Arrow']=( (left[0],left[1],left[2]),
                  (left[0],left[1]-.5,left[2]),'Bow.L')

arm=bpy.data.armatures.new('Ossuary guardian-IK armature')
rig=bpy.data.objects.new('Skeleton rig',arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
rig.show_in_front=True
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in design.items():
    eb=arm.edit_bones.new(name)
    eb.head=V(head)
    eb.tail=V(tail)
    if parent:eb.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rest={n:(V(h),V(t),p) for n,(h,t,p) in design.items()}
parts=[];soles={}

def mesh(name,vertices,faces,mats,bind,bevel=.006,indices=None,kit='both'):
    """Guardian mesh(): identical 2-segment angular bevel and weighted normals.

    All vertices remain in world rest-pose coordinates for subsequent
    rigid-to-bone skinning; unlike the Guardian's bone-parented art pieces,
    export requires joined SKINNED meshes for the common enemy GLB loader.
    """
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    for m in mats:data.materials.append(m)
    if indices:
        data.polygons.foreach_set('material_index',indices)
    if bevel>0 and len(data.polygons)>=4:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Forged edges','BEVEL')
        modifier.width=bevel
        modifier.segments=2
        modifier.limit_method='ANGLE'
        modifier.angle_limit=.16
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        normal=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        normal.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    parts.append((obj,bind,kit))
    return obj

def profile(name,levels,mats,bind,sides=8,phase=pi/8,kit='both',bevel=.006):
    """Guardian profile(): rings and material-facing value breaks."""
    vertices=[(cx+rx*math.cos(phase+i*math.tau/sides),
               cy+ry*math.sin(phase+i*math.tau/sides),z)
              for z,cx,cy,rx,ry in levels for i in range(sides)]
    faces=[tuple(reversed(range(sides)))]
    colors=[0]
    for row in range(len(levels)-1):
        for i in range(sides):
            a=row*sides+i
            b=row*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
            colors.append((row+(1 if i in (2,3,4) else 0))%len(mats))
    faces.append(tuple(range(len(vertices)-sides,len(vertices))))
    colors.append(len(mats)-1)
    return mesh(name,vertices,faces,mats,bind,bevel,colors,kit)

def plate(name,points,thickness,mat,bind,bevel=.005,kit='both'):
    front=list(points)
    back=[(x,y+thickness,z) for x,y,z in front]
    n=len(front)
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,front+back,faces,[mat],bind,bevel,kit=kit)

def limb(name,a,b,widths,mats,bind,sides=8,kit='both',bevel=.005):
    """Guardian limb(): a genuine tapered low-poly volume, not a cylinder."""
    a,b=V(a),V(b)
    axis=(b-a).normalized()
    u=axis.cross(V((0,1,0)))
    if u.length<.02:u=axis.cross(V((1,0,0)))
    u.normalize()
    v=axis.cross(u)
    vertices=[tuple(a.lerp(b,f)+u*rx*math.cos(i*math.tau/sides)
                       +v*ry*math.sin(i*math.tau/sides))
              for f,rx,ry in widths for i in range(sides)]
    faces=[tuple(reversed(range(sides)))]
    colors=[0]
    for row in range(len(widths)-1):
        for i in range(sides):
            k=row*sides+i
            n=row*sides+(i+1)%sides
            faces.append((k,n,n+sides,k+sides))
            colors.append((i+row)%len(mats))
    faces.append(tuple(range(len(vertices)-sides,len(vertices))))
    colors.append(len(mats)-1)
    return mesh(name,vertices,faces,mats,bind,bevel,colors,kit)

def wear(name,center,rx,ry,rz,bind,material=bone):
    x,y,z=center
    return profile(name,[(z-rz,x,y,rx*.52,ry*.56),
                         (z-rz*.27,x,y,rx,ry),
                         (z+rz*.29,x,y,rx*.9,ry*.86),
                         (z+rz,x,y,rx*.30,ry*.34)],
                   [material,patina,pale],bind,8,bevel=.002)

# Skeleton pelvis. Angular split iliac wings and a central sacrum are
# anatomical bone, never dark gambeson or chest armor.
profile('Sacrum and spine root',[(.886,0,.013,.077,.059),
    (.957,0,.019,.095,.070),(1.025,0,.014,.056,.060)],
    [worn,bone,pale],'Hips')
for side,sign in SIDES:
    plate('Uneven iliac wing '+side,[
        (sign*.018,-.034,1.030),
        (sign*.118,-.054,1.067+sign*.008),
        (sign*.207,-.013,1.004),
        (sign*.163,-.063,.903+sign*.011),
        (sign*.075,-.066,.874)],.070,bone,'Hips',.008)
    limb('Lower pelvic curved rim '+side,
         (sign*.16,-.056,.916),(sign*.071,-.074,.875),
         [(0,.028,.029),(.53,.031,.034),(1,.018,.019)],
         [pale,bone],'Hips')
    wear('Iliac irregular bone callus '+side,
         (sign*.154,-.045,1.014+sign*.010),.026,.025,.026,'Hips',pale)

# Rib cage with actual gaps. Strong ivory rib shapes frame a slender spine,
# not a solid costume torso disguised as an organic skeleton.
for i in range(7):
    z=1.133+i*.052
    x=(.004 if i%2 else -.003)
    wear('Uneven thoracic vertebra '+str(i),(x,.075,z),.057,.044,.027,
         'Chest',bone if i%3 else pale)
    if i in (1,4):
        limb('Exposed spinous process '+str(i),
             (x,.090,z),(x+.012,.151,z+.012),
             [(0,.026,.023),(.5,.018,.013),(1,.006,.008)],
             [bone,worn],'Chest',6)
for side,sign in SIDES:
    for i in range(6):
        z=1.185+i*.052+sign*.004*((i%3)-1)
        width=(.137+.054*math.sin((i+1)*pi/7))*(1+sign*.025*(i%2))
        arc=[
            (sign*.045,.077,z+.029),
            (sign*width*.73,.083,z+.027),
            (sign*width,.005,z),
            (sign*width*.78,-.090,z-.018),
            (sign*.038,-.126,z-.026)]
        for n,(a,b) in enumerate(zip(arc,arc[1:])):
            limb('Anatomical rib %s %s:%d'%(side,i,n),a,b,
                 [(0,.019,.019),(.5,.022,.019),(1,.016,.017)],
                 [pale,bone,patina],'Chest',6,bevel=.003)
        if i in (2,5):
            wear('Healing rib callus '+side+str(i),
                 (sign*width*.87,-.045,z-.010),.025,.018,.022,'Chest')
# Sunlit hard-edged sternum, dark joints between bones, no artificial shirt.
limb('Sternum',(0,-.119,1.176),(0,-.122,1.442),
     [(0,.025,.029),(.4,.034,.026),(.8,.031,.023),(1,.018,.019)],
     [bone,pale,worn],'Chest',8)
for i in range(4):
    wear('Sternum notch '+str(i),(0,-.134,1.23+i*.045),
         .017,.008,.011,'Chest',worn)

# Cervical vertebrae are separated, uneven, and belong to a moving neck.
for i in range(5):
    z=1.484+i*.028
    s=(-1 if i%2 else 1)
    wear('Neck vertebra %d'%i,
         (s*(.004+i*.0009),.029,z),.043-.002*i,.036,.019,
         'Neck',pale if i%2 else bone)
    limb('Asymmetric cervical spine wing %d'%i,
        (s*.014,.061,z),(s*.037,.093,z+.013),
        [(0,.019,.014),(.6,.014,.011),(1,.006,.007)],
        [bone,worn],'Neck',6,bevel=.002)
    if i in (1,3):
        wear('Cervical joint recess %d'%i,(0,-.006,z-.012),
             .028,.011,.006,'Neck',worn)

# Guardian HELMET geometry idiom reused as a skull, but with wide orbital
# cavities, zygomatic arches and exposed teeth, not a white faceless helmet.
profile('Ossuary cranium',[(1.552,0,.001,.066,.063),
    (1.608,0,-.001,.115,.102),
    (1.701,0,.012,.156,.137),
    (1.784,0,.016,.160,.142),
    (1.852,0,.020,.126,.113),
    (1.916,0,.027,.055,.051)],
    [worn,bone,pale,patina,bone],'Head',12,bevel=.009)
profile('Cheek and jaw mass',[(1.540,0,-.042,.070,.048),
    (1.583,0,-.065,.126,.083),
    (1.628,0,-.058,.124,.105),
    (1.658,0,-.052,.071,.080)],
    [worn,bone,pale],'Head',8,bevel=.005)
# Orbital depression is a deep graphite insert, bounded by ivory brow ridges.
for side,sign in SIDES:
    plate('Black orbital cavity '+side,[
        (sign*.022,-.146,1.760),
        (sign*.103,-.148,1.761),
        (sign*.123,-.133,1.697),
        (sign*.097,-.147,1.655),
        (sign*.038,-.159,1.655)],
        .009,cavity,'Head',.002)
    limb('Brow ridge '+side,(sign*.015,-.149,1.770),
        (sign*.131,-.136,1.767),
        [(0,.020,.017),(.45,.027,.021),(1,.016,.018)],
        [pale,bone],'Head',8)
    limb('Cheekbone arch '+side,(sign*.128,-.117,1.675),
        (sign*.066,-.157,1.618),
        [(0,.025,.022),(.5,.026,.020),(1,.015,.013)],
        [bone,pale],'Head')
    limb('Hairline fracture '+side,(sign*.033,-.115,1.840),
        (sign*.105,-.099,1.787+sign*.011),
        [(0,.007,.005),(1,.002,.002)],[worn],'Head',6,bevel=.001)
plate('Nasal black cavity',[
    (-.020,-.176,1.675),(.019,-.176,1.675),
    (.032,-.173,1.624),(0,-.181,1.611),(-.032,-.173,1.624)],
    .006,cavity,'Head',.001)
for i in range(6):
    x=(i-2.5)*.029
    plate('Enamel tooth %d'%i,[
        (x-.010,-.157,1.607),(x+.010,-.158,1.607),
        (x+.008,-.159,1.581),(x-.009,-.158,1.583)],
        .009,pale,'Head',.001)

for side,sign in SIDES:
    shoulder,elbow,_=design['Arm.'+side]
    wrist=design['Hand.'+side][0]
    hip,knee,_=design['Thigh.'+side]
    ankle=design['Foot.'+side][0]
    limb('Humerus '+side,shoulder,elbow,
        [(0,.055,.056),(.14,.063,.054),(.43,.034,.035),
         (.78,.038,.036),(1,.053,.052)],
        [pale,bone,patina],'Arm.'+side)
    wear('Shoulder condyle '+side,shoulder,.066,.058,.064,'Arm.'+side)
    wear('Distal humeral condyle '+side,elbow,.060,.053,.055,'Arm.'+side)
    limb('Radius '+side,elbow,wrist,
        [(0,.032,.030),(.16,.034,.027),(.72,.020,.021),
         (1,.027,.031)],[bone,pale],'Forearm.'+side,8)
    offset=V((sign*.025,.012,0))
    limb('Ulna '+side,V(elbow)+offset*.5,V(wrist)+offset,
        [(0,.026,.021),(.45,.019,.018),(1,.023,.025)],
        [patina,bone],'Forearm.'+side,8)
    wear('Carpal cluster '+side,wrist,.050,.045,.047,'Hand.'+side)
    for finger in range(4):
        dx=(finger-1.5)*.022
        origin=V(wrist)+V((dx,-.057,-.048))
        limb('Bare phalange '+side+str(finger),origin,
            origin+V((0,-.027,-.043)),
            [(0,.013,.012),(1,.007,.009)],[bone,pale],'Hand.'+side,6,.0)
    # Hip bones are exposed, never shoulder or shin armor.
    limb('Femur '+side,hip,knee,[
        (0,.074,.073),(.13,.078,.068),(.46,.046,.047),
        (.76,.041,.043),(1,.064,.060)],
        [pale,bone,patina],'Thigh.'+side)
    wear('Femoral condyle '+side,knee,.071,.054,.056,'Thigh.'+side)
    limb('Tibia '+side,knee,ankle,[
        (0,.049,.048),(.14,.046,.045),(.54,.029,.031),
        (.84,.034,.033),(1,.044,.048)],
        [bone,pale],'Shin.'+side)
    limb('Fibula '+side,
        V(knee)+V((sign*.037,.002,0)),
        V(ankle)+V((sign*.032,.015,0)),
        [(0,.019,.018),(.5,.015,.014),(1,.013,.015)],
        [patina,bone],'Shin.'+side,6,bevel=.002)
    wear('Uncovered ankle '+side,ankle,.054,.061,.047,'Foot.'+side)
    foot=profile('Heel and metatarsals '+side,
        [(.026,sign*.155,-.105,.074,.130),
         (.060,sign*.155,-.083,.093,.147),
         (.104,sign*.155,-.037,.078,.114),
         (.151,sign*.155,-.007,.056,.089)],
        [worn,bone,pale],'Foot.'+side,8)
    soles[side]=[v.co.copy() for v in foot.data.vertices]
    for toe in range(4):
        x=sign*.155+(toe-1.5)*.032
        limb('Phalanx toe %s%d'%(side,toe),(x,-.132,.052),
            (x,-.205+.010*abs(toe-1.5),.041),
            [(0,.016,.018),(.5,.017,.016),(1,.008,.010)],
            [pale,bone],'Foot.'+side,6,bevel=.002)

# Actual weapons, no shield and no costume. The sword is patterned after the
# Guardian's thick forged blade and narrow, crisp, bright cutting edge.
grip=V(right)
limb('Saber wrapped grip',grip+V((0,0,-.115)),
    grip+V((0,0,.14)),
    [(0,.034,.033),(.2,.029,.027),(.80,.028,.028),(1,.029,.027)],
    [leather,bronze],'Grip.R',8,'sabre',.004)
limb('Saber swept crossguard',grip+V((-.115,-.02,.14)),
    grip+V((.115,-.02,.14)),
    [(0,.012,.019),(.21,.026,.027),(.79,.026,.027),(1,.012,.020)],
    [steel,bronze,steel_edge],'Grip.R',8,'sabre')
limb('Heavy sabre blade',grip+V((0,-.01,.145)),
    grip+V((.080,-.11,.78)),
    [(0,.044,.023),(.16,.050,.030),(.51,.050,.026),
     (.78,.036,.018),(1,.002,.003)],
    [steel,steel_edge,steel],'Grip.R',8,'sabre',.008)
limb('Saber sharpened cutting edge',grip+V((-.028,-.018,.22)),
    grip+V((.068,-.126,.765)),
    [(0,.008,.007),(.55,.012,.008),(1,.002,.002)],
    [steel_edge],'Grip.R',6,'sabre',.003)
wear('Saber pommel',tuple(grip+V((0,0,-.137))),
     .041,.040,.045,'Grip.R',bronze)

bow=V(left)
# Bow arcs in x/z with actual depth, not a 2D line.
bowpts=[(-.12,.41),(-.11,.31),(-.065,.16),(-.020,0),
        (-.065,-.16),(-.11,-.31),(-.12,-.41)]
for i,((y0,z0),(y1,z1)) in enumerate(zip(bowpts,bowpts[1:])):
    a=bow+V((0,y0,z0))
    b=bow+V((0,y1,z1))
    limb('Bow yew limb %d'%i,a,b,
         [(0,.014,.016),(.5,.023,.022),(1,.014,.016)],
         [wood,worn],'Bow.L',8,'bow',.002)
limb('Bow handle',bow+V((0,-.027,-.12)),
     bow+V((0,-.027,.12)),[(0,.028,.027),(1,.028,.027)],
     [leather,wood],'Bow.L',8,'bow')
for i,sign in enumerate((-1,1)):
    head=V(design['String'+str(i)][0])
    tail=V(design['String'+str(i)][1])
    limb('Bow live string %d'%i,head,tail,
         [(0,.005,.005),(1,.005,.005)],[stringmat],
         'String'+str(i),6,'bow',.0)
limb('Nocked arrow',bow+V((0,-.01,0)),bow+V((0,-.61,0)),
     [(0,.011,.010),(.5,.010,.010),(1,.008,.009)],
     [wood],'Arrow',8,'bow',.0)
limb('Arrow barbed head',bow+V((0,-.59,0)),bow+V((0,-.67,0)),
     [(0,.028,.018),(.6,.021,.015),(1,.001,.001)],
     [steel_edge],'Arrow',8,'bow',.002)

# Bind geometry with vertex groups to the same armature and apply Guardian
# bevels / weighted normals BEFORE export. The other enemy and Guardian both
# use one continuous AnimationMixer track rather than sprite blending.
groups={}
for obj,bone_name,kit in parts:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world=Matrix.Identity(4)
    group=obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    groups.setdefault(kit,[]).append(obj)
meshes={}
for kit,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs:obj.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.join()
    ob=objs[0]
    ob.name='Skeleton • '+kit
    ob.parent=rig
    modifier=ob.modifiers.new('Guardian-pattern rigid bone skin','ARMATURE')
    modifier.object=rig
    meshes[kit]=ob

def orient(name,position,rotation):
    anchor=rest[name][0]
    matrix=Matrix.Translation(position)@rotation.to_4x4()@Matrix.Translation(-anchor)
    rig.pose.bones[name].matrix=matrix@rig.data.bones[name].matrix_local
    bpy.context.view_layer.update()

def attached(name,position):
    frame=rig.pose.bones[name].matrix@rig.data.bones[name].matrix_local.inverted()
    return frame@position

def point(name,head,tail,stretch=1):
    start,end,_=rest[name]
    forward=(end-start).normalized()
    travel=V(tail)-V(head)
    if travel.length<.00001:return
    transform=forward.rotation_difference(travel).to_matrix()
    if stretch!=1:
        scale=Matrix.Identity(3)
        for row in range(3):
            for column in range(3):
                scale[row][column]+=(stretch-1)*forward[row]*forward[column]
        transform@=scale
    orient(name,V(head),transform)

def bend_joint(upper,lower,a,end,bias,stretch=1):
    """Guardian two-link IK, preserving segment lengths and knee bend."""
    a,end=V(a),V(end)
    ab=(rest[upper][1]-rest[upper][0]).length
    bc=(rest[lower][1]-rest[lower][0]).length
    delta=end-a
    scale=max(1,min(stretch,(delta.length+.001)/(ab+bc)))
    ab*=scale;bc*=scale
    axis=delta.normalized() if delta.length>.001 else V((0,-1,0))
    distance=max(abs(ab-bc)+.001,min(ab+bc-.001,delta.length))
    offset=(ab*ab-bc*bc+distance*distance)/(2*distance)
    normal=V(bias)-axis*axis.dot(V(bias))
    if normal.length<.001:normal=axis.cross(V((1,0,0)))
    normal.normalize()
    knee=a+axis*offset+normal*math.sqrt(max(0,ab*ab-offset*offset))
    goal=a+axis*distance
    point(upper,a,knee,scale)
    point(lower,knee,goal,scale)
    return goal

def smooth(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

def sample(keys,t):
    for (a,*start),(b,*end) in zip(keys,keys[1:]):
        if t<=b:
            k=smooth((t-a)/max(.00001,b-a))
            return [v+(w-v)*k for v,w in zip(start,end)]
    return keys[-1][1:]

def gait_foot(phase,stride=.44,stance=.60,clearance=.16):
    """Guardian stance/swing solver, re-tuned for bonier, less damped feet."""
    if phase<stance:
        travel=stride*(phase/stance-.5)
        lift=0
        pitch,=sample([(0,-12),(.20,0),(.63,0),(1,28)],phase/stance)
    else:
        t=(phase-stance)/(1-stance)
        arc=math.sin(pi*t)
        carry=(1-stance)/(math.tau*stance)
        progress=smooth(t)-carry*math.sin(math.tau*t)*(1-.65*arc)-.095*arc*arc
        travel=stride*(.5-progress)
        lift=clearance*arc**1.35
        pitch,=sample([(0,26),(.3,16),(.55,2),(.82,-12),(1,-12)],t)
    return travel+.075,lift,math.radians(pitch)

def place_foot(side,sign,travel,lift,pitch,width=0):
    name='Foot.'+side
    ankle=rest[name][0]
    rotation=Euler((pitch,0,sign*.04)).to_matrix()
    lowest=min((rotation@(v-ankle)).z for v in soles[side])
    end=V((ankle.x+sign*width,travel,.012+lift-lowest))
    hip=attached('Hips',rest['Thigh.'+side][0])
    pos=bend_joint('Thigh.'+side,'Shin.'+side,
                   hip,end,(sign*.14,-1,.055),1.035)
    orient(name,pos,rotation)

def blade_vector(yaw,angle):
    return V((math.sin(yaw)*math.cos(angle),
             -math.cos(yaw)*math.cos(angle),math.sin(angle)))

def sample_pose(kind,t):
    """Guardian's torso->head->planted-feet->IK-hands evaluation order."""
    for pb in rig.pose.bones:
        pb.matrix_basis=Matrix.Identity(4)
        pb.rotation_mode='QUATERNION'
        pb.scale=(1,1,1)
    bpy.context.view_layer.update()
    phase=math.tau*t
    swing=math.cos(phase)
    locomotion=kind=='run'
    sword=kind=='strike'; archery=kind=='shoot'
    if locomotion:
        bob=.020+.029*(1-math.cos(phase*2))/2
        hips=rest['Hips'][0]+V((-.037*math.sin(phase-.13),-.018,bob-.062))
        pelvic_yaw=.096*math.cos(phase+.15)
        thorax_yaw=-.132*math.cos(phase-.38)
        pitch=.12+.029*math.sin(phase-.17)
    else:
        hips=rest['Hips'][0]+V((.013*math.sin(phase),0,-.034+.007*math.sin(phase)))
        pelvic_yaw=.020*math.sin(phase)
        thorax_yaw=-.027*math.sin(phase-.3)
        pitch=.032+.010*math.sin(phase)
    if sword:
        # Anticipation and contact are distinct deliberate cinematic poses.
        yaw,fore,drop,lean,handx,handy,handz,blade_yaw,blade_elev=sample([
         (0,0,0,0,.055, -.36,-.095,1.01,.25,-.27),
         (.16,-.28,.028,.055,-.12,-.37,.06,1.04,1.65,1.10),
         (.43,-.70,.090,.108,-.25,-.43,.13,1.48,2.58,1.40),
         (.48,-.73,.093,.112,-.27,-.44,.11,1.50,2.63,1.36),
         (.58,.36,-.146,.048,.20,-.39,-.43,1.12,-1.23,-.16),
         (.70,.91,-.105,.090,.31,-.18,-.49,.87,-1.69,-.57),
         (.82,.31,-.026,.040,.18,-.31,-.19,.93,-.81,-.38),
         (1,0,0,0,.055,-.36,-.095,1.01,.25,-.27)],t)
        hips=rest['Hips'][0]+V((yaw*.055,fore,-drop))
        pelvic_yaw=yaw*.56
        thorax_yaw=yaw
        pitch=lean
    elif archery:
        draw=smooth((t-.035)/.42)
        release=smooth((t-.63)/.075)
        recovery=smooth((t-.83)/.17)
        load=draw*(1-recovery)
        hips=rest['Hips'][0]+V((-.022*load,.042*load,-.034))
        pelvic_yaw=-.15*load+.11*release
        thorax_yaw=-.32*load+.27*release
        pitch=-.16*load+.20*release
    orient('Hips',hips,Euler((pitch*.35,.034*math.sin(phase),pelvic_yaw)).to_matrix())
    chest=attached('Hips',rest['Chest'][0])
    chest_rotation=Euler((pitch,.028*math.sin(phase-.3),thorax_yaw)).to_matrix()
    orient('Chest',chest,chest_rotation)
    neck=attached('Chest',rest['Neck'][0])
    neckrot=Euler((pitch*.52-.037*math.sin(phase-.38),
                    .016*math.sin(phase-.7),thorax_yaw*.65)).to_matrix()
    orient('Neck',neck,neckrot)
    head=attached('Neck',rest['Head'][0])
    headrot=Euler((pitch*.24-.037*math.sin(phase-.83),
                    .022*math.sin(phase-1.1),thorax_yaw*.35)).to_matrix()
    orient('Head',head,headrot)
    for side,sign in SIDES:
        if locomotion:
            footphase=(t+(0 if sign<0 else .5))%1
            travel,lift,footpitch=gait_foot(footphase)
        elif sword:
            travel,lift,footpitch=(-.12 if sign<0 else .13),0,.14 if sign>0 else 0
        elif archery:
            travel,lift,footpitch=(.13 if sign<0 else -.07),0,0
        else:
            travel,lift,footpitch=sign*.06,0,0
        place_foot(side,sign,travel,lift,footpitch,.025)
        shoulder=attached('Chest',rest['Arm.'+side][0])
        if sword and sign>0:
            wrist=V((handx,handy,handz))
        elif sword:
            wrist=shoulder+V((-.044,-.095,-.384+.085*abs(yaw)))
        elif archery:
            if sign<0:
                wrist=V((-.30,-.17-.34*load,1.12+.35*load))
            else:
                wrist=V((-.34,-.14+.46*draw*(1-release),1.13+.33*load))
        else:
            lean=math.cos(phase-.45)
            legphase=lean*sign
            reach=.18 if locomotion else .027
            wrist=shoulder+V((sign*.052,-.09+reach*legphase,
                               -.365+.03*math.sin(phase-.24)*sign))
        end=bend_joint('Arm.'+side,'Forearm.'+side,
                       shoulder,wrist,(sign*.52,.76,-.1),1.05)
        point('Hand.'+side,end,end+V((0,-.052,-.102)))
        if side=='R':
            if sword:
                direction=blade_vector(blade_yaw,blade_elev)
            elif locomotion:
                direction=blade_vector(.45+.12*math.sin(phase-.7),-.38)
            else:
                direction=blade_vector(.32,-.36)
            point('Grip.R',end,end+direction)
        else:
            # The bow is vertical, following left hand and shoulder pose.
            point('Bow.L',end,end+V((0,-.08,.95)))
    if archery:
        bowhead=attached('Bow.L',rest['Bow.L'][0])
        bowquat=rig.pose.bones['Bow.L'].matrix.to_quaternion()
        # The two string halves remain curved to the visible drawing hand.
        nock=bowhead+V((0,.08+.42*draw*(1-release),.0))
        for i,sign in enumerate((-1,1)):
            tip=attached('Bow.L',rest['String'+str(i)][0])
            point('String'+str(i),tip,nock)
        point('Arrow',nock,nock+V((0,-.62,0)))
        if t>=.71:
            rig.pose.bones['Arrow'].scale=(.0001,.0001,.0001)
    if kind=='death':
        fall=smooth((t-.08)/.70)
        for i,(name,(anchor,tail,parent)) in enumerate(rest.items()):
            if name in ('String0','String1','Arrow'):continue
            rot=(2.3*i + .3)
            dist=.11+.16*((i*5)%7)/7
            floor=V((anchor.x*.87+dist*math.cos(rot),
                     anchor.y*.32+dist*math.sin(rot),
                     .085+(.085 if name=='Head' else .025)))
            where=attached(name,anchor).lerp(floor,fall)
            rotation=Euler((1.3*fall,.17*math.sin(i)*fall,.85*math.sin(rot)*fall)).to_matrix()
            orient(name,where,rotation)
    bpy.context.view_layer.update()

clips={'idle':8,'run':12,'strike':12,'shoot':12,'death':12}
for clip in clips:
    action=bpy.data.actions.new(clip)
    action.use_fake_user=True
    rig.animation_data_create().action=action
    for i in range(25):
        t=i/24
        scene.frame_set(1+2*i)
        sample_pose(clip,t)
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='location',frame=1+2*i)
            pb.keyframe_insert(data_path='rotation_quaternion',frame=1+2*i)
            pb.keyframe_insert(data_path='scale',frame=1+2*i)

scene.frame_end=49
scene.render.fps=48
rig.animation_data.action=bpy.data.actions['idle']
scene.frame_set(1)
meshes['bow'].hide_viewport=True
meshes['bow'].hide_render=True
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(out/'skeleton.blend'),compress=True)

# CI can publish new live GLBs without waiting for the expensive Cycles
# 32-facing fallback atlases. Default keeps full atlas generation unchanged.
if os.environ.get("MIND_DUNGEON_RIG_ONLY") != "1":
    # Batch evaluated Blender geometry into an orthographic contact sheet so one
    # Cycles render covers every facing and sample of a clip.
    scene.render.engine='CYCLES';scene.cycles.samples=26;scene.cycles.use_denoising=False  # GitHub Blender build lacks OpenImageDenoiser
    scene.render.image_settings.file_format='WEBP';scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.quality=96
    scene.render.film_transparent=True;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Ambient skylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.60,.66,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.49
    camdata=bpy.data.cameras.new('Atlas orthographic');cam=bpy.data.objects.new('Atlas camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
    camdata.type='ORTHO';camdata.clip_end=300;cam.location=(0,0,20)
    for name,color,power,direction in [('Key', (1,.88,.76),2.7,(.4,-.7,1)),('Rim',(.56,.72,1),1.15,(-1,.6,.4))]:
        light=bpy.data.lights.new(name,'SUN');light.energy=power;light.color=color;light.angle=.4
        obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj)
        obj.rotation_euler=(-V(direction)).to_track_quat('-Z','Y').to_euler()
    for obj in meshes.values():obj.hide_render=True;obj.hide_viewport=False
    mats=list(dict.fromkeys(m for ob in meshes.values() for m in ob.data.materials))
    pitch=math.atan(1/math.sqrt(2));view=rotation(pitch-pi/2);cell=3.35
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
            scene.render.resolution_x=count*PIXELS;scene.render.resolution_y=FACINGS*PIXELS
            camdata.ortho_scale=max(count,FACINGS)*cell
            scene.render.filepath=str(out/(kit+'-'+clip+'.webp'))
            bpy.ops.render.render(write_still=True)
            bpy.data.objects.remove(batch,do_unlink=True);bpy.data.meshes.remove(data)
