"""Reusable opaque, bone-skinned multi-zone fur groom for creature rigs.

Unlike the original dorsal-only scatter this works across 360 degrees,
including belly, cheeks, skull, neck and legs. Blender fibres are genuine
3D tapered strands; UV0.x is their root-to-tip spring weight for Three.js.
Anatomy masks exclude bare skin (paws, nose, tails, exposed eyes).
"""
import math
import random
import bpy
from mathutils import Vector

TAU=math.tau

def _build(name, strands, materials, seed):
    """Assemble triangular tapered 3D fibres into one efficient mesh."""
    verts,faces,mids,weights=[],[],[],[]
    rng=random.Random(seed+917)
    for root,normal,direction,reach,width in strands:
        root=Vector(root);normal=Vector(normal).normalized()
        direction=Vector(direction).normalized()
        tangent=direction.cross(Vector((0,0,1)))
        if tangent.length<.075:tangent=direction.cross(Vector((1,0,0)))
        tangent.normalize()
        wing=direction.cross(tangent).normalized()
        middle=root+direction*reach*.47+normal*.006
        tip=root+direction*reach+normal*.016
        start=len(verts)
        for center,radius,stiffness in (
                (root,width,0.0),(middle,width*.55,.46)):
            for n in range(3):
                a=TAU*n/3
                p=center+radius*(tangent*math.cos(a)+wing*math.sin(a))
                verts.append(tuple(p))
                weights.append(stiffness)
        verts.append(tuple(tip));weights.append(1.0)
        for n in range(3):
            nxt=(n+1)%3
            faces.append((start+n,start+nxt,start+3+nxt,start+3+n))
        for n in range(3):
            faces.append((start+3+n,start+3+(n+1)%3,start+6))
        tone=rng.random()
        mat=(2 if tone>.955 and len(materials)>2 else
             0 if tone<.24 and len(materials)>1 else
             min(1,len(materials)-1))
        mids.extend([mat]*6)
    if not verts:raise ValueError("Fur mask excluded all roots: "+name)
    data=bpy.data.meshes.new(name+" geometry")
    data.from_pydata(verts,[],faces)
    data.update()
    for mat in materials:data.materials.append(mat)
    data.polygons.foreach_set("material_index",mids)
    uv=data.uv_layers.new(name="FurRootTip")
    for polygon in data.polygons:
        polygon.use_smooth=True
        for loop in polygon.loop_indices:
            vertex=data.loops[loop].vertex_index
            uv.data[loop].uv=(weights[vertex],0)
    obj=bpy.data.objects.new(name,data)
    bpy.context.scene.collection.objects.link(obj)
    obj["fur_groom_count"]=len(strands)
    obj["fur_groom_seed"]=seed
    return obj

def groom_coat(name,rings,materials,count=560,seed=1947,
               length=(.025,.07),base_width=(.0028,.0068),
               full_coverage=True,brush=(0,.72,.10),mask=None,
               margin=.013):
    """Groom elliptic longitudinal surfaces: (y,cx,cz,rx,rz).

    Full coverage wraps 360 degrees around the animal, not just its back.
    The optional mask(root,normal) protects eyes and exposed skin.
    """
    if len(rings)<2 or count<1 or not materials:
        raise ValueError("Fur needs profile rings, count and materials")
    rings=sorted(rings)
    rng=random.Random(seed)
    ys=[ring[0] for ring in rings]
    def section(y):
        i=next((j for j in range(len(rings)-1)
                if ys[j]<=y<=ys[j+1]),len(rings)-2)
        a,b=rings[i],rings[i+1]
        t=(y-a[0])/max(.00001,b[0]-a[0])
        return [a[j]*(1-t)+b[j]*t for j in range(1,5)]
    strands=[]
    attempts=0
    while len(strands)<count and attempts<count*18:
        attempts+=1
        y=rng.uniform(ys[0]+margin,ys[-1]-margin)
        cx,cz,rx,rz=section(y)
        theta=rng.uniform(0,TAU) if full_coverage else rng.uniform(.05,math.pi-.05)
        normal=Vector((math.cos(theta)/max(.015,rx),0,
                       math.sin(theta)/max(.015,rz))).normalized()
        root=Vector((cx+rx*math.cos(theta),y,cz+rz*math.sin(theta)))
        if mask is not None and not mask(root,normal):continue
        # Undercoat projects radially; guard hairs sweep backwards and up,
        # breaking the outline instead of lying flat like shiny bare skin.
        brush_vector=Vector(brush)
        direction=(normal*rng.uniform(.75,1.13)+
                   brush_vector*rng.uniform(.50,.92)+
                   Vector((rng.uniform(-.22,.22),rng.uniform(-.16,.16),
                           rng.uniform(-.15,.15)))).normalized()
        reach=rng.uniform(*length)
        width=rng.uniform(*base_width)
        strands.append((root-normal*.004,normal,direction,reach,width))
    if len(strands)<count:
        raise ValueError("Insufficient exposed coat area for "+name)
    return _build(name,strands,materials,seed)

def groom_limb(name,a,b,radius_start,radius_end,materials,count=250,
               seed=1947,length=(.023,.054),base_width=(.0024,.0046),
               start=.03,end=.84):
    """Fur sleeve around a real limb/bone, deliberately short of bare paws.

    The resulting object can be rigidly skinned to the same limb bone.
    """
    a,b=Vector(a),Vector(b)
    axis=(b-a).normalized()
    u=axis.cross(Vector((0,1,0)))
    if u.length<.01:u=axis.cross(Vector((1,0,0)))
    u.normalize()
    v=axis.cross(u).normalized()
    rng=random.Random(seed)
    strands=[]
    for _ in range(count):
        t=rng.uniform(start,end)
        angle=rng.uniform(0,TAU)
        normal=(u*math.cos(angle)+v*math.sin(angle)).normalized()
        r=radius_start*(1-t)+radius_end*t
        root=a.lerp(b,t)+normal*r
        direction=(normal*rng.uniform(.72,1.25)-
                   axis*rng.uniform(.04,.28)+
                   Vector((0,.21,.16))+
                   u*rng.uniform(-.17,.17)).normalized()
        strands.append((root-normal*.003,normal,direction,
                        rng.uniform(*length),rng.uniform(*base_width)))
    return _build(name,strands,materials,seed)
