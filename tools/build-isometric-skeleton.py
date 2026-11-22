"""Run from repository root: blender -b -t 4 -P tools/build-isometric-skeleton.py.
Build a Guardian-style undead warrior rig and 32-view fallback animation atlases.
Each sheet has animation time along X and camera-relative facing along Y.
"""
import math
import os
import importlib.util
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Euler


out = Path.cwd() / 'beta/art/skeleton'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
# Retain the high-contrast atlas preset for the sprite fallback.
# The live GLB uses the Guardian's Three.js ACES light rig instead.
scene.view_settings.view_transform = 'Standard'
try:
    scene.view_settings.look = 'Medium High Contrast'
except TypeError:
    pass  # Some Blender versions omit this color-management preset.
style_spec = importlib.util.spec_from_file_location("guardian_style", Path.cwd() / "tools" / "guardian-style.py")
style = importlib.util.module_from_spec(style_spec)
style_spec.loader.exec_module(style)
V = Vector
pi = math.pi
FACINGS = 32  # 360 degrees, independent baked 3D views; NO translucent view crossfades.
PIXELS = 128
def srgb_to_linear(value):
    # Match the Guardian builder: artist palette floats are sRGB, not
    # linear radiometric values. Feeding them directly into the BSDF made
    # our GLBs unnaturally bright/flat under the identical Three.js lights.
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def material(name, color, metal=0, roughness=None):
    m = bpy.data.materials.new(name)
    linear = tuple(srgb_to_linear(v) for v in color)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    node = m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*linear, 1)
    node.inputs['Metallic'].default_value = metal
    # Guardian plates are roughness ~.48-.61. Formerly everything here
    # was .75, causing steel, bronze and bone to read like dull clay.
    node.inputs['Roughness'].default_value = (
        roughness if roughness is not None else (.52 if metal >= .25 else .68))
    return m
# Hero reference: bright desaturated bone, cool blue forged steel and
# graphite cavities. The old warm yellow bone blended into dungeon floors.
ivory = material('Weathered ivory', (.83,.82,.79), roughness=.64)
edge = material('Pale worn bone', (.95,.94,.91), roughness=.57)
dark = material('Deep sockets', (.012,.012,.020))
bronze = material('Hammered bronze', (.69,.52,.29), .29, .53)
steel = material('Forged charcoal steel', (.47,.56,.64), .33, .51)
leather = material('Oxblood leather', (.19,.069,.034))
wood = material('Yew', (.34,.155,.052))
aged = material('Bone shadows and age lines', (.23,.18,.15))
trim = material('Polished battered brass', (.78,.65,.44), .26, .49)
# Explicit same sRGB swatches as Guardian build-player-sprite-study.py:
# Gunmetal insets #343f54; padded graphite #232534. The previous values
# were nearly black (P10≈6), unlike the Guardian's readable P10≈38.
iron_dark = material('Dark recesses between armor plates', (.204,.247,.329), .15, .61)
graphite = material('Graphite ribcage negative space', (.137,.145,.204), roughness=.67)
sabre_edge = material('Sharpened steel cutting edge', (.86,.91,.89), .48)
scar = material('Bone fracture stains', (.20,.19,.175))
parts = []
joints = {}
def joint(name, pos, parent=None):
    joints[name] = (V(pos), parent)
def part(obj, name, bone, mat, kit='both'):
    obj.name = name
    if not obj.data.materials:
        obj.data.materials.append(mat)
    parts.append((obj,bone,kit))
def oval(name,bone,p,scale,mat=ivory,kit='both'):
    obj=style.faceted_oval(name,p,scale,mat,sides=8)
    part(obj,name,bone,mat,kit)
def rod(name,bone,a,b,r,r2=None,mat=ivory,kit='both'):
    a,b=V(a),V(b)
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r,radius2=r if r2 is None else r2,
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
joint('Neck',(0,-.012,1.465),'Chest')
joint('Skull',(0,-.015,1.57),'Neck')
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
        z=1.18+i*.055+s*.004*((i%3)-1)
        w=(.147+.054*math.sin((i+1)*pi/7))*(1+.043*s*((i%3)-1))
        arc=[(s*.025,.035,z+.036),(s*w*.8,.065,z+.026),(s*w,.005,z),(s*w*.81,-.085,z-.026),(s*.04,-.106,z-.035)]
        for k,(a,b) in enumerate(zip(arc,arc[1:])):rod('Rib','Chest',a,b,.018,.016,edge)
