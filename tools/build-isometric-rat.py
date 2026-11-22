"""Mind Dungeon quadruped rat: NEW Guardian-derived character production.

Full replacement for the previous rat model and pose system. The original
Guardian builder's hex-sRGB materials, beveled polygonal profile/limb meshes,
weighted normals, joint-space point/bend_joint inverse kinematics, foot
planting, and pose-keyframe baking are adapted to a four-legged animal.
This is not a resized Guardian: the animal has a sculpted, shaggy body, real
paws, short ears, a flexible segmented tail and absolutely no equipment.

MIND_DUNGEON_RIG_ONLY=1 blender -b --factory-startup -t 4 \
  --python-exit-code 1 -P tools/build-isometric-rat.py

Stable game/export API: "Rat rig • editable", "Small rat • fully weighted skin",
and nine Blender actions rat_idle, rat_run, rat_stalk, rat_jump, rat_bite,
rat_combo, rat_dodge, rat_dodge-left, rat_death. WebGL uses the Guardian lights.
"""
import math
import os
from pathlib import Path
import bpy
from mathutils import Vector, Euler, Matrix

ROOT=Path.cwd()/"beta/art/rat"
ROOT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.view_settings.view_transform="Standard"
try:scene.view_settings.look="Medium High Contrast"
except (TypeError,ValueError):pass

V=Vector
PI=math.pi
VIEWS=32
CELL=128
SHEETS={
    "idle":8,"run":10,"stalk":10,"jump":12,"bite":9,
    "combo":14,"dodge":10,"dodge-left":10,"death":14,
}

def srgb_to_linear(v):
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

def material(name,hex_color,roughness=.79,metal=0):
    """The actual Guardian build-player-sprite-study.py material() contract."""
    rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    linear=tuple(srgb_to_linear(v) for v in rgb)
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*linear,1)
    m.use_nodes=True
    shader=m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value=(*linear,1)
    shader.inputs["Roughness"].default_value=roughness
    shader.inputs["Metallic"].default_value=metal
    return m

# The Guardian's broad graphite -> mid-blue -> silver-edge value language.
# Every single surface is anatomical: blue-grey fur, claws, teeth and skin.
coat=material("Guardian rat slate-blue fur","667b90",.81)
mane=material("Guardian rat graphite underfur","34495f",.86)
high=material("Guardian rat silver guard hairs","a3b1bd",.78)
mid=material("Guardian rat cool flank fur","76899b",.84)
belly=material("Guardian rat shaded belly","687888",.88)
muzzle=material("Guardian rat pale snout fur","92a1af",.83)
skin=material("Guardian rat muted skin","756975",.87)
ears=material("Guardian rat ear lining","a28f98",.83)
eye=material("Guardian rat glass-black eyes","131a28",.24)
nose=material("Guardian rat graphite nose","333545",.35)
teeth=material("Guardian rat ivory incisors","e1dfd2",.66)
claw=material("Guardian rat weathered claw","aaa7a3",.67)
tailshade=material("Guardian rat ringed tail folds","534e61",.88)

SIDES=(("L",-1),("R",1))
# +X is screen right; -Y is forward, identical to Guardian/skeleton world.
design={
    "Root":((0,0,.326),(0,-.235,.351),None),
    "Chest":((0,-.32,.373),(0,-.535,.413),"Root"),
    "Neck":((0,-.525,.400),(0,-.633,.407),"Chest"),
    "Head":((0,-.627,.422),(0,-.814,.373),"Neck"),
    "Jaw":((0,-.706,.309),(0,-.832,.279),"Head"),
    "Nose":((0,-.829,.369),(0,-.957,.326),"Head"),
}
for side,sign in SIDES:
    shoulder=(sign*.222,-.361,.312)
    knee_front=(sign*.278,-.397,.165)
    paw_front=(sign*.280,-.474,.060)
    hip=(sign*.265,.316,.330)
    knee_hind=(sign*.310,.408,.182)
    paw_hind=(sign*.312,.473,.063)
    design.update({
        "Ear."+side:((sign*.164,-.579,.580),
                     (sign*.222,-.551,.690),"Head"),
        "Shoulder."+side:(shoulder,knee_front,"Chest"),
        "Foreleg."+side:(knee_front,paw_front,"Shoulder."+side),
        "FrontPaw."+side:(paw_front,(paw_front[0],-.585,.049),"Foreleg."+side),
        "Hip."+side:(hip,knee_hind,"Root"),
        "Hindleg."+side:(knee_hind,paw_hind,"Hip."+side),
        "HindPaw."+side:(paw_hind,(paw_hind[0],.555,.049),"Hindleg."+side),
    })
