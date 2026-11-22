"""Reusable deterministic Blender fur groom for quadrupeds.

Solid tapered 3D fibers follow the creature's own anatomical mesh profile.
UV.x encodes root-to-tip stiffness for the shared Three.js spring simulation.
"""
import math
import random
import bpy
from mathutils import Vector

def groom_coat(name, rings, materials, count=560, seed=1947,
               length=(.030,.082), base_width=(.0028,.0068)):
    """rings: (y, center_x, center_z, radius_x, radius_z) sections."""
    if len(rings)<2 or count<1 or not materials:
        raise ValueError("Fur requires profile rings, fibers and material")
    rings=sorted(rings)
    rng=random.Random(seed)
    verts,faces,mids,tip_weights=[],[],[],[]
    ys=[r[0] for r in rings]
    def section(y):
        i=next((i for i in range(len(rings)-1) if ys[i]<=y<=ys[i+1]),
               len(rings)-2)
        a,b=rings[i],rings[i+1]
        t=(y-a[0])/max(1e-5,b[0]-a[0])
        return [a[j]*(1-t)+b[j]*t for j in range(1,5)]
    for _ in range(count):
        y=rng.uniform(ys[0]+.028,ys[-1]-.028)
        cx,cz,rx,rz=section(y)
        # Coat covers the upper body and the sides, not the naked underside.
        theta=rng.uniform(.055,math.pi-.055)
        normal=Vector((math.cos(theta)/max(.02,rx),0,
                       math.sin(theta)/max(.02,rz))).normalized()
        root=Vector((cx+rx*math.cos(theta),y,cz+rz*math.sin(theta)))
        direction=(normal*rng.uniform(.42,.72)+
                   Vector((rng.uniform(-.11,.11),.78,
                           rng.uniform(-.09,.09)))).normalized()
        tangent=direction.cross(Vector((0,0,1)))
        if tangent.length<.08:tangent=direction.cross(Vector((1,0,0)))
        tangent.normalize()
        wing=direction.cross(tangent).normalized()
        reach=rng.uniform(*length)*(.80+.20*max(0,math.sin(theta)))
        width=rng.uniform(*base_width)
        base=root-normal*.006
        middle=base+direction*reach*.46+normal*.004
        tip=base+direction*reach+normal*.014
        start=len(verts)
        for center,radius,stiffness in ((base,width,0.0),
                                         (middle,width*.54,.48)):
            for n in range(3):
                a=math.tau*n/3
                p=center+radius*(tangent*math.cos(a)+wing*math.sin(a))
                verts.append(tuple(p))
                tip_weights.append(stiffness)
        verts.append(tuple(tip))
        tip_weights.append(1.0)
        for n in range(3):
            nxt=(n+1)%3
            faces.append((start+n,start+nxt,start+3+nxt,start+3+n))
        for n in range(3):
            faces.append((start+3+n,start+3+(n+1)%3,start+6))
        tone=rng.random()
        mat=2 if tone>.945 and len(materials)>2 else (
            0 if tone<.20 and len(materials)>1 else min(1,len(materials)-1))
        mids.extend([mat]*6)
    data=bpy.data.meshes.new(name+" geometry")
    data.from_pydata(verts,[],faces)
    data.update()
    for mat in materials:data.materials.append(mat)
    data.polygons.foreach_set("material_index",mids)
    uv=data.uv_layers.new(name="FurRootTip")
    for polygon in data.polygons:
        polygon.use_smooth=True
        for loop in polygon.loop_indices:
            index=data.loops[loop].vertex_index
            uv.data[loop].uv=(tip_weights[index],0.0)
    obj=bpy.data.objects.new(name,data)
    bpy.context.scene.collection.objects.link(obj)
    obj["fur_groom_count"]=count
    obj["fur_groom_seed"]=seed
    return obj