# The rib openings previously showed the floor, giving a transparent,
# muddy appearance. A graphite cavity layer echoes the Guardian's dark
# padded undercoat and makes each ivory rib a legible high-value shape.
core=style.profile_mesh('Ribcage graphite shadow core',[
    (1.025,0,.043,.115,.092),
    (1.100,0,.043,.157,.106),
    (1.260,0,.040,.173,.113),
    (1.382,0,.044,.163,.113),
    (1.465,0,.043,.106,.075),
], [graphite,iron_dark], axis='z', sides=10,
   face_material=lambda band,face: 1 if face in (1,2,3) else 0)
part(core,'Ribcage graphite shadow core','Chest',graphite)
for i in range(9):
    z=1+i*.065
    oval('Vertebra','Chest',(0,.028,z),(.047,.052,.034))
rod('Sternum','Chest',(0,-.107,1.19),(0,-.102,1.44),.027,.038)
# Imperfect cervical vertebrae and spinous processes follow their own Neck
# bone: the skull can lag behind the loose rib cage instead of being welded.
for i in range(5):
    z=1.448+i*.022+(.004 if i in (1,4) else -.002)
    x=(-1 if i%2 else 1)*(.005+.002*(i%3))
    oval('Cervical vertebra body','Neck',(x,.012,z),
         (.046-.004*i,.040,.015),edge if i in (1,3) else ivory)
    oval('Cervical disc eroded recess','Neck',(x*.65,-.025,z-.010),
         (.028,.011,.007),aged)
    rod('Uneven cervical spinous process','Neck',
        (x,.044,z-.003),(x+(.012 if i%2 else -.008),.083,z+.010),
        .013,.005,ivory)
    if i in (1,3):
        rod('Cervical transverse wing','Neck',(x-.035,.020,z),
            (x-.061,.027,z+.008),.013,.006,edge)
for side,sign in [('L',1),('R',-1)]:
    rod('Uneven scapular ridge','Arm'+side,
        (sign*.19,.073,1.39),(sign*.31,.11,1.46+sign*.009),
        .033,.017,ivory)
    oval('Scapular chipped edge','Arm'+side,
         (sign*.293,.079,1.481+sign*.010),(.048,.037,.029),edge)
    rod('Clavicle worn protuberance','Chest',
        (sign*.14,-.064,1.470),(sign*.19,-.071,1.477+sign*.008),
        .022,.013,aged if sign<0 else edge)
# Unlike the old UV-sphere skull, this has deliberately cut planar
# forehead, temples, cheek and crown facets at the Guardian's screen size.
cranium = style.profile_mesh('Cranium', [
    (1.550,0,.004,.070,.060),
    (1.610,0,.004,.137,.106),
    (1.728,0,.013,.159,.140),
    (1.810,-.008,.018,.143,.121),
    (1.875,.009,.013,.087,.069),
    (1.900,0,.014,.020,.021),
], [ivory, edge, aged], axis='z', sides=10,
    face_material=lambda band,side:
        1 if band in (2,3,4) and side in (6,7,8,9) else
        2 if side in (1,2) and band < 3 else 0)
part(cranium,'Cranium','Skull',ivory)
maxilla = style.profile_mesh('Maxilla', [
    (1.585,0,-.071,.069,.051),
    (1.622,0,-.066,.112,.095),
    (1.687,0,-.055,.121,.091),
    (1.713,0,-.049,.062,.060),
], [ivory,edge], axis='z', sides=8,
    face_material=lambda band,side: 1 if side in (5,6,7) else 0)