for i in range(6):
    joint=(0,.448+i*.171,.276-.026*max(0,i-1))
    next_joint=(0,.619+i*.171,.264-.027*max(0,i))
    design["Tail%d"%i]=(joint,next_joint,
         "Root" if i==0 else "Tail%d"%(i-1))

arm=bpy.data.armatures.new("Guardian IK rat quadruped")
rig=bpy.data.objects.new("Rat rig • editable",arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
rig.show_in_front=True
bpy.ops.object.mode_set(mode="EDIT")
for name,(head,tip,parent) in design.items():
    eb=arm.edit_bones.new(name)
    eb.head=V(head)
    eb.tail=V(tip)
    if parent:eb.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
rest={n:(V(h),V(t),p) for n,(h,t,p) in design.items()}
parts=[]
paw_soles={}

def mesh(name,vertices,faces,mats,bone,bevel=.005,indices=None,soft=False):
    """Guardian mesh: 2-segment angle bevel, weighted normals, explicit facets."""
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    for m in mats:data.materials.append(m)
    if indices:
        data.polygons.foreach_set("material_index",indices)
    if bevel>0 and len(data.polygons)>=4:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new("Forged edges","BEVEL")
        mod.width=bevel
        mod.segments=2
        mod.limit_method="ANGLE"
        mod.angle_limit=.16
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if hasattr(data,"use_auto_smooth"):
            data.use_auto_smooth=True
            data.auto_smooth_angle=.64
        for polygon in data.polygons:polygon.use_smooth=soft
        normals=obj.modifiers.new("Weighted normals","WEIGHTED_NORMAL")
        normals.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=normals.name)
    else:
        for polygon in data.polygons:polygon.use_smooth=soft
    parts.append((obj,bone))
    return obj

def profile(name,levels,mats,bone,sides=8,phase=PI/8,bevel=.005,soft=False):
    """Guardian profile: horizontal ring levels and authored material bands."""
    coords=[(cx+rx*math.cos(phase+i*math.tau/sides),
             cy+ry*math.sin(phase+i*math.tau/sides),z)
             for z,cx,cy,rx,ry in levels for i in range(sides)]
    faces=[tuple(reversed(range(sides)))]
    ids=[0]
    for j in range(len(levels)-1):
        for i in range(sides):
            a=j*sides+i
            b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
            ids.append((j+(1 if i in (2,3,4) else 0))%len(mats))
    faces.append(tuple(range(len(coords)-sides,len(coords))))
    ids.append(len(mats)-1)
    return mesh(name,coords,faces,mats,bone,bevel,ids,soft)

def limb(name,a,b,widths,mats,bone,sides=8,bevel=.004,soft=False):
    """Guardian limb: tapered longitudinal volume around arbitrary bone axis."""
    a,b=V(a),V(b)
    axis=(b-a).normalized()
    u=axis.cross(V((0,1,0)))
    if u.length<.01:u=axis.cross(V((1,0,0)))
    u.normalize()
    v=axis.cross(u)
    coords=[tuple(a.lerp(b,t)+u*rx*math.cos(i*math.tau/sides)+
                  v*ry*math.sin(i*math.tau/sides))
            for t,rx,ry in widths for i in range(sides)]
    faces=[tuple(reversed(range(sides)))]
    ids=[0]
    for row in range(len(widths)-1):
        for i in range(sides):
            k=row*sides+i;n=row*sides+(i+1)%sides
            faces.append((k,n,n+sides,k+sides))
            ids.append((row+i)%len(mats))
    faces.append(tuple(range(len(coords)-sides,len(coords))))
    ids.append(len(mats)-1)
    return mesh(name,coords,faces,mats,bone,bevel,ids,soft)

def plate(name,points,thickness,mat,bone,bevel=.003):
    """Guardian plate for thin organic ear flaps, not armor.

    Mirror-contours reverse their winding. Correct that before GLB export
    so the left ear is not back-face culled (which looked transparent).
    """
    points=list(points)
    winding=sum(points[i][0]*points[(i+1)%len(points)][2]-
                points[(i+1)%len(points)][0]*points[i][2]
                for i in range(len(points)))
    if winding<0:points.reverse()
    n=len(points)
    verts=list(points)+[(x,y+thickness,z) for x,y,z in points]
    faces=[tuple(range(n)),tuple(reversed(range(n,n*2)))]
    faces.extend((i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n))
    return mesh(name,verts,faces,[mat],bone,bevel)

