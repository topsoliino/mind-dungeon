"""Build the editable small-rat armature and 32-view animation atlases.
Run in the repository root:
    blender -b --factory-startup -t 4 --python-exit-code 1 -P tools/build-isometric-rat.py

32 camera-relative directions (11.25° steps), no 2D sprite rotation.
Each WebP sheet has animation frames on X and 32 directions on Y.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector, Euler, Matrix

ROOT = Path.cwd() / "beta/art/rat"
ROOT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
# Consistent game-palette color management: AgX/Filmic desaturates dark
# creatures compared with the high-contrast guardian's silver/red materials.
scene.view_settings.view_transform = 'Standard'
try:
    scene.view_settings.look = 'Medium High Contrast'
except TypeError:
    scene.view_settings.look = 'Medium High Contrast' if 'Medium High Contrast' in scene.view_settings.bl_rna.properties['look'].enum_items.keys() else 'None'
V = Vector
PI = math.pi
VIEWS = 32
CELL = 128
SHEETS = {
    "idle": 8, "run": 10, "stalk": 10, "jump": 12,
    "bite": 9, "combo": 14, "dodge": 10, "dodge-left": 10, "death": 14
}

def mat(name, color, roughness=.83):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return m

fur = mat("Warm dark umber fur", (.255, .145, .105))
fur_light = mat("Copper brown fur highlights", (.44, .275, .19))
belly = mat("Warm grey belly", (.49, .385, .295))
skin = mat("Russet pink paws and tail", (.61, .29, .30))
ear = mat("Rose inner ears", (.78, .395, .39))
eye = mat("Black glass eyes", (.012, .008, .014), .22)
nose = mat("Dark wet nose", (.225, .065, .084), .27)
teeth = mat("Small ivory incisors", (.77, .69, .50))
whisker = mat("Pale whiskers", (.67, .58, .48))
fur_shadow = mat("Dense charcoal underfur", (.13, .105, .12))
fur_coat = mat("Dark matted dorsal coat", (.205, .14, .135))
fur_gold = mat("Sparse warm guard hairs", (.53, .335, .22))
ear_shadow = mat("Inner ear folds", (.39, .19, .20))
claw = mat("Hard ivory claws", (.69, .61, .47))
hide = mat("Weathered saddle-brown leather", (.20, .115, .074))
brass = mat("Found dungeon brass", (.53, .33, .12))
patch = mat("Ragged muted red cloth", (.34, .10, .12))
tail_ring = mat("Tail joint dark folds", (.35, .16, .17))

joints = {}
parts = []

def joint(name, xyz, parent=None):
    joints[name] = (V(xyz), parent)

def add_part(obj, name, bone, material):
    obj.name = name
    obj.data.materials.append(material)
    parts.append((obj, bone))
    return obj

def oval(name, bone, pos, scale, material, segments=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=pos)
    o = bpy.context.object
    o.scale = scale
    return add_part(o, name, bone, material)

def rod(name, bone, start, end, radius, material, tip=None):
    a, b = V(start), V(end)
    bpy.ops.mesh.primitive_cone_add(
        vertices=10, radius1=radius, radius2=radius if tip is None else tip,
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

oval("Broad pear-shaped body", "Root", (0, .015, .36), (.33, .58, .31), fur)
oval("Underbelly", "Root", (0, -.08, .21), (.267, .44, .16), belly)
oval("Shoulder ruff", "Chest", (0, -.31, .38), (.275, .29, .235), fur_light)
oval("Head", "Head", (0, -.59, .42), (.245, .255, .21), fur)
oval("Long muzzle", "Head", (0, -.746, .345), (.115, .192, .085), fur_light)
oval("Nose", "Nose", (0, -.915, .344), (.047, .038, .04), nose)
oval("Jaw", "Jaw", (0, -.725, .295), (.102, .12, .035), belly)
for s in (-1, 1):
    oval("Glossy eye", "Head", (s*.177, -.722, .484), (.036, .041, .041), eye)
    oval("Brow", "Head", (s*.157, -.686, .533), (.068, .046, .026), fur_light)
    side = "L" if s > 0 else "R"
    oval("Ear cartilage", "Ear"+side, (s*.193, -.505, .598), (.112, .052, .143), skin)
    oval("Ear pink inside", "Ear"+side, (s*.193, -.555, .612), (.078, .023, .097), ear)
    for k in range(3):
        rod("Whisker", "Nose", (s*.045, -.866, .335+(k-1)*.02),
            (s*(.30+k*.032), -.81+k*.036, .315+(k-1)*.072), .0037, whisker, .001)
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
oval("Dense dark uppercoat", "Root",(0,.12,.59),(.275,.43,.116),fur_coat,20)
oval("Rump underfur", "Root",(0,.37,.345),(.29,.29,.238),fur)
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
    oval("Thick ear edge", "Ear"+side,(sign*.198,-.542,.611),
         (.125,.048,.151),fur,16)
    oval("Fleshy folded ear interior", "Ear"+side,
         (sign*.198,-.574,.618),(.087,.023,.102),ear,16)
    oval("Dark ear fold", "Ear"+side,
         (sign*.19,-.596,.575),(.041,.010,.029),ear_shadow)
    oval("Raised nasal whisker root", "Nose",
         (sign*.065,-.853,.329),(.036,.040,.030),fur_light)
    for k in range(5):
        level=k-2
        rod("Fine curved whisker", "Nose",
            (sign*.054,-.875,.341+level*.016),
            (sign*(.34+abs(level)*.024),-.80+abs(level)*.024,
             .328+level*.053),.0031,whisker,.0007)
    # Cheek ruff silhouette: directional triangular locks, not a smooth egg.
    for k in range(8):
        yy=-.73+k*.045
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
for row in range(10):
    y=-.29+row*.108
    width=.15+.12*max(0,1-abs(y-.07)/.61)
    height=.714+.03*math.cos((y-.12)*2.5)
    for col in range(7):
        t=(col-3)/3
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

# Worn scavenger harness: two straps, brass buckles and a tiny torn patch.
# This provides a strong visual identity without obscuring rat anatomy.
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

# Pose batching: 1 render per animation, not 32 x frames individual renders.
scene.render.engine="CYCLES"
scene.cycles.samples=18
scene.cycles.use_denoising=False
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
                      (VIEWS/2-.5-row)*world_cell-.26*world_cell,0))
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
