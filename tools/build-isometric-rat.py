"""Build the editable small-rat armature and 32-view animation atlases.
Run in the repository root:
    blender -b --factory-startup -t 4 --python-exit-code 1 -P tools/build-isometric-rat.py

32 camera-relative directions (11.25° steps), no 2D sprite rotation.
Each WebP sheet has animation frames on X and 32 directions on Y.
"""
from pathlib import Path
import importlib.util
import math
import os
import bpy
from mathutils import Vector, Euler, Matrix

ROOT = Path.cwd() / "beta/art/rat"
ROOT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
# Keep the high-contrast atlas preset for WebP fallback frames.
# Live rigs inherit the Guardian's ACES/lighting in Three.js.
scene.view_settings.view_transform = 'Standard'
try:
    scene.view_settings.look = 'Medium High Contrast'
except TypeError:
    pass  # Some Blender versions omit this color-management preset.
style_spec = importlib.util.spec_from_file_location("guardian_style", Path.cwd() / "tools" / "guardian-style.py")
style = importlib.util.module_from_spec(style_spec)
style_spec.loader.exec_module(style)
V = Vector
PI = math.pi
VIEWS = 32
CELL = 128
SHEETS = {
    "idle": 8, "run": 10, "stalk": 10, "jump": 12,
    "bite": 9, "combo": 14, "dodge": 10, "dodge-left": 10, "death": 14
}

def srgb_to_linear(value):
    # Palette values are sRGB, exactly as in build-player-sprite-study.py.
    # Blender shader sockets need scene-linear RGB for faithful GLB colors.
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def mat(name, color, roughness=.83, metal=0):
    m = bpy.data.materials.new(name)
    linear = tuple(srgb_to_linear(v) for v in color)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    return m

# Same dark/base/highlight/edge material hierarchy as the Guardian armor.
fur = mat("Warm dark umber fur", (.34, .235, .22), .67)
fur_light = mat("Copper brown fur highlights", (.64, .47, .37), .61)
belly = mat("Warm grey belly", (.72, .62, .53), .68)
skin = mat("Russet pink paws and tail", (.47, .27, .30))
ear = mat("Rose inner ears", (.65, .42, .41))
eye = mat("Black glass eyes", (.012, .008, .014), .22)
nose = mat("Dark wet nose", (.225, .065, .084), .27)
teeth = mat("Small ivory incisors", (.77, .69, .50))
whisker = mat("Pale whiskers", (.67, .58, .48))
fur_shadow = mat("Dense charcoal underfur", (.105, .085, .112), .78)
fur_coat = mat("Dark matted dorsal coat", (.17, .135, .17), .74)
fur_gold = mat("Sparse warm guard hairs", (.58, .365, .24), .68)
ear_shadow = mat("Inner ear folds", (.39, .19, .20))
claw = mat("Hard ivory claws", (.69, .61, .47))
hide = mat("Weathered saddle-brown leather", (.18, .105, .095), .7)
iron = mat("Guardian gunmetal scavenger armor", (.34, .44, .53), .53, .25)
silver = mat("Guardian silver scavenger facets", (.76, .81, .82), .50, .22)
seams = mat("Graphite harness recesses", (.043, .054, .072), .70)
brass = mat("Found dungeon brass", (.53, .33, .12), .52, .38)
patch = mat("Ragged muted red cloth", (.48, .145, .19), .70)
tail_ring = mat("Tail joint dark folds", (.35, .16, .17))

joints = {}
parts = []

def joint(name, xyz, parent=None):
    joints[name] = (V(xyz), parent)

def add_part(obj, name, bone, material):
    obj.name = name
    if not obj.data.materials:
        obj.data.materials.append(material)
    parts.append((obj, bone))
    return obj

def oval(name, bone, pos, scale, material, segments=12):
    o=style.faceted_oval(name,pos,scale,material,sides=10)
    return add_part(o, name, bone, material)