def longitudinal_profile(name,rings,mats,bone,sides=14,bevel=.005,soft=False):
    """Guardian mesh/profile system, rotated into a quadruped's long axis.

    Each cross-section is (y,cx,cz,rx,rz). Top-and-side swatches are authored
    per face so fur reads clearly at the Guardian's small isometric scale.
    No overlapping UV spheres or generic cylinders.
    """
    coords=[]
    for y,x,z,rx,rz in rings:
        for i in range(sides):
            angle=(i+.5)*math.tau/sides
            coords.append((x+rx*math.cos(angle),y,z+rz*math.sin(angle)))
    faces=[tuple(range(sides))]
    ids=[0]
    for row in range(len(rings)-1):
        for i in range(sides):
            a=row*sides+i;b=row*sides+(i+1)%sides
            faces.append((a,a+sides,b+sides,b))
            # Broad subtle dorsal stripe, lighter lateral fur and deep
            # creases underneath. No armor-like chunky patches.
            ids.append(1 if i in (2,3,4) and row in (2,3,4,5) else
                       2 if i in (0,1,5,6,13) and row in (1,2,3,4) else
                       3 if i in (9,10,11) else 0)
    faces.append(tuple(reversed(range(len(coords)-sides,len(coords)))))
    ids.append(0)
    return mesh(name,coords,faces,mats,bone,bevel,ids,soft)

def tuft(name,origin,direction,bone,mat,thick=.016):
    """Short swept fur lock integrated into the body surface."""
    a=V(origin);b=a+V(direction)
    return limb(name,a,b,[(0,thick,thick*.74),
          (.37,thick*.82,thick*.6),(1,.001,.001)],
          [mat],bone,6,bevel=.001,soft=True)

def mass(name,at,widths,bone,mats):
    x,y,z=at
    return profile(name,[(z-widths[2],x,y,widths[0]*.30,widths[1]*.32),
           (z-widths[2]*.38,x,y,widths[0]*.79,widths[1]*.8),
           (z+widths[2]*.25,x,y,widths[0],widths[1]),
           (z+widths[2],x,y,widths[0]*.42,widths[1]*.44)],
           mats,bone,10,bevel=.004,soft=True)

# Main pear-shaped rodent torso. Shoulder narrows toward the muzzle,
# haunches are broad and slightly taller, not a squared-off armor block.
torso=longitudinal_profile("Shaggy slate-blue torso",[
    (-.565,0,.364,.065,.065),
    (-.456,0,.377,.169,.141),
    (-.29,0,.388,.251,.214),
    (-.055,0,.371,.303,.255),
    (.18,0,.390,.342,.289),
    (.365,0,.376,.307,.260),
    (.530,0,.331,.198,.160),
    (.615,0,.287,.043,.044),
], [coat,mane,mid,belly],"Root",16,bevel=.007,soft=True)
mass("Fur-covered chest",(0,-.346,.385),(.204,.17,.172),
     "Chest",[coat,mid,mane])
# No overlapping belly ellipsoid: the former bright continuous horizontal
# strip read as armor from the game's true isometric camera. The underside
# is now a controlled dark/blue-grey region of the single torso shell.
neck=mass("Furry neck",(0,-.526,.402),(.152,.116,.122),
     "Neck",[coat,mane,mid])
# More natural rat anatomy: long broad cheeks taper into a pointed snout.
head=longitudinal_profile("Guardian sculpted rat head",[
    (-.875,0,.343,.026,.024),
    (-.823,0,.369,.081,.067),
    (-.742,0,.404,.159,.124),
    (-.645,0,.436,.217,.165),
    (-.532,0,.437,.207,.163),
    (-.444,0,.418,.083,.070)
], [coat,mane,mid,belly],"Head",14,bevel=.006,soft=True)
limb("Tapered bone-supported snout",(0,-.749,.367),
     (0,-.940,.323),
     [(0,.109,.092),(.37,.086,.065),(.75,.052,.044),(1,.022,.019)],
     [muzzle,coat],"Head",10,bevel=.003,soft=True)
mass("Graphite nose",(0,-.943,.323),(.047,.036,.033),
     "Nose",[nose])