part(maxilla,'Maxilla','Skull',ivory)
jaw = style.profile_mesh('Angular lower jaw', [
    (1.542,0,-.056,.066,.043),
    (1.569,0,-.055,.113,.072),
    (1.601,0,-.055,.096,.074),
], [ivory,edge], axis='z', sides=8)
part(jaw,'Angular lower jaw','Skull',ivory)
for s in (-1,1):
    oval('Orbit','Skull',(s*.065,-.115,1.71),(.048,.023,.052),dark)
    rod('Brow','Skull',(s*.018,-.124,1.749),(s*.12,-.089,1.755),.022,.026,edge)
    oval('Zygoma','Skull',(s*.103,-.099,1.653),(.042,.037,.034),edge)
oval('Nasal cavity','Skull',(0,-.149,1.659),(.023,.015,.029),dark)
for i in range(6):
    oval('Tooth','Skull',((i-2.5)*.027,-.137+abs(i-2.5)*.004,1.609),(.013,.015,.024),edge)
# First skeleton: no armor, padding, clothing, belts or shoulder plates.
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


# ---------------------------------------------------------------------------
# Anatomical detailing remains on bones, never an armor overlay.
# The visible wear is large enough to read from the isometric game camera.
# ---------------------------------------------------------------------------
def shape(name,bone,vertices,faces,mat,kit='both'):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    part(obj,name,bone,mat,kit)
    return obj
for side,sign in [('L',1),('R',-1)]:
    rod('Cranial fracture','Skull',(sign*.041,-.124,1.833),
        (sign*.097,-.102,1.779+sign*.009),.009,.003,scar)
    rod('Forked skull crack','Skull',(sign*.083,-.114,1.793),
        (sign*.117,-.074,1.755),.005,.002,aged)
    oval('Temporal bone chipped hollow','Skull',
         (sign*.139,-.067,1.692+sign*.007),(.024,.018,.050),aged)
    rod('Uneven zygomatic arch','Skull',(sign*.111,-.114,1.666),
        (sign*.065,-.136,1.623+sign*.006),.020,.013,edge)
    for rib_index in (1,3,4):
        z=1.18+rib_index*.055+sign*.005
        oval('Healed rib callus','Chest',
             (sign*(.147+.018*(rib_index%2)),-.074,z),
             (.023,.017,.017),edge if rib_index!=3 else aged)
    oval('Pelvic rough iliac crest','Pelvis',
         (sign*.127,-.019,.981+sign*.009),(.070,.058,.030),edge)
    rod('Irregular pelvic ridge','Pelvis',(sign*.142,-.035,1.003),
        (sign*.177,-.008,.925+sign*.010),.024,.010,ivory)
    for bone,loc in [('Shin'+side,(sign*.142,-.051,.338)),
                     ('Forearm'+side,(sign*.319,-.054,1.123))]:
        oval('Old bone callus',bone,loc,(.043,.032,.047),edge)
        rod('Old fracture line',bone,
            (loc[0]-.026,loc[1]-.025,loc[2]+.040),
            (loc[0]+.025,loc[1]-.020,loc[2]-.019),
            .006,.002,aged)
# ---------------------------------------------------------------------------
# A dimensional saber blade, not a flat strip disappearing edge-on.
# Widen the silhouette at its middle, form a swept tip and sharpen both
# surfaces with real polygon thickness and a bright edge.
def forged_sabre():
    spine=[(0,-.020,.09),(.015,-.030,.23),(.021,-.047,.46),
           (.045,-.080,.65),(.087,-.142,.84)]
    cutting=[(.029,.031,.09),(.038,.032,.23),(.040,.023,.46),
             (.027,-.016,.65),(.087,-.142,.84)]
    z=.013
    points=[]
    for a,b in zip(spine,cutting):
        points.extend([
            at(grip,(a[0],a[1]-z,a[2])),
            at(grip,(a[0],a[1]+z,a[2])),
            at(grip,(b[0],b[1]-z*.35,b[2])),
            at(grip,(b[0],b[1]+z*.35,b[2])),
        ])
    faces=[]
    for i in range(len(spine)-1):
        k=i*4
        faces.extend([(k,k+4,k+6,k+2),
                      (k+1,k+3,k+7,k+5),
                      (k,k+1,k+5,k+4),
                      (k+2,k+6,k+7,k+3)])
    shape('Forged swept saber blade','HandR',points,faces,steel,'sabre')
    for i in range(4):
        a=at(grip,cutting[i]);b=at(grip,cutting[i+1])
        rod('Ground saber cutting edge','HandR',a,b,.007,.004,sabre_edge,'sabre')
    rod('Saber fuller groove','HandR',at(grip,(0,-.047,.18)),
        at(grip,(.034,-.095,.64)),.008,.006,iron_dark,'sabre')
    oval('Bronze pommel','HandR',at(grip,(0,0,-.17)),
         (.042,.041,.048),trim,'sabre')
    oval('Saber crossguard rivet','HandR',at(grip,(0,-.045,.09)),
         (.028,.019,.029),trim,'sabre')