def rod(name, bone, start, end, radius, material, tip=None):
    a, b = V(start), V(end)
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=radius, radius2=radius if tip is None else tip,
        depth=(b-a).length, location=(a+b)*.5)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    return add_part(o, name, bone, material)

# The rat faces -Y, matching the skeleton and player baked camera convention.
joint("Root", (0, 0, .28))
joint("Chest", (0, -.29, .35), "Root")
joint("Head", (0, -.59, .39), "Chest")
joint("Jaw", (0, -.70, .28), "Head")
joint("Nose", (0, -.82, .34), "Head")
for n, s in (("L", 1), ("R", -1)):
    joint("Ear"+n, (s*.19, -.53, .57), "Head")
    joint("Shoulder"+n, (s*.245, -.39, .31), "Chest")
    joint("Foreleg"+n, (s*.29, -.41, .15), "Shoulder"+n)
    joint("FrontPaw"+n, (s*.28, -.49, .055), "Foreleg"+n)
    joint("Hip"+n, (s*.27, .32, .29), "Root")
    joint("Hindleg"+n, (s*.32, .41, .13), "Hip"+n)
    joint("HindPaw"+n, (s*.32, .45, .055), "Hindleg"+n)
for i in range(6):
    joint("Tail"+str(i), (0, .41+i*.18, .29-max(0, i-1)*.032),
          "Root" if i == 0 else "Tail"+str(i-1))

# A continuous faceted pear-shaped body replaces the old stack of smooth
# overlapping spheres. Planar sections, value bands and a ridged back are
# deliberately visible at the Guardian's actual isometric game zoom.
body_shell = style.profile_mesh("Broad pear-shaped body", [
    # Natural rodent body mass: narrow neck, broad hindquarters and a
    # rising rump. Former radius peaks were at the shoulders, causing an
    # almost rectangular torso in the actual side-on game camera.
    (-.60,0,.332,.067,.063),
    (-.48,0,.345,.156,.143),
    (-.28,0,.355,.228,.198),
    (-.04,0,.362,.289,.243),
    (.22,0,.371,.340,.283),
    (.40,0,.352,.310,.255),
    (.54,0,.320,.204,.162),
    (.64,0,.283,.067,.053),
], [fur,fur_light,fur_shadow,fur_coat], axis="y", sides=10,
    face_material=lambda band,facet:
        3 if facet in (1,2,3,4) and band>=2 else
        2 if facet in (6,7) else
        1 if facet in (0,5,9) and band in (1,2) else 0)
add_part(body_shell,"Broad pear-shaped body","Root",fur)
# Large, clean steel-on-graphite back shape uses the same visual language as
# the Guardian's cuirass. It is a light-catching silhouette plane, not a
# texture overlay or bright post-processing effect.
saddle=style.profile_mesh("Scavenger forged dorsal saddle",[
    # Plate now follows the actual back curve instead of floating as a
    # horizontal metal brick above the animal.
    (-.20,0,.553,.126,.030),
    (-.05,0,.603,.208,.035),
    (.16,0,.643,.211,.040),
    (.35,0,.626,.137,.030),
], [iron,silver,seams], axis="y", sides=10,
    face_material=lambda band,facet:
        1 if facet in (1,2,3) and band in (0,1) else
        2 if facet in (6,7) else 0)
add_part(saddle,"Scavenger forged dorsal saddle","Root",iron)
oval("Underbelly", "Root", (0, -.08, .185), (.255, .42, .125), belly)
ruff = style.profile_mesh("Shoulder ruff", [
    (-.59,0,.365,.085,.073),
    (-.47,0,.383,.177,.152),
    (-.29,0,.391,.242,.205),
    (-.13,0,.390,.216,.166),
    (-.07,0,.376,.073,.057),
], [fur,fur_light,fur_shadow], axis="y", sides=10,
    face_material=lambda band,facet: 1 if facet in (0,1,2,3,4) else 2 if facet in (6,7) else 0)