mass("Small exposed jaw",(0,-.759,.280),(.092,.095,.037),
     "Jaw",[belly,coat])
for i in range(2):
    x=(i-.5)*.036
    limb("Visible incisors %d"%i,(x,-.815,.271),(x,-.856,.241),
        [(0,.015,.014),(1,.009,.008)],[teeth],"Jaw",6,bevel=.001)
for side,sign in SIDES:
    eye_x=sign*.156
    mass("Dark ocular fur "+side,(eye_x,-.727,.489),(.050,.046,.039),
         "Head",[mane])
    mass("Glassy black eye "+side,(sign*.170,-.760,.495),(.027,.031,.027),
         "Head",[eye])
    mass("Raised cheek pad "+side,(sign*.161,-.664,.385),(.075,.083,.071),
         "Head",[coat,mid])
    # The small triangular ears have actual thickness, shadow folds and
    # muted inner skin; they remain fully three-dimensional from every view.
    plate("Thick ear outer "+side,[
        (sign*.114,-.566,.534),(sign*.248,-.559,.537),
        (sign*.263,-.550,.627),(sign*.213,-.548,.695),
        (sign*.137,-.557,.667)],.036,coat,"Ear."+side,.005)
    plate("Inset ear skin "+side,[
        (sign*.152,-.579,.558),(sign*.222,-.578,.561),
        (sign*.236,-.570,.626),(sign*.206,-.568,.658),
        (sign*.164,-.575,.632)],.008,ears,"Ear."+side,.002)
    # A few deliberate fur silhouettes, not 200 noisy hairs.
    for row,(y,z) in enumerate(((-.705,.406),(-.654,.439),(-.579,.458))):
        tuft("Swept cheek ruff %s%d"%(side,row),
            (sign*.192,y,z),
            (sign*(.049+.009*(row%2)),.048,-.012), "Head",
            high if row==1 else coat,.015)
    for j in range(2):
        x=sign*.050
        z=.330+(j-.5)*.031
        limb("Face whisker %s%d"%(side,j),(x,-.893,z),
             (sign*(.265+j*.033),-.792+j*.030,z+.028*(j-.5)),
             [(0,.0038,.0038),(1,.001,.001)],
             [high],"Nose",6,bevel=0)
    shoulder,elbow,_=rest["Shoulder."+side]
    forepaw=rest["FrontPaw."+side][0]
    hip,knee,_=rest["Hip."+side]
    hindpaw=rest["HindPaw."+side][0]
    # Quadruped limbs attach to coherent shoulder/hip volumes. Guardian
    # tapered limb surfaces replace the old spheres and cones.
    limb("Ruff-covered shoulder "+side,shoulder,elbow,[
        (0,.077,.070),(.22,.088,.078),(.56,.062,.057),(1,.047,.043)],
        [coat,mid,mane],"Shoulder."+side,10,soft=True)
    limb("Anterior foreleg "+side,elbow,forepaw,[
        (0,.047,.042),(.44,.039,.034),(1,.028,.027)],
        [coat,mid],"Foreleg."+side,8,soft=True)
    limb("Furred haunch "+side,hip,knee,[
        (0,.123,.111),(.34,.127,.115),(.65,.087,.078),(1,.059,.058)],
        [coat,mane,mid],"Hip."+side,10,soft=True)
    limb("Posterior hindleg "+side,knee,hindpaw,[
        (0,.052,.049),(.42,.047,.041),(1,.032,.029)],
        [coat,mid],"Hindleg."+side,8,soft=True)
    mass("Anterior naked paw "+side,tuple(forepaw),(.069,.076,.034),
         "FrontPaw."+side,[skin,belly])
    mass("Posterior naked paw "+side,tuple(hindpaw),(.078,.089,.036),
         "HindPaw."+side,[skin,belly])
    # Guardian's sole geometry provides actual planted-paw ground contact.
    for front,label,paw in [(True,"FrontPaw."+side,forepaw),
                            (False,"HindPaw."+side,hindpaw)]:
        contact=[]
        for index in range(3):
            x=paw.x+(index-1)*.039
            endpoint=(x,paw.y+(-.116 if front else .123),.034)
            toe=limb("Individual toe %s %d"%(label,index),
                (x,paw.y,.053),endpoint,
                [(0,.017,.015),(.62,.015,.014),(1,.007,.008)],
                [skin],label,6,bevel=.001)
            contact.extend([v.co.copy() for v in toe.data.vertices])
            limb("Distinct keratin claw %s%d"%(label,index),
                endpoint,(x+sign*.006,endpoint[1]+(-.023 if front else .023),.022),
                [(0,.009,.009),(1,.001,.001)],[claw],
                label,6,bevel=.001)
        paw_soles[label]=contact
