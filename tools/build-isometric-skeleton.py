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
teal = material('Faded oxblood cloth', (.37,.105,.15))
bronze = material('Hammered bronze', (.69,.52,.29), .29, .53)
steel = material('Forged charcoal steel', (.47,.56,.64), .33, .51)
leather = material('Oxblood leather', (.19,.069,.034))
wood = material('Yew', (.34,.155,.052))
aged = material('Bone shadows and age lines', (.23,.18,.15))
weathered = material('Oxidized armor plate', (.467,.537,.592), .33, .53)
trim = material('Polished battered brass', (.78,.65,.44), .26, .49)
cloth_light = material('Worn crimson cloth highlights', (.60,.255,.29))
cloth_shadow = material('Tattered crimson underskirt', (.13,.038,.073))
# Explicit same sRGB swatches as Guardian build-player-sprite-study.py:
# Gunmetal insets #343f54; padded graphite #232534. The previous values
# were nearly black (P10≈6), unlike the Guardian's readable P10≈38.
iron_dark = material('Dark recesses between armor plates', (.204,.247,.329), .15, .61)
graphite = material('Graphite ribcage negative space', (.137,.145,.204), roughness=.67)
steel_edge = material('Guardian silver plate facets', (.79,.83,.84), .25, .49)
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
# Unlike the old UV-sphere skull, this has deliberately cut planar
# forehead, temples, cheek and crown facets at the Guardian's screen size.
cranium = style.profile_mesh('Cranium', [
    (1.550,0,.004,.070,.060),
    (1.610,0,.004,.137,.106),
    (1.728,0,.013,.159,.140),
    (1.810,0,.014,.142,.124),
    (1.875,0,.016,.085,.070),
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
oval('Belt','Pelvis',(0,-.004,.965),(.177,.104,.043),leather)
beltPlate=style.front_plate('Belt frontal clasp',
    [(-.064,.926),(.064,.926),(.073,.987),(-.073,.987)],
    -.126,.026,steel,steel_edge)
part(beltPlate,'Belt frontal clasp','Pelvis',steel)
oval('Buckle','Pelvis',(0,-.151,.966),(.037,.014,.026),bronze)
strip('Split tabard','Pelvis',[(-.12,-.08,.95),(.10,-.09,.95),(-.1,-.116,.73),(.065,-.13,.69),(-.07,-.11,.64),(.04,-.13,.66)],teal,'both')
# The former golden orb on the shoulder contradicted the Guardian's
# silver/graphite plate hierarchy, and read like a soft padded blob.
oval('Pauldron shadow liner','ArmL',(.245,.002,1.48),(.112,.101,.081),iron_dark)
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
# Production art pass: silhouettes, layered materials and real equipment.
# The hero is a finished plated knight; this enemy should have a comparably
# finished readable silhouette, but retain visible *anatomical* bones.
# All accessories bind to existing rig bones and are baked into all 32 views.
# ---------------------------------------------------------------------------
def shape(name,bone,vertices,faces,mat,kit='both'):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    part(obj,name,bone,mat,kit)
    return obj

def badge(name,bone,at_point,r,material,kit='both'):
    oval(name,bone,at_point,(r,r*.43,r),material,kit)

def cuff(bone,at_point,rad,length,material):
    # Polished cap over bare forearm/shin: plates have dark gaps underneath.
    p=V(at_point)
    oval('Ancient cuff',bone,p,(rad,rad*.72,length),weathered)
    oval('Cuff rim',bone,p+V((0,0,length*.72)),(rad*1.09,rad*.80,.018),trim)
    oval('Cuff lower rim',bone,p-V((0,0,length*.72)),(rad*1.09,rad*.80,.018),aged)

# Scalp fracture grooves and drilled dark shadow recesses make the head
# genuinely read as a skull, not as a white sphere with two black dots.
for side,sign in [('L',1),('R',-1)]:
    rod('Cranial crack','Skull',(sign*.041,-.116,1.832),
        (sign*.094,-.096,1.782),.005,.003,scar)
    rod('Cranial crack branch','Skull',(sign*.081,-.108,1.79),
        (sign*.115,-.075,1.76),.003,.002,scar)
    oval('Deep temple hollow','Skull',(sign*.134,-.082,1.68),
         (.020,.014,.061),aged)
    oval('Heavy cheek arch','Skull',(sign*.109,-.116,1.67),
         (.045,.020,.027),edge)
    # Individual rows of molars stay visible in the mouth opening.
    for tooth in range(3):
        oval('Molar','Skull',(sign*(.070+tooth*.016),-.143,1.592),
             (.010,.013,.016),edge)
    # Iron greaves and fastened leather shin guards: separate, readable plates.
    cuff('Shin'+side,(sign*.14,-.014,.35),.052,.095,weathered)
    shin_plate=style.front_plate('Forged greave frontal facet',[
        (sign*.089,.278),(sign*.196,.278),(sign*.190,.480),
        (sign*.142,.505),(sign*.103,.471)],-.093,.023,
        weathered,steel_edge)
    part(shin_plate,'Forged greave frontal facet','Shin'+side,weathered)
    rod('Leg guard fastener','Shin'+side,(sign*.098,-.083,.40),
        (sign*.183,-.074,.40),.014,mat=leather)
    oval('Worn boot cap','Foot'+side,(sign*.14,-.07,.094),
         (.089,.129,.043),weathered)
    oval('Gold boot rivet','Foot'+side,(sign*.14,-.16,.106),
         (.016,.011,.017),trim)
    cuff('Forearm'+side,(sign*.32,-.001,1.099),.061,.096,weathered)
    oval('Forearm brass pin','Forearm'+side,(sign*.32,-.080,1.112),
         (.020,.010,.021),trim)
    # Layered asymmetric shoulder guards contrast against the exposed ribs.
    oval('Leather shoulder underpad','Arm'+side,(sign*.245,.0,1.475),
         (.130,.125,.082),leather)
    shoulder = style.profile_mesh('Broken plate shoulder guard', [
        (1.447,sign*.266,-.008,.110,.092),
        (1.496,sign*.266,-.012,.150,.117),
        (1.541,sign*.270,-.014,.137,.101),
        (1.571,sign*.275,-.013,.080,.060),
    ], [weathered, steel_edge], axis='z', sides=8,
        face_material=lambda band,facet: 1 if band==2 and facet in (5,6,7) else 0)
    part(shoulder,'Broken plate shoulder guard','Arm'+side,weathered)
    oval('Forged shoulder rim','Arm'+side,(sign*.335,-.028,1.505),
         (.024,.098,.053),trim)
    for rivet in (-1,0,1):
        oval('Pauldron rivet','Arm'+side,
             (sign*(.265+rivet*.037),-.113,1.52),
             (.011,.009,.012),trim)

# The hero is readable through *large* plated surfaces. Add two dimensional
# half-cuirasses, exposing the bone and graphite sternum between them.
for side in (-1,1):
    chest_fragment=style.front_plate('Broken cuirass main plate',[
        (side*.125,1.122),(side*.247,1.112),
        (side*.256,1.351),(side*.196,1.435),
        (side*.117,1.386)], -.157,.040,steel,steel_edge)
    part(chest_fragment,'Broken cuirass main plate','Chest',steel)
    inner=style.front_plate('Cuirass dark inset',[
        (side*.146,1.191),(side*.213,1.194),
        (side*.210,1.324),(side*.160,1.352)],
        -.204,.008,iron_dark,aged)
    part(inner,'Cuirass dark inset','Chest',iron_dark)

# The remaining shoulder-to-hip harness and buckles leave the sternum readable.
rod('Diagonal leather band','Chest',(-.18,-.110,1.43),
    (.16,-.114,1.04),.034,mat=leather)
rod('Band bright seam','Chest',(-.18,-.143,1.42),
    (.15,-.144,1.05),.010,mat=trim)
oval('Sunken breast plate','Chest',(-.02,-.126,1.34),
     (.080,.033,.125),weathered)
oval('Tarnished chest crest','Chest',(-.018,-.162,1.34),
     (.040,.012,.058),bronze)
for x,z in ((-.127,1.13),(.11,1.23),(.057,1.09)):
    oval('Harness rivet','Chest',(x,-.144,z),(.019,.014,.019),trim)
for x in (-.15,-.06,.03,.12):
    oval('Belt bronze stud','Pelvis',(x,-.108,.975),(.016,.012,.014),trim)

# A high-density, ragged cloth skirt in two asymmetrical strips; no smooth
# single triangle 'cape'. The hem is broken and soiled; its colors echo
# the hero's red tabard in a colder, undead palette.
shape('Tattered tabard front','Pelvis',[
    (-.155,-.114,.95),(.14,-.114,.95),
    (-.19,-.13,.67),(.12,-.14,.69),
    (-.13,-.16,.55),(.070,-.16,.58),
    (-.20,-.18,.47),(.040,-.18,.54),
],[(0,1,3,2),(2,3,5,4),(4,5,7,6)],teal)
shape('Torn tabard inner seam','Pelvis',[
    (-.02,-.162,.94),(.015,-.165,.94),
    (-.025,-.169,.53),(.01,-.18,.56),
],[(0,1,3,2)],cloth_light)
shape('Hanging sidecloth left','Pelvis',[
    (.13,.02,.955),(.17,.11,.95),
    (.15,.085,.63),(.19,.055,.57),
    (.12,.08,.45),(.15,.14,.49),
],[(0,1,3,2),(2,3,5,4)],cloth_shadow)
shape('Hanging sidecloth right','Pelvis',[
    (-.15,.045,.96),(-.185,.12,.95),
    (-.20,.11,.68),(-.19,.16,.64),
    (-.235,.11,.51),(-.185,.16,.55),
],[(0,1,3,2),(2,3,5,4)],teal)

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

# A proper round steel-and-leather buckler, fixed to the LEFT forearm.
# It is a weapon prop in the same loadout collection (not ghostly/transparent).
shield=(.34,-.15,1.16)
oval('Buckler timber core','ForearmL',shield,(.218,.052,.251),wood,'sabre')
buckler_face = style.profile_mesh('Buckler iron face', [
    (-.252,.34,1.16,.129,.168),
    (-.233,.34,1.16,.198,.228),
    (-.198,.34,1.16,.205,.238),
    (-.184,.34,1.16,.155,.184),
], [weathered,trim],axis='y',sides=12,
    face_material=lambda band,facet: 1 if band==0 and facet in (1,2,3,4,5) else 0)
part(buckler_face,'Buckler iron face','ForearmL',weathered,'sabre')
oval('Buckler central boss','ForearmL',(.34,-.248,1.16),
     (.073,.047,.069),trim,'sabre')
for side in (-1,1):
    rod('Buckler vertical rim','ForearmL',
        (.34+side*.202,-.215,.99),(.34+side*.202,-.215,1.31),
        .014,.012,trim,'sabre')
    rod('Buckler radial pattern','ForearmL',
        (.34,-.237,1.16),(.34+side*.148,-.230,1.04),
        .012,.010,bronze,'sabre')
    rod('Buckler upper ray','ForearmL',
        (.34,-.236,1.16),(.34+side*.11,-.230,1.27),
        .012,.009,bronze,'sabre')
for z in (1.02,1.30):
    rod('Buckler horizontal rim','ForearmL',
        (.19,-.213,z),(.49,-.213,z),.013,.011,trim,'sabre')
for x,z in ((.19,1.14),(.49,1.14),(.34,1.01),(.34,1.31)):
    oval('Buckler brass rivet','ForearmL',(x,-.235,z),
         (.017,.012,.017),trim,'sabre')

# Archer identity: quiver silhouette, bound arrowheads and fletching.
oval('Quiver leather tube','Chest',(.17,.115,1.21),
     (.084,.075,.235),leather,'bow')
oval('Quiver bronze rim','Chest',(.17,.117,1.425),
     (.09,.079,.026),trim,'bow')
for i in range(4):
    x=.12+i*.035
    rod('Quivered arrow','Chest',(x,.119,1.34),
        (x,.119,1.59+i*.027),.007,.006,wood,'bow')
    shape('Arrow fletching','Chest',[
        (x-.025,.119,1.51+i*.027),(x+.025,.119,1.51+i*.027),
        (x,.119,1.60+i*.027)
    ],[(0,1,2)],teal,'bow')
rod('Bow decorative grip','HandL',at(bow,(0,-.05,-.115)),
    at(bow,(0,-.05,.115)),.025,.021,leather,'bow')
for z in (-.31,.31):
    oval('Bow metal tip wrap','HandL',at(bow,(0,.00,z)),
         (.035,.037,.045),trim,'bow')


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
    swing=math.sin(t*2*pi); cycle=math.cos(t*2*pi)
    local={n:Matrix.Identity(4) for n in joints}
    run=clip=='run'; shoot=clip=='shoot'
    # A guarded humanoid gait: unequal counter-swing of shield and saber,
    # weight shifts through pelvis and an offset head scanning the chamber.
    breath=.5+.5*math.sin(2*pi*t)
    local['Pelvis']=Matrix.Translation((.043*swing if run else .011*swing,
        -.026*cycle if run else 0,
        .065*abs(cycle) if run else .008*math.sin(2*pi*t)))
    local['Chest']=rotation(.22 if run else .025*swing,0,
        .115*swing if run else .031*swing)
    local['Skull']=rotation(-.11 if run else -.023*swing,0,
        -.065*swing if run else .028*math.sin(2*pi*t*.62))
    for side,sign in [('R',1),('L',-1)]:
        stride=sign*swing
        local['Thigh'+side]=rotation(.72*stride if run else .018*sign)
        local['Shin'+side]=rotation(.78*max(0,-stride) if run else .055)
        local['Foot'+side]=rotation(-.41*stride if run else -.012*swing)
        guard=side=='L'
        local['Arm'+side]=rotation(
            (-.29*stride-.36 if guard else -.60*stride-.20) if run else
            (-.34+.028*swing if guard else -.24+.05*sign*swing),
            (.14 if guard else -.08)*sign)
        local['Forearm'+side]=rotation(-.71 if guard else -.43,
            .12 if guard else -.08)
    if clip=='strike':
        # Three unmistakable phases: crouched anticipation, a real crossed
        # shoulder/hip slash with a forward weight transfer, then recovery.
        wind=ease(t/.46);cut=ease((t-.46)/.19);back=ease((t-.69)/.31)
        lunge=math.sin(pi*ease((t-.41)/.38))
        local['Pelvis']=Matrix.Translation((-.034*wind+.058*cut,
            -.12*max(0,lunge),-.083*wind+.13*max(0,lunge)))
        local['Chest']=rotation(.08+.34*cut*(1-back),.085*wind,
            -.56*wind+1.36*cut-.77*back)
        local['Skull']=rotation(-.04-.17*cut+.15*back,0,-.09*wind+.08*cut)
        local['ArmR']=rotation(-.45-2.09*wind+1.88*cut+.20*back,
            -.71*wind+.89*cut-.15*back)
        local['ForearmR']=rotation(-.61-.62*wind+1.16*cut-.58*back)
        local['ArmL']=rotation(-.55-.22*wind+.15*cut,0,.13*wind-.13*cut)
        local['ForearmL']=rotation(-.87-.12*wind+.16*cut)
        local['ThighL']=rotation(-.22*wind+.27*cut)
        local['ThighR']=rotation(.19*wind-.25*cut)
        local['ShinL']=rotation(.23*wind-.17*cut)
        local['ShinR']=rotation(.17*wind+.12*cut)
    # Lower bow hand in locomotion, shoulder-high at full draw. Solve both
    # two-link arms to keep the drawing fingers on the nock.
    desired={}
    for n,(p,parent) in joints.items():
        desired[n]=(desired[parent]@orig[parent].inverted() if parent else Matrix.Identity(4))@orig[n]@local[n]
    if shoot:
        # Bow is an articulated held object: left arm stabilizes its rise,
        # right fingers draw, breath holds, then a fast release and follow-through.
        draw=ease(t/.54); release=ease((t-.62)/.07);lower=ease((t-.78)/.22)
        local['Chest']=rotation(.04-.08*draw+.13*release,0,-.16*draw+.12*release)
        local['Skull']=rotation(-.08*draw,0,-.09*draw+.06*release)
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