add_part(ruff,"Shoulder ruff","Chest",fur)
face_shell = style.profile_mesh("Sculpted planar head", [
    (-.834,0,.375,.086,.078),
    (-.745,0,.415,.182,.137),
    (-.630,0,.425,.248,.205),
    (-.485,0,.43,.238,.194),
    (-.375,0,.415,.102,.095),
], [fur,fur_light,fur_shadow], axis="y", sides=10,
    face_material=lambda band,facet: 1 if facet in (0,1,2,3,4) and band<3 else
                              2 if facet in (6,7) else 0)
add_part(face_shell,"Sculpted planar head","Head",fur)
snout=style.profile_mesh("Tapered faceted muzzle",[
    (-.954,0,.345,.035,.035),
    (-.860,0,.351,.081,.061),
    (-.755,0,.355,.137,.088),
    (-.660,0,.370,.139,.095),
], [fur_light,belly,fur_shadow], axis="y", sides=8,
    face_material=lambda band,facet:
        1 if facet in (4,5,6) else 2 if facet in (1,2) else 0)
add_part(snout,"Tapered faceted muzzle","Head",fur_light)
oval("Nose", "Nose", (0, -.915, .344), (.047, .038, .04), nose)
oval("Jaw", "Jaw", (0, -.725, .295), (.102, .12, .035), belly)
for s in (-1, 1):
    oval("Glossy eye", "Head", (s*.177, -.722, .484), (.036, .041, .041), eye)
    oval("Brow", "Head", (s*.157, -.686, .533), (.068, .046, .026), fur_light)
    side = "L" if s > 0 else "R"
    # Full 3D pointed auricle with an actual inset; no overlapping circles.
    ear_outer=style.front_plate("Angular auricle",[
        (s*.110,.535),(s*.275,.540),(s*.332,.685),
        (s*.249,.799),(s*.144,.716)], -.565,.041,fur,fur_shadow)
    add_part(ear_outer,"Angular auricle","Ear"+side,fur)
    ear_inner=style.front_plate("Inset ear leather",[
        (s*.151,.573),(s*.253,.574),(s*.296,.683),
        (s*.241,.746),(s*.177,.684)], -.579,.012,ear,ear_shadow)
    add_part(ear_inner,"Inset ear leather","Ear"+side,ear)
    for k in range(2):
        rod("Whisker", "Nose", (s*.045, -.866, .338+(k-.5)*.038),
            (s*(.33+k*.034), -.81+k*.042, .31+(k-.5)*.088),
            .004, whisker, .001)
    for limb, lower, paw, front in [
        ("Shoulder"+side, "Foreleg"+side, "FrontPaw"+side, True),
        ("Hip"+side, "Hindleg"+side, "HindPaw"+side, False)
    ]:
        a, b, c = joints[limb][0], joints[lower][0], joints[paw][0]
        oval("Thigh" if not front else "Upper arm", limb, a,
             (.104, .132, .144) if not front else (.088, .105, .115), fur)
        rod("Shin", lower, a, b, .065, fur_light, .044)
        rod("Ankle", paw, b, c, .040, skin, .027)
        oval("Paw", paw, c+(V((0, -.028 if front else .026, -.012))),
             (.076, .098, .031), skin)
        for toe in range(3):
            x=c.x+(toe-1)*.039
            y=c.y+(-.065 if front else .070)
            rod("Toe", paw, (x,c.y,.037), (x,y,.027), .014, skin, .008)

for k in range(2):
    rod("Incisor", "Jaw", ((k-.5)*.043, -.820, .289),
        ((k-.5)*.043, -.852, .248), .016, teeth, .008)

# A five-joint tail flexes naturally rather than behaving like a single rigid line.
for i in range(6):
    a = joints["Tail"+str(i)][0]
    b = a+V((0, .19, -.026 if i>0 else .004))
    rod("Tapered tail", "Tail"+str(i), a, b, .062-i*.008, skin,
        max(.012, .053-i*.008))