# The hair is embedded along flanks and haunches, with offset, direction
# and length defined by actual anatomy. No cloth, metal or accessory objects.
for row,(y,width,z) in enumerate((
    (-.31,.215,.493),(-.17,.261,.533),(.045,.302,.554),
    (.25,.331,.566),(.41,.281,.530))):
    for side,sign in SIDES:
        x=sign*width
        tuft("Compact flank guard hairs %s%d"%(side,row),
             (x*.92,y,z-.038),
             (sign*(.037+.006*(row%2)),.058,-.012),
             "Root",mid if row in (0,3) else coat,.018)
        if row%2==0:
            tuft("Dark short undercoat tuft %s%d"%(side,row),
                 (x*.87,y,z-.067),
                 (sign*.046,.047,-.027),
                 "Root",mane,.014)
# Flexible tail with six articulated tapered segments and darker skin folds.
for i in range(6):
    a,b,_=rest["Tail%d"%i]
    radius=.050-.0066*i
    limb("Living segmented tail %d"%i,a,b,
         [(0,radius,radius*.91),(.5,radius*.83,radius*.78),
          (1,max(.007,radius-.010),max(.006,radius-.012))],
         [skin,tailshade],"Tail%d"%i,10,bevel=.002,soft=True)
    if i<5:
        limb("Tail ring texture %d"%i,a+V((0,.024,0)),
             a+V((0,.041,0)),
             [(0,radius+.003,radius*.93), (1,radius*.92,radius*.85)],
             [tailshade],"Tail%d"%i,10,bevel=.001)

# Export contract remains exactly the same as before: one fully skinned mesh.
# New geometry is NOT descended from the previous Rat builder.
for obj,bone in parts:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world=Matrix.Identity(4)
    group=obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
bpy.ops.object.select_all(action="DESELECT")
for obj,_ in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0]
bpy.ops.object.join()
body=parts[0][0]
body.name="Small rat • fully weighted skin"
body.parent=rig
modifier=body.modifiers.new("Guardian-pattern four-legged bone skin","ARMATURE")
modifier.object=rig

def orient(name,position,rotation):
    anchor=rest[name][0]
    matrix=Matrix.Translation(position)@rotation.to_4x4()@Matrix.Translation(-anchor)
    rig.pose.bones[name].matrix=matrix@rig.data.bones[name].matrix_local
    bpy.context.view_layer.update()

def attached(name,point):
    frame=rig.pose.bones[name].matrix@rig.data.bones[name].matrix_local.inverted()
    return frame@point

def point(name,head,tail,stretch=1):
    a,b,_=rest[name]
    initial=(b-a).normalized()
    direction=V(tail)-V(head)
    if direction.length<.0001:return
    mat=initial.rotation_difference(direction).to_matrix()
    if stretch!=1:
        stretch_matrix=Matrix.Identity(3)
        for row in range(3):
            for col in range(3):
                stretch_matrix[row][col]+=(stretch-1)*initial[row]*initial[col]
        mat@=stretch_matrix
    orient(name,V(head),mat)

def bend_joint(upper,lower,a,end,bias,stretch=1):
    """Guardian two-bone leg solver, scaled to quadruped shoulder and hock."""
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
    """Phase-keyed Guardian attack interpolation; deliberate held poses."""
    for (a,*p),(b,*q) in zip(keys,keys[1:]):
        if t<=b:
            k=smooth((t-a)/max(.001,b-a))
            return [v+(w-v)*k for v,w in zip(p,q)]
    return keys[-1][1:]

def pulse(t,start,peak,end):
    return smooth((t-start)/max(.001,peak-start))*smooth(
        (end-t)/max(.001,end-peak))

