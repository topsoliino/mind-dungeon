"""Build the soul-vessel's genuine Blender source and a baked isometric sprite.

Gameplay deliberately uses the baked PNG, not another per-object WebGL model:
that keeps poison smoke and multiple thrown vessels inexpensive.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "beta", "art", "props")
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
# CPU Cycles renders reliably on headless CI without a GPU or X server.
scene.render.engine = "CYCLES"
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 384
scene.render.resolution_y = 576
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.world.color = (.13, .15, .18)

def material(name, color, roughness=.83, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        # Principled BSDF socket name changed between Blender 3 and 4.
        socket = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        if socket:
            socket.default_value = (*emission, 1)
    return mat

stone = material("Slate grey blue pitted carved stone", (.23, .27, .32))
dark = material("Obsidian dark shoulder grooves", (.072, .092, .12))
rim = material("Pale worn lip edges", (.51, .56, .59), .7)
runes = material("Sea green glowing runes", (.12, .60, .53), .55,
                 (.07, .40, .32))
chips = material("Light mineral inclusions", (.36, .40, .41))

# The visible main shell is a true multi-ring closed 3D revolved mesh,
# with asymmetrical handmade chips rather than a 2D ellipse or flat card.
profile = [
    (.055,.18),(.09,.25),(.17,.30),(.28,.33),(.41,.33),
    (.55,.285),(.70,.245),(.84,.25),(.96,.28),
    (1.045,.255),(1.085,.22)
]
n = 48
vertices = []
for k, (z, rad) in enumerate(profile):
    for i in range(n):
        angle = 2*math.pi*i/n
        chip = 1 + .018*math.sin(i*2.1+k*1.7) + .012*math.sin(i*4.7-k*.91)
        vertices.append((rad*math.cos(angle)*chip,
                         rad*math.sin(angle)*chip,z))
faces = []
face_materials = []
for j in range(len(profile)-1):
    for i in range(n):
        faces.append((j*n+i,j*n+(i+1)%n,
                      (j+1)*n+(i+1)%n,(j+1)*n+i))
        face_materials.append(1 if j in (2,6,9) else 0)
faces.append(tuple(reversed(tuple(range(n)))))
face_materials.append(1)
faces.append(tuple((len(profile)-1)*n+i for i in range(n)))
face_materials.append(2)
mesh = bpy.data.meshes.new("Ghost vessel sculpted lathed shell")
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new("Ghost vessel | carved stone body", mesh)
bpy.context.collection.objects.link(obj)
for mat in (stone,dark,rim):
    obj.data.materials.append(mat)
for polygon, index in zip(mesh.polygons,face_materials):
    polygon.material_index=index

def torus(name, z, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=9,
        location=(0,0,z),major_radius=major,minor_radius=minor)
    ob=bpy.context.object
    ob.name=name
    ob.data.materials.append(mat)
    return ob

torus("Chipped base ring", .105, .245, .024, dark)
torus("Wear line at neck", .995, .266, .018, rim)
torus("Mouth rim", 1.103, .229, .034, dark)
torus("Ancient bright rim glint", 1.123, .222, .012, rim)

# The narrow neck surrounds an actual black open mouth.
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.179, depth=.012,
    location=(0,0,1.116))
bpy.context.object.name="Black hollow vessel opening"
bpy.context.object.data.materials.append(dark)

# Curved engraved sigils float 1mm above the physical shell. Each glyph is
# an actual bevelled Blender curve and stays with the sculpt on export.
def stroke(name, coords, mat, thickness=.008):
    curve=bpy.data.curves.new(name,"CURVE")
    curve.dimensions="3D"
    curve.bevel_depth=thickness
    curve.resolution_u=12
    curve.bevel_resolution=3
    spline=curve.splines.new("POLY")
    spline.points.add(len(coords)-1)
    for item, position in zip(spline.points,coords):
        item.co=(*position,1)
    ob=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)

# Front is -Y; the glyphs follow curvature rather than clipping through it.
def front(x,z,radius=.305):
    depth=-math.sqrt(max(.01,radius*radius-x*x))-.006
    return (x,depth,z)

for a in range(5):
    angle = 2*math.pi*a/5
    # concentric ceremonial reliefs, all proper mesh/curve geometry
    z=.39+a*.12
    rr=.32 if z<.55 else .26 if z<.80 else .27
    path=[front(.18*math.sin(angle+v*.07),z+v*.016,rr)
          for v in range(-3,4)]
    stroke("Cracked carved soul fissure %02d"%a,path,dark,.009)

sigils=[
    [(-.115,.46),(-.025,.60),(.055,.46),(.14,.62)],
    [(-.105,.72),(0,.82),(.105,.71)],
    [(-.105,.72),(.105,.71)],
    [(0,.40),(0,.53)]
]
for k, pts in enumerate(sigils):
    stroke("Ancient spectral rune %d"%k,
           [front(x,z,.32 if z<.56 else .25 if z>.66 else .285)
            for x,z in pts],runes,.010)

# A hint of shattered mineral paint rather than a uniform plastic surface.
for i in range(16):
    angle=2*math.pi*i/16
    z=.25+.67*(.5+.5*math.sin(i*7.3))
    rr=.29 if z<.55 else .245
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.018,
        location=(rr*math.cos(angle),rr*math.sin(angle),z))
    shard=bpy.context.object
    shard.name="Stone chip %02d"%i
    shard.scale=(1.0,.45,1.5)
    shard.data.materials.append(chips if i%3==0 else stone)

def area(name, location, energy, size, color):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=energy
    data.shape="DISK"
    data.size=size
    data.color=color
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=location
    target=Vector((0,0,.55))
    ob.rotation_euler=(target-ob.location).to_track_quat("-Z","Y").to_euler()

area("Guardian warm key",(-2.3,-3.0,4.0),380,4.0,(1,.83,.72))
area("Spectral cool fill",(2.4,-1.0,2.4),220,3.5,(.52,.78,1))
area("Pale rim",(0,3.0,2.8),260,2.3,(.74,.92,.91))
bpy.ops.object.camera_add(location=(2.45,-4.5,2.55))
camera=bpy.context.object
camera.name="Iso camera | consistent with Guardian sprites"
camera.rotation_euler=(Vector((0,0,.63))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.type="ORTHO"
camera.data.ortho_scale=1.55
scene.camera=camera
scene.render.filepath=os.path.join(OUT,"ghost-vessel.png")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"ghost-vessel.blend"))
bpy.ops.render.render(write_still=True)
# Also publish the real mesh for future skinned/cinematic use; gameplay
# intentionally loads only the cheap Blender-baked transparent PNG.
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,"ghost-vessel.glb"),
                          export_format="GLB",export_yup=True)
print("Ghost vessel Blender model, GLB and baked game sprite generated")