# Production-model detailing pass: rat anatomy, fur silhouette, expression.
# Each strand/tuft is a real weighted Blender mesh, not a painted 2D overlay.
def triangle(name,bone,points,material):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], [(0,1,2)])
    mesh.update()
    o=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(o)
    add_part(o,name,bone,material)

# Broad dark dorsal stripe, fur layering and natural shoulders/haunches.
# The faceted back above already carries dark-top coat material. A second
# intersecting ellipsoid used to turn the silhouette into a muddy hump.
# Removed: the overlapping rump sphere obscured the main shell's readable
# planar transitions and made the silhouette look soft and unstructured.
oval("Cream chin and muzzle patch", "Head",(0,-.755,.315),
     (.137,.135,.077),belly,20)
for sign in (-1,1):
    side="L" if sign>0 else "R"
    oval("Sculpted cheek pad", "Head",(sign*.174,-.657,.365),
         (.112,.149,.120),fur_light,18)
    oval("Sculpted eye socket", "Head",(sign*.177,-.717,.478),
         (.051,.047,.050),fur_shadow,16)
    oval("Glass eye iris", "Head",(sign*.181,-.754,.488),
         (.032,.026,.032),eye,20)
    oval("Eye catchlight", "Head",(sign*.17,-.778,.507),
         (.009,.009,.012),teeth,12)
    # Ear depth and rim are already actual geometry in the angular auricle.
    oval("Raised nasal whisker root", "Nose",
         (sign*.065,-.853,.329),(.036,.040,.030),fur_light)
    # Broad readable whisker strokes, not tiny line noise at game scale.
    for k in range(2):
        level=k-.5
        rod("Fine curved whisker", "Nose",
            (sign*.054,-.875,.341+level*.023),
            (sign*.375,-.78,.333+level*.080),
            .004,whisker,.001)
    # Cheek ruff silhouette: directional triangular locks, not a smooth egg.
    for k in range(5):
        yy=-.73+k*.069
        zz=.385+.045*math.sin(k*1.6)
        x=sign*(.18+.012*math.cos(k*1.7))
        triangle("Swept cheek fur tuft", "Head",[
            (x,yy,zz+.032),(x,yy+.055,zz-.015),
            (sign*(.305+.035*(k%3)/3),yy+.075,zz-.027)
        ],fur_light if k%3 else fur_shadow)
    # Distinct black claws and webbing between paws.
    for front,paw in ((True,"FrontPaw"+side),(False,"HindPaw"+side)):
        pos=joints[paw][0]
        for i in range(3):
            x=pos.x+(i-1)*.039
            y=pos.y+(-.125 if front else .127)
            rod("Sharp ivory paw claw",paw,(x,y,.032),
                (x+sign*.007,y+(-.038 if front else .038),.012),
                .010,claw,.0005)

# Layered guard hairs across the rump with two warm and dark values.
# Tufts follow the body root; no random geometry flashing between frames.
for row in range(3):
    y=-.16+row*.255
    width=.15+.12*max(0,1-abs(y-.07)/.61)
    height=.714+.03*math.cos((y-.12)*2.5)
    for col in range(3):
        t=col-1
        x=t*width
        z=height-.025*t*t
        seed=(row*23+col*17)%7
        spike=.045+seed*.006
        triangle("Individual coarse guard fur","Root",[
            (x-.022,y,z-.022),(x+.027,y,z-.015),
            (x+.010,y+spike,z+.016)
        ],fur_gold if seed==0 else fur_shadow if seed==2 else fur_coat)