def gait_foot(phase,stride,stance,clearance):
    """Guardian stance / swing trajectory fitted to rapid four-beat scurry."""
    if phase<stance:
        travel=stride*(phase/stance-.5)
        height=0
        pitch,=sample([(0,-.09),(.21,.02),(.67,0),(1,.14)],phase/stance)
    else:
        t=(phase-stance)/(1-stance)
        arc=math.sin(PI*t)
        carry=(1-stance)/(2*PI*stance)
        progress=smooth(t)-carry*math.sin(2*PI*t)*(1-.55*arc)-.05*arc*arc
        travel=stride*(.5-progress)
        height=clearance*arc**1.36
        pitch,=sample([(0,.14),(.34,.13),(.58,.01),(.86,-.07),(1,-.09)],t)
    return travel,height,pitch

def place_paw(name,phase,stride,stance,clearance,crouch=0,spread=0,lift_extra=0):
    side=name.split(".")[-1]
    sign=-1 if side=="L" else 1
    front=name.startswith("Front")
    travel,lift,pitch=gait_foot(phase,stride,stance,clearance)
    ankle=rest[name][0]
    # Compute actual paw sole at every stance frame like Guardian's boots,
    # rather than rotating limbs in place and skating over the floor.
    rotation=Euler((pitch,0,sign*.05)).to_matrix()
    lowest=min((rotation@(p-ankle)).z for p in paw_soles[name])
    position=V((ankle.x+sign*spread,
                ankle.y+travel,
                max(.014,.012+lift+lift_extra-lowest-.025*crouch)))
    upper="Shoulder."+side if front else "Hip."+side
    lower="Foreleg."+side if front else "Hindleg."+side
    root=attached("Chest" if front else "Root",rest[upper][0])
    elbow=bend_joint(upper,lower,root,position,
                     (sign*.15,-1 if front else 1,.08),1.06)
    orient(name,elbow,rotation)