# Hide the original wafer-thin falchion mesh: the new 3D forged version has
# proper highlights in every facing and will never disappear edge-on.
parts[:]=[(o,b,k) for (o,b,k) in parts if o.name not in
         ('Curved falchion','Ground bevel')]
for obj in list(bpy.data.objects):
    if obj.name in ('Curved falchion','Ground bevel'):
        bpy.data.objects.remove(obj,do_unlink=True)
forged_sabre()

# No shield, quiver or decoration: only weapon and bare bones.

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
    if kit=='sabre' and bone=='HandR':
        world=Matrix.Translation(grip)@Matrix.Rotation(1.34,4,'X')@Matrix.Translation(-grip)@world
    obj.data.transform(world);obj.matrix_world=Matrix.Identity(4)
    # Bake the same bevel + weighted-normal strategy as the Guardian's
    # plated surfaces; leave anatomical shafts and sculpted facets crisp.
    name=obj.name.lower()
    if any(token in name for token in (
        'plate','guard','buckler','cuff','buckle','forged swept',
        'cuirass','greave','quiver','saber blade','saber crossguard','riveted')):
        style.forged_hard_edges(obj, width=.0035)
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
    phase=2*pi*t;swing=math.sin(phase);cycle=math.cos(phase)
    local={n:Matrix.Identity(4) for n in joints}
    run=clip=='run';shoot=clip=='shoot'
    if run:
        # Loose but coherent locomotion: pelvis leads, shoulders counter,
        # cervical vertebrae and skull follow with delayed momentum.
        bounce=.023+.041*(1-math.cos(2*phase))*.5
        local['Pelvis']=Matrix.Translation((.030*swing,-.018*cycle,bounce))@rotation(
            .047*cycle,.033*swing,.112*swing)
        local['Chest']=rotation(.105+.058*math.sin(phase+.44),
            .061*cycle,-.156*math.sin(phase-.26))
        local['Neck']=rotation(-.043-.067*math.sin(phase-.51),
            .028*math.cos(phase-.42),.059*math.sin(phase-.50))
        local['Skull']=rotation(-.067+.079*math.sin(phase-.75),
            .025*cycle,-.056*math.sin(phase-.82))
    else:
        local['Pelvis']=Matrix.Translation((.008*swing,0,.007*cycle))@rotation(
            .015*swing,0,.012*cycle)
        local['Chest']=rotation(.034+.021*swing,.015*cycle,-.028*swing)
        local['Neck']=rotation(-.026+.041*math.sin(phase-.65),0,.038*math.sin(phase-.6))
        local['Skull']=rotation(.031*math.sin(phase-.9),.020*cycle,
                               -.035*math.sin(phase-1.0))
    for side,sign in [('R',1),('L',-1)]:
        stride=sign*swing;flight=max(0,-stride)
        local['Thigh'+side]=rotation(
            .74*stride-.07 if run else -.025+.012*sign*swing,
            .034*sign if run else 0,.023*sign*cycle if run else 0)
        local['Shin'+side]=rotation(.10+.90*flight if run else .065+.019*sign*swing)
        local['Foot'+side]=rotation(
            -.43*stride-.46*flight if run else -.018+.015*cycle)
        local['Arm'+side]=rotation(
            -.14-(.49 if side=='R' else .44)*sign*math.sin(phase+.18)
            if run else -.10+.065*sign*swing,
            .085*sign,.045*sign*cycle if run else .012*sign)
        local['Forearm'+side]=rotation(
            -.24-.15*sign*math.sin(phase-.30) if run
            else -.26+.032*math.sin(phase+.35*sign))
        local['Hand'+side]=rotation(
            .10*math.sin(phase-.6*sign) if run else .022*swing)
    if clip=='strike':
        # Readable anticipation + static hold through attack windup;
        # ballistic cut, extended follow-through and visible recovery.
        wind=ease((t-.025)/.38);cut=ease((t-.48)/.17)
        recover=ease((t-.76)/.24)
        recoil=max(0,math.sin(pi*ease((t-.46)/.33)))
        local['Pelvis']=Matrix.Translation((
            -.071*wind+.114*cut-.043*recover,
            .065*wind-.185*recoil,
            -.102*wind+.164*recoil-.065*recover))@rotation(
            -.11*wind+.29*cut-.18*recover,0,
            -.20*wind+.38*cut-.18*recover)
        local['Chest']=rotation(-.23*wind+.76*cut-.53*recover,
            -.14*wind+.18*cut,-.74*wind+1.72*cut-.98*recover)
        local['Neck']=rotation(.17*wind-.31*cut+.14*recover,
            -.08*wind,.18*wind-.29*cut+.11*recover)
        local['Skull']=rotation(.18*wind-.39*cut+.21*recover,
            0,-.21*wind+.27*cut-.06*recover)
        local['ArmR']=rotation(-.42-2.68*wind+2.96*cut-.28*recover,
            -.83*wind+1.15*cut-.32*recover,
            -.28*wind+.55*cut-.27*recover)
        local['ForearmR']=rotation(-.39-.84*wind+1.55*cut-.71*recover)
        local['HandR']=rotation(-.30*wind+.53*cut-.23*recover)
        local['ArmL']=rotation(-.18+.50*wind-.93*cut+.34*recover,
            .31*wind-.23*cut,.22*wind-.38*cut+.16*recover)
        local['ForearmL']=rotation(-.20-.45*wind+.64*cut-.19*recover)
        local['ThighL']=rotation(-.37*wind+.64*cut-.27*recover)
        local['ThighR']=rotation(.26*wind-.48*cut+.22*recover)
        local['ShinL']=rotation(.32*wind-.38*cut)
        local['ShinR']=rotation(.24*wind+.19*cut-.28*recover)
    # Lower bow hand in locomotion, shoulder-high at full draw. Solve both
    # two-link arms to keep the drawing fingers on the nock.
    desired={}
    for n,(p,parent) in joints.items():
        desired[n]=(desired[parent]@orig[parent].inverted() if parent else Matrix.Identity(4))@orig[n]@local[n]
    if shoot:
        # Bow is an articulated held object: left arm stabilizes its rise,
        # right fingers draw, breath holds, then a fast release and follow-through.
        draw=ease((t-.035)/.43);release=ease((t-.64)/.07)
        lower=ease((t-.83)/.17)
        local['Pelvis']=Matrix.Translation((-.028*draw,.046*draw,-.025*draw))
        local['Chest']=rotation(-.18*draw+.34*release,0,-.30*draw+.25*release)
        local['Neck']=rotation(-.08*draw+.15*release,0,.07*draw)
        local['Skull']=rotation(-.16*draw+.21*release,0,-.12*draw+.10*release)
        # Recompute FK after bow torso pose: original IK was anchored to
        # the idle chest, making arms float apart during the bow draw.
        desired={}
        for n,(p,parent) in joints.items():
            desired[n]=(desired[parent]@orig[parent].inverted()
                        if parent else Matrix.Identity(4))@orig[n]@local[n]
        level=draw*(1-lower)
        left=V((.21,-.17-.36*level,1.17+.37*level))
        nock=left+V((0,.080+.47*draw*(1-release),0))
        right=nock+V((-.105-.13*release,.19*release,.035*release))
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
        desired['Arrow']=Matrix.Translation(nock)@Matrix.Scale(.0001 if t>=.68 else 1,4)
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