# The long tail has rings, creases and an organic silhouette.
for i in range(6):
    p=joints["Tail"+str(i)][0]
    rod("Tail annular skin fold","Tail"+str(i),
        p+V((0,.019,0)),p+V((0,.038,0)),
        .062-i*.008+.004,tail_ring,
        .060-i*.008+.003)
    for n in (-1,1):
        triangle("Tail scar","Tail"+str(i),[
            (n*(.049-i*.006),p.y+.055,p.z),
            (n*(.052-i*.006),p.y+.073,p.z+.012),
            (n*(.049-i*.006),p.y+.089,p.z-.008)
        ],skin)

# Readable armor-like plane transitions echo the Guardian's pauldrons.
# This does NOT turn the rat into a knight: it remains a compact rodent,
# but its scavenger harness is built with the same forged material vocabulary.
for side in (-1,1):
    flank=style.profile_mesh("Scavenger forged flank pauldron",[
        (-.10,side*.244,.57,.075,.038),
        (.01,side*.260,.610,.091,.066),
        (.18,side*.247,.590,.085,.055),
        (.25,side*.239,.56,.037,.025),
    ], [iron,silver,seams], axis="y", sides=8,
      face_material=lambda band,facet:
         1 if facet in (0,1,7) else 2 if facet in (4,5) else 0)
    add_part(flank,"Scavenger forged flank pauldron","Root",iron)
    oval("Pauldron silver stud","Root",
         (side*.255,.045,.666),(.019,.014,.022),silver)
belt=style.front_plate("Red knight-inspired harness clasp",[
    (-.107,.646),(.104,.646),(.082,.720),(-.097,.716)],
    -.212,.024,patch,brass)
add_part(belt,"Red knight-inspired harness clasp","Chest",patch)

# Worn scavenger harness: two straps, brass buckles and a tiny torn patch.
for side in (-1,1):
    rod("Back harness strap","Root",
        (side*.241,-.13,.58),(side*.232,.17,.585),.027,hide,.023)
    oval("Harness brass eyelet","Root",
         (side*.230,-.105,.614),(.024,.019,.018),brass)
rod("Harness dorsal cross strap","Root",
    (-.243,-.035,.712),(.243,-.035,.712),.025,hide,.025)
oval("Harness centre buckle","Root",(0,-.055,.745),
     (.054,.028,.020),brass,16)
# Small torn cloth panel that makes the silhouette identifiable in combat.
triangle("Red scrap shoulder fabric","Root",[
    (-.105,-.14,.725),(.115,-.16,.725),
    (.030,.17,.755)
],patch)
triangle("Scrap torn trailing hem","Root",[
    (-.07,.19,.73),(.086,.18,.735),
    (-.057,.38,.685)
],patch)

# More expressive animation curves: independent ear flicks, snout twitching
# and raised hackles. These details read during both idle and locomotion.