def sample_pose(kind,t):
    """Same Guardian evaluation order: trunk -> head -> paws -> accessories.

    The adaptation respects a rodent's long spine and diagonal footfall
    timing instead of reusing humanoid biped movement.
    """
    for bone in rig.pose.bones:
        bone.matrix_basis=Matrix.Identity(4)
        bone.rotation_mode="QUATERNION"
        bone.scale=(1,1,1)
    bpy.context.view_layer.update()
    phase=2*PI*t
    moving=kind in ("run","stalk")
    stalk=kind=="stalk"
    # Small breaths and vigilance are always present, even in attacks.
    shift=.012*math.sin(phase-.22)
    bob=.006*math.sin(phase*1.8)
    root_pitch=.025+.012*math.sin(phase-.4)
    chest_pitch=.013*math.sin(phase+.45)
    neck_pitch=-.016*math.sin(phase-.56)
    skull_pitch=.028*math.sin(phase-.72)
    load=0
    strike=0
    combo_second=0
    settle=0
    if moving:
        stride=.26 if stalk else .49
        lift=.052 if stalk else .102
        bob=.009+.034*(1-math.cos(4*PI*t))*.5
        root_pitch=.032+.043*math.sin(phase+.25)
        chest_pitch=.061+.047*math.sin(phase+.50)
        skull_pitch=-.064-.048*math.sin(phase+.16)
        shift=.021*math.sin(phase+.1)
    elif kind=="jump":
        load=pulse(t,.01,.15,.26)
        strike=pulse(t,.17,.53,.91)
        bob=-.104*load+.36*strike
        root_pitch=-.18*load+.23*strike
        chest_pitch=-.28*load+.30*strike
        skull_pitch=.29*load-.27*strike
    elif kind in ("bite","combo"):
        if kind=="bite":
            load,hit,recover=sample([
                (0,0,0,0),(.18,.85,0,0),
                (.35,1,0,0),(.42,1,.06,0),
                (.52,0,1,0),(.63,0,.35,.15),
                (.80,0,0,.65),(1,0,0,0)],t)
        else:
            load,hit,recover=sample([
                (0,0,0,0),(.13,1,0,0),(.25,1,0,0),
                (.36,0,1,0),(.44,.15,.1,.15),
                (.54,.83,0,0),(.60,1,.04,0),
                (.71,0,1,0),(.82,0,.1,.6),
                (1,0,0,0)],t)
        strike=hit
        settle=recover
        # Strong attack language: body compresses, nose tucks back,
        # front feet lift, then a fast forward/downward bite.
        bob=-.145*load+.155*hit-.027*recover
        root_pitch=-.24*load+.27*hit-.075*recover
        chest_pitch=-.43*load+.86*hit-.20*recover
        skull_pitch=.67*load-1.04*hit+.30*recover
        shift=.024*load-.040*hit
    elif kind in ("dodge","dodge-left"):
        side=-1 if kind=="dodge-left" else 1
        v=math.sin(PI*t)
        bob=.12*v
        shift=side*.055*v
        root_pitch=-.12*v
        chest_pitch=.11*v
        skull_pitch=-.1*v
    elif kind=="death":
        fall=smooth((t-.12)/.67)
        bob=-.22*fall+.034*max(0,math.sin(8*PI*t))*(1-fall)
        root_pitch=.70*fall
        chest_pitch=.44*fall
        skull_pitch=-.23*fall
        shift=.07*fall
    body_position=rest["Root"][0]+V((shift,
           (-.026 if moving else 0)+(-.022*load+.028*strike),
           bob))
    yaw=.038*math.sin(phase) if moving else .014*math.sin(phase)
    if kind=="death":yaw=.38*smooth(t/.73)
    orient("Root",body_position,
           Euler((root_pitch,0,yaw)).to_matrix())
    chest=attached("Root",rest["Chest"][0])
    orient("Chest",chest,Euler((chest_pitch,.018*math.sin(phase-.4),
                                -.40*yaw)).to_matrix())
    neck=attached("Chest",rest["Neck"][0])
    orient("Neck",neck,Euler((neck_pitch,
           .014*math.sin(phase-.6),.33*yaw)).to_matrix())
    head=attached("Neck",rest["Head"][0])
    if kind in ("bite","combo"):
        head+=V((0,.100*load-.123*strike,-.043*load+.046*strike))
    orient("Head",head,Euler((skull_pitch,
          .013*math.sin(phase-1.0),-.36*yaw)).to_matrix())
    jaw=attached("Head",rest["Jaw"][0])
    orient("Jaw",jaw,Euler((.03+.77*load-.45*strike,
                           0,.011*math.sin(phase))).to_matrix())
    nose_at=attached("Head",rest["Nose"][0])
    orient("Nose",nose_at,Euler((.045*math.sin(phase*2.3),
         0,.028*math.sin(phase*.75))).to_matrix())
    for side,sign in SIDES:
        ear=attached("Head",rest["Ear."+side][0])
        orient("Ear."+side,ear,Euler((
            -.20*load+.17*strike+.056*math.sin(phase+sign*.8),
            .050*sign*math.sin(phase*1.31),0)).to_matrix())
        for front in (True,False):
            paw=("FrontPaw." if front else "HindPaw.")+side
            if moving:
                # Four-beat alternating footfalls with staggered front/hind.
                offset=(0 if side=="L" else .5) + (0 if front else .25)
                travel_phase=(t+offset)%1
                place_paw(paw,travel_phase,stride,.65 if stalk else .58,lift,
                          spread=.012 if stalk else .029)
            else:
                # Plant all four paws during windup and keep them stable
                # during the rapid bite instead of waving them in the air.
                offset=0 if side=="L" else .5
                place_paw(paw,(.24+offset)%1,
                          .045, .82,0.003,crouch=load,
                          lift_extra=.082*strike if front else 0)
        # Regenerate the actual chain from parented skeleton matrices.
    for i in range(6):
        name="Tail%d"%i
        point_at=attached(rest[name][2],rest[name][0])
        wag=.11*math.sin(phase-i*.54)
        pitch=.062*math.sin(phase*.82-i*.5)
        if moving:
            wag+=.15*math.sin(phase-0.5*i)
            pitch+=.095*math.sin(phase-0.4*i)
        elif kind in ("bite","combo"):
            wag+=.19*load*math.sin(i*.55)-.16*strike
            pitch-=.17*load
        elif kind=="death":
            wag*=1-smooth(t/.8)
            pitch-=.22*smooth(t/.8)
        orient(name,point_at,Euler((pitch,0,wag)).to_matrix())
    bpy.context.view_layer.update()

# One readable keyframed Blender action for each existing gameplay clip.
# The same exported 24fps packed GLB and 32-direction atlas API are preserved.
for clip in SHEETS:
    action=bpy.data.actions.new("rat_"+clip)
    action.use_fake_user=True
    rig.animation_data_create().action=action
    for index in range(25):
        t=index/24
        scene.frame_set(1+2*index)
        sample_pose(clip,t)
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path="location",frame=1+2*index)
            pb.keyframe_insert(data_path="rotation_quaternion",frame=1+2*index)
            pb.keyframe_insert(data_path="scale",frame=1+2*index)
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