arm = bpy.data.armatures.new("Small rat armature")
rig = bpy.data.objects.new("Rat rig • editable", arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, (p, parent) in joints.items():
    b = arm.edit_bones.new(name)
    b.head = p
    b.tail = p+V((0, .12, 0))
    if parent:
        b.parent = arm.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

# Apply mesh world transforms and rigidly skin each low-poly part to its bone.
for obj, bone in parts:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    # The Guardian's armor has intentional edge glints, not rounded blobs.
    # The rat keeps faceted anatomy but gains forged highlights on its gear.
    if any(token in obj.name.lower() for token in (
        "harness","buckle","saddle","leather","eyelet","claw",
        "forged","pauldron","auricle","clasp")):
        style.forged_hard_edges(obj, width=.003)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    obj.select_set(False)
bpy.ops.object.select_all(action="DESELECT")
for obj, bone in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
body = parts[0][0]
body.name = "Small rat • fully weighted skin"
body.parent = rig
mod = body.modifiers.new("Bone skin", "ARMATURE")
mod.object = rig

def clamp(v):
    return max(0.0, min(1.0, v))
def smooth(v):
    x=clamp(v)
    return x*x*(3-2*x)
def bell(t, at, width):
    return max(0, 1-abs(t-at)/width)**2

def pose(clip, t):
    # Every pose is rebuilt from rest so actions can be edited in Blender.
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    root=rig.pose.bones["Root"]
    chest=rig.pose.bones["Chest"]
    head=rig.pose.bones["Head"]
    jaw=rig.pose.bones["Jaw"]
    phase=2*PI*t
    # A living animal even while idle: respiration, asymmetric sniffs,
    # tiny whisker twitches and independent tail vertebrae.
    sniff=math.sin(phase*2.3)
    root.location.z=.008*math.sin(phase)
    root.rotation_euler.y=.025*math.sin(phase*.67)
    chest.rotation_euler.x=.042*math.sin(phase)
    head.rotation_euler.x=.055*math.sin(phase+.8)
    head.rotation_euler.z=.045*math.sin(phase*.42)
    rig.pose.bones["Nose"].rotation_euler.x=.035*sniff
    jaw.rotation_euler.x=.045+max(0,math.sin(phase*.5))*.09
    for i in range(6):
        tail=rig.pose.bones["Tail"+str(i)]
        tail.rotation_euler.z=.10*math.sin(phase-i*.55)
        tail.rotation_euler.x=.042*math.sin(phase*.82-i*.8)
    for n, sign in (("L",1),("R",-1)):
        rig.pose.bones["Ear"+n].rotation_euler.y=.08*math.sin(phase+sign)
        rig.pose.bones["Shoulder"+n].rotation_euler.x=.025*sign
        rig.pose.bones["Hip"+n].rotation_euler.x=.025*sign
        rig.pose.bones["Foreleg"+n].rotation_euler.x=-.055
        rig.pose.bones["Hindleg"+n].rotation_euler.x=.06
    if clip in ("run", "stalk"):
        stalk=clip=="stalk"
        stride=.19 if stalk else .49
        bob=.016 if stalk else .063
        root.location.z=bob*abs(math.sin(phase))
        chest.rotation_euler.x=.13 if stalk else .22
        head.rotation_euler.x=-.19 if stalk else -.12
        head.rotation_euler.z=.06*math.sin(phase+(0 if stalk else .4))
        root.rotation_euler.z=.018*math.sin(phase)
        for n, sign in (("L",1),("R",-1)):
            swing=math.sin(phase+sign*PI/2)
            rig.pose.bones["Shoulder"+n].rotation_euler.x=stride*swing
            rig.pose.bones["Hip"+n].rotation_euler.x=-stride*swing
            rig.pose.bones["Foreleg"+n].rotation_euler.x=-.2-.24*max(0,swing)
            rig.pose.bones["Hindleg"+n].rotation_euler.x=.22+.30*max(0,-swing)
            rig.pose.bones["FrontPaw"+n].rotation_euler.x=-.19*max(0,swing)
            rig.pose.bones["HindPaw"+n].rotation_euler.x=.14*max(0,-swing)
        for i in range(6):
            rig.pose.bones["Tail"+str(i)].rotation_euler.z=(.08 if stalk else .21)*math.sin(phase-i*.60)
        if stalk:
            root.location.z-=.075
            root.location.y=-.035
            head.rotation_euler.x=-.20
    elif clip=="jump":
        ready=1-smooth(t/.18) if t<.18 else 0
        lift=max(0,math.sin(PI*clamp((t-.16)/.72)))
        root.location.z=-.12*ready+.45*lift
        # Runtime physics already advances the world-space leap. Preserve
        # in-place animation (vertical take-off only), avoiding double travel.
        root.location.y=-.055*math.sin(PI*smooth((t-.20)/.65))
        chest.rotation_euler.x=-.2*ready+.28*lift
        head.rotation_euler.x=.26*ready-.26*lift
        for n in ("L","R"):
            rig.pose.bones["Shoulder"+n].rotation_euler.x=-.46*lift+.30*ready
            rig.pose.bones["Hip"+n].rotation_euler.x=.62*lift-.24*ready
            rig.pose.bones["Foreleg"+n].rotation_euler.x=-.42*lift
            rig.pose.bones["Hindleg"+n].rotation_euler.x=-.65*lift
        for i in range(6):
            rig.pose.bones["Tail"+str(i)].rotation_euler.x=-.26*lift
    elif clip in ("bite","combo"):
        # A clear anticipation, jaw snap and recovery; combo has TWO separate snaps.
        contacts=[.48] if clip=="bite" else [.30,.67]
        snap=sum(bell(t, contact, .095) for contact in contacts)
        anticipate=(smooth(t/.24)*(1-smooth((t-contacts[0])/.15)))
        chest.rotation_euler.x=-.31*anticipate+.64*snap
        head.rotation_euler.x=.38*anticipate-.58*snap
        jaw.rotation_euler.x=.67*anticipate-.29*snap
        for n in ("L","R"):
            rig.pose.bones["Ear"+n].rotation_euler.x=-.22*anticipate+.07*snap
        root.location.y=-.055*max(anticipate,snap)
        root.location.z=-.06*anticipate+.07*snap
        for n in ("L","R"):
            rig.pose.bones["Shoulder"+n].rotation_euler.x=.28*anticipate-.38*snap
            rig.pose.bones["Hip"+n].rotation_euler.x=-.24*anticipate
    elif clip in ("dodge", "dodge-left"):
        across=smooth(t/.56)
        # Side dodge advances through the collision system in gameplay.
        # Do not bake a second 0.5-metre root displacement into its atlas.
        root.location.x=(-.065 if clip=="dodge-left" else .065)*math.sin(PI*t)
        root.location.z=.12*math.sin(PI*t)
        root.rotation_euler.y=( -.19 if clip=="dodge-left" else .19)*math.sin(PI*t)
        chest.rotation_euler.z=(-.24 if clip=="dodge-left" else .24)*math.sin(PI*t)
        for n,sign in (("L",1),("R",-1)):
            rig.pose.bones["Shoulder"+n].rotation_euler.x=.30*sign*math.sin(PI*t)
            rig.pose.bones["Hip"+n].rotation_euler.x=-.35*sign*math.sin(PI*t)
        for i in range(6):
            rig.pose.bones["Tail"+str(i)].rotation_euler.z=-.30*math.sin(PI*t)
    elif clip=="death":
        fall=smooth(t/.76)
        bounce=.065*math.sin(PI*4*t)*max(0, 1-t) if t>.67 else 0
        root.location.z=-.19*fall+abs(bounce)
        root.rotation_euler.y=1.23*fall
        root.rotation_euler.x=.15*fall
        chest.rotation_euler.x=-.55*fall
        head.rotation_euler.x=.60*fall
        jaw.rotation_euler.x=.40*fall
        for n,sign in (("L",1),("R",-1)):
            rig.pose.bones["Shoulder"+n].rotation_euler.x=1.06*fall
            rig.pose.bones["Hip"+n].rotation_euler.x=-.86*fall
            rig.pose.bones["Foreleg"+n].rotation_euler.z=sign*.30*fall
            rig.pose.bones["Hindleg"+n].rotation_euler.x=.56*fall
        for i in range(6):
            tail=rig.pose.bones["Tail"+str(i)]
            tail.rotation_euler.z=.27*math.sin(i*1.7)*fall
            tail.rotation_euler.x=-.34*fall
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path="location", frame=1+round(t*48))
        pb.keyframe_insert(data_path="rotation_euler", frame=1+round(t*48))

for clip in SHEETS:
    action=bpy.data.actions.new("rat_"+clip)
    action.use_fake_user=True
    rig.animation_data_create().action=action
    for i in range(25):
        pose(clip, i/24)
rig.animation_data.action=bpy.data.actions["rat_idle"]
scene.frame_end=49
scene.render.fps=48
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"rat.blend"),compress=True)

# CI can publish new live GLBs without waiting for the expensive Cycles
# 32-facing fallback atlases. Default keeps full atlas generation unchanged.
if os.environ.get("MIND_DUNGEON_RIG_ONLY") != "1":
    # Pose batching: 1 render per animation, not 32 x frames individual renders.
    scene.render.engine="CYCLES"
    scene.cycles.samples=18
    scene.cycles.use_denoising=False  # GitHub Blender build lacks OpenImageDenoiser
    scene.render.film_transparent=True
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="WEBP"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.quality=96
    scene.world=bpy.data.worlds.new("Rat studio ambient")
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.64,.66,.73,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value=.51
    camera_data=bpy.data.cameras.new("Atlas orthographic")
    camera=bpy.data.objects.new("Atlas camera",camera_data)
    scene.collection.objects.link(camera)
    camera_data.type="ORTHO"
    camera_data.clip_end=300
    camera.location=(0,0,45)
    scene.camera=camera
    for name, color, power, direction in [
        ("Warm key",(1,.84,.69),2.8,(.35,-.65,1)),
        ("Blue rim",(.55,.70,1),1.3,(-.8,.5,.8))
    ]:
        light=bpy.data.lights.new(name,"SUN")
        light.energy=power
        light.color=color
        light.angle=.4
        obj=bpy.data.objects.new(name,light)
        scene.collection.objects.link(obj)
        obj.rotation_euler=(-V(direction)).to_track_quat("-Z","Y").to_euler()

    def rot(x=0,y=0,z=0):
        return Euler((x,y,z)).to_matrix().to_4x4()
    pitch=math.atan(1/math.sqrt(2))
    view=rot(pitch-PI/2)
    all_mats=list(body.data.materials)
    world_cell=3.7  # tighter framing while preserving the tail and evasive leap
    for clip,count in SHEETS.items():
        verts=[]
        faces=[]
        mids=[]
        rig.animation_data.action=bpy.data.actions["rat_"+clip]
        looping=clip in ("idle","run","stalk")
        for col in range(count):
            t=col/count if looping else col/(count-1)
            scene.frame_set(1+round(48*t))
            dg=bpy.context.evaluated_depsgraph_get()
            obj=body.evaluated_get(dg)
            mesh=obj.to_mesh()
            coords=[v.co.copy() for v in mesh.vertices]
            polys=[tuple(p.vertices) for p in mesh.polygons]
            indices=[p.material_index for p in mesh.polygons]
            for row in range(VIEWS):
                spin=view@rot(z=row*2*PI/VIEWS)
                origin=V(((col+.5-count/2)*world_cell,
                          (VIEWS/2-.5-row)*world_cell-.15*world_cell,0))
                offset=len(verts)
                verts.extend(spin@v+origin for v in coords)
                faces.extend(tuple(offset+k for k in poly) for poly in polys)
                mids.extend(indices)
            obj.to_mesh_clear()
        data=bpy.data.meshes.new("Baked rat "+clip)
        data.from_pydata(verts,[],faces)
        data.update()
        for material in all_mats:
            data.materials.append(material)
        data.polygons.foreach_set("material_index",mids)
        batch=bpy.data.objects.new("Baked rat "+clip,data)
        scene.collection.objects.link(batch)
        body.hide_render=True
        scene.render.resolution_x=CELL*count
        scene.render.resolution_y=CELL*VIEWS
        camera_data.ortho_scale=VIEWS*world_cell
        scene.render.filepath=str(ROOT/(clip+".webp"))
        bpy.ops.render.render(write_still=True)
        body.hide_render=False
        bpy.data.objects.remove(batch,do_unlink=True)
        bpy.data.meshes.remove(data)
    print("Rat rig and "+str(len(SHEETS))+" 32-view atlases generated in "+str(ROOT))
