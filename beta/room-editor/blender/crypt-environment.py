"""Dark crypt furniture, candle/torch fittings and wild crypt vegetation.
Executed inside the existing Blender Cycles room-kit scene. All dimensions
are in room metres, root at ground centre; flames are intentionally runtime FX.
"""
import math as _env_math
import random as _env_random

_env_oak=material('Crypt oak | black wet grain','231a16',.91,secondary='5a402c',grain=24)
_env_edge=material('Crypt oak | chipped endgrain','483326',.86,secondary='76543b',grain=29)
_env_iron=material('Crypt iron | black oxide','242326',.77,.68,secondary='67534a',grain=35)
_env_bone=material('Skull | aged porous ivory','77705c',.88,secondary='c1b495',grain=22)
_env_dark=material('Skull sockets | deep shadow','161514',.98)
_env_wax=material('Wax | dirty beeswax','a58c5c',.72,secondary='d8bc83',grain=19)
_env_wick=material('Carbonised wick','29211b',.96)
_env_moss=material('Crypt moss | olive black','26341b',.97,secondary='52633a',grain=28)
_env_moss2=material('Wet moss | green ochre','3d4823',.91,secondary='818044',grain=34)
_env_soil=material('Wet humus','25231d',.95,secondary='4b4230',grain=32)
_env_stem=material('Fungal stems | stained ivory','7f7560',.87,secondary='b5a48a',grain=26)
_env_capbrown=material('Fungal cap | wet umber','493123',.70,secondary='94704b',grain=24)
_env_capgrey=material('Fungal cap | slate grey','41434a',.78,secondary='88897c',grain=30)
_env_capwhite=material('Fungal cap | pallid ivory','777463',.76,secondary='c1c0aa',grain=28)
_env_capyellow=material('Fungal cap | muted ochre','72502a',.75,secondary='ad884c',grain=26)
_env_petaly=material('Wild flowers | muted yellow','a29043',.88,secondary='c4b66c',grain=14)
_env_petalw=material('Wild flowers | off-white','b0ad91',.86,secondary='d2c9ac',grain=14)
for _m in (_env_oak,_env_edge):
    _microtexture(_m,(.4,8,2),4,.32,.055)
for _m in (_env_iron,_env_bone,_env_wax,_env_moss,_env_moss2,_env_soil):
    _microtexture(_m,(1,1,1),19,.27,.019)

def _env_ball(name,p,s,mat,seg=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=p)
    ob=bpy.context.object;ob.name=name;ob.scale=s;ob.data.materials.append(mat)
    for poly in ob.data.polygons: poly.use_smooth=True
    return ob

def _env_rod(name,a,b,r,mat,verts=10):
    a,b=Vector(a),Vector(b);v=b-a
    ob=cylinder(name,(a+b)*.5,r,v.length,mat,verts)
    ob.rotation_euler=v.to_track_quat('Z','Y').to_euler()
    return ob

def _env_ring(name,p,r,t,mat,vertical=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,location=p,major_radius=r,minor_radius=t)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(mat)
    if vertical:ob.rotation_euler.x=_env_math.pi/2
    return ob

def _env_candle(x,y,z,r,h):
    cylinder('Uneven beeswax candle body',(x,y,z+h*.5),r,h,_env_wax,18)
    _env_ball('Melted wax rim',(x,y,z+h-.006),(r*1.04,r*1.04,.012),_env_wax)
    _env_ball('Burnt wax well',(x,y,z+h+.003),(r*.41,r*.41,.004),_env_dark)
    _env_rod('Charred wick',(x,y,z+h),(x+.004,y,z+h+.025),.006,_env_wick)
    for i in range(5):
        a=i*2.399
        _env_ball('Solidified hanging wax drip',(x+_env_math.cos(a)*r*.92,y+_env_math.sin(a)*r*.92,z+h*.67),(r*.19,r*.19,h*(.18+.045*(i%3))),_env_wax)
    _env_ball('Hardened wax pool',(x,y,z+.004),(r*1.4,r*1.21,.011),_env_wax)

def _env_skull(x,y,z):
    # Anatomical miniature: cranial vault, cheekbones, maxilla, jaw,
    # paired dark orbital recesses with bony rims, nose and separate teeth.
    _env_ball('Human cranium',(x,y,z+.112),(.105,.115,.122),_env_bone,24,16)
    _env_ball('Facial maxilla',(x,y+.071,z+.064),(.081,.063,.065),_env_bone,20,12)
    for s in (-1,1):
        _env_ball('Zygomatic cheekbone',(x+s*.076,y+.063,z+.066),(.033,.043,.027),_env_bone)
        _env_ball('Deep orbital recess',(x+s*.043,y+.112,z+.11),(.033,.014,.036),_env_dark,16,10)
        _env_ball('Orbital brow',(x+s*.043,y+.109,z+.144),(.045,.018,.014),_env_bone)
        _env_rod('Mandible ramus',(x+s*.067,y+.026,z+.025),(x+s*.057,y+.095,z+.015),.017,_env_bone)
    _env_ball('Nasal aperture',(x,y+.125,z+.068),(.015,.01,.025),_env_dark)
    _env_ball('Lower jaw',(x,y+.087,z+.019),(.064,.045,.014),_env_bone)
    for i in range(8):
        dx=(i-3.5)*.014
        for dz in (.038,.021):
            cube('Individual aged tooth',(x+dx,y+.115-abs(dx)*.13,z+dz),(.011,.017,.015),_env_bone,.003)
    _env_rod('Cranial suture',(x-.018,y-.046,z+.225),(x+.014,y+.024,z+.229),.0025,_env_dark,6)

def _env_refinish(root,scale,table=False):
    # Preserve legacy IDs but shrink actual geometry, not only image.
    for ob in list(root.children):
        if ob.type!='MESH':continue
        for i,mat in enumerate(ob.data.materials):
            if mat in (oak,oak_dark,oak_light): ob.data.materials[i]=_env_edge if mat==oak_light else _env_oak
            elif mat in (iron,iron_black,highlight):ob.data.materials[i]=_env_iron
        if 'plank' in ob.name.lower():
            ob.rotation_euler.z+=.008*((len(ob.name)%3)-1)
    if table:
        before=set(bpy.context.scene.objects)
        _env_skull(-.32,.08,.978)
        _env_candle(.32,-.16,.982,.052,.20)
        _env_candle(.50,.08,.982,.046,.13)
        _env_candle(.17,.14,.982,.04,.10)
        for ob in set(bpy.context.scene.objects)-before:
            if ob.type in ('MESH','CURVE'):ob.parent=root;ob.matrix_parent_inverse=root.matrix_world.inverted()
    root.scale=(scale,)*3

_env_refinish(table,.76,True)
_env_refinish(chair,.72)

def _env_torch(kind):
    z=1.22
    if kind==0:
        cube('Hammered rectangular wall plate',(0,-.08,z),(.18,.065,.42),_env_iron,.016)
        _env_rod('Bent forged bracket',(0,-.035,1.17),(0,.15,1.30),.027,_env_iron)
    elif kind==1:
        _env_ring('Circular wrought iron wall escutcheon',(0,-.06,z),.125,.027,_env_iron,True)
        for s in (-1,1):_env_rod('Curled support',(s*.09,-.04,1.14),(0,.19,1.31),.022,_env_iron)
    else:
        cube('Carved pointed stone torch corbel',(0,-.06,1.15),(.24,.13,.39),_env_bone,.03)
        for s in (-1,1):_env_rod('Gothic pointed iron basket rib',(s*.10,.17,1.39),(0,.16,1.16),.018,_env_iron)
    _env_rod('Charred torch shaft',(0,.15,1.12),(0,.15,1.51),.047,_env_oak)
    for h in (1.24,1.36,1.43):_env_ring('Forged retaining band',(0,.15,h),.06,.013,_env_iron)
    _env_ball('Burnt pitch and split torch head',(0,.15,1.51),(.075,.075,.068),_env_wick)
    for s in (-1,1):_env_rod('Split charred wood',(s*.035,.14,1.46),(s*.046,.16,1.57),.014,_env_wick)

def _env_single():
    _env_ring('Worn iron candle dish',(0,0,.025),.093,.015,_env_iron)
    _env_candle(0,0,.035,.053,.23)
def _env_cluster():
    for x,y,h in ((-.09,.045,.22),(.09,.04,.13),(0,-.08,.30)):
        _env_candle(x,y,.012,.047,h)
def _env_candelabra():
    cylinder('Heavy candelabrum foot',(0,0,.04),.135,.08,_env_iron,18)
    _env_rod('Forged central stem',(0,0,.08),(0,0,.51),.027,_env_iron)
    for x,h in ((-.19,.43),(0,.59),(.19,.43)):
        _env_rod('Iron candle arm',(0,0,.25),(x,0,h-.055),.019,_env_iron)
        _env_ring('Candle drip cup',(x,0,h-.012),.069,.012,_env_iron)
        _env_candle(x,0,h,.043,.14)

def _env_fungi(mat,seed,large=False):
    rng=_env_random.Random(seed)
    for i in range(7 if large else 10):
        a=rng.random()*6.283;d=rng.uniform(.025,.20);x,y=_env_math.cos(a)*d,_env_math.sin(a)*d
        h=rng.uniform(.10,.24) if large else rng.uniform(.045,.135);r=h*rng.uniform(.31,.49)
        _env_rod('Bent fungus stipe',(x,y,0),(x+.016,y,h*.83),r*.19,_env_stem)
        _env_ball('Organic mushroom cap',(x+.016,y,h*.86),(r,r*.89,r*.42),mat,16,10)
        _env_ball('Pale gill underside',(x+.016,y,h*.73),(r*.83,r*.73,r*.12),_env_stem)
        for k in range(5):
            t=k*1.256
            _env_ball('Tiny mottled cap scale',(x+.016+_env_math.cos(t)*r*.48,y+_env_math.sin(t)*r*.42,h*.86+r*.34),(r*.07,r*.06,r*.025),_env_stem,8,5)

def _env_vegetation(seed,flower=None,thick=False):
    rng=_env_random.Random(seed)
    for i in range(46 if thick else 28):
        a=rng.random()*6.283;d=rng.random()**.65*.29
        x,y=_env_math.cos(a)*d,_env_math.sin(a)*d*.72
        rr=rng.uniform(.035,.077)
        _env_ball('Irregular moss tuft',(x,y,.008),(rr,rr*.83,rr*.31),_env_moss2 if i%4==0 else _env_moss,8,5)
    if flower:
        for i in range(6):
            x=rng.uniform(-.22,.22);y=rng.uniform(-.14,.14);h=rng.uniform(.08,.18)
            _env_rod('Wild flower stem',(x,y,0),(x+.016,y,h),.006,_env_moss2,6)
            for k in range(5):
                a=k*6.283/5
                ob=_env_ball('Small worn petal',(x+.016+.019*_env_math.cos(a),y+.019*_env_math.sin(a),h),(.020,.010,.006),flower,10,6)
                ob.rotation_euler.z=a
            _env_ball('Wildflower centre',(x+.016,y,h+.004),(.011,.011,.008),_env_capyellow,10,6)

ENV_MODELS=[]
for _slug,_fn in (
 ('light-torch-iron',lambda:_env_torch(0)),('light-torch-ring',lambda:_env_torch(1)),('light-torch-gothic',lambda:_env_torch(2)),
 ('light-candle-single',_env_single),('light-candle-cluster',_env_cluster),('light-candle-candelabra',_env_candelabra),
 ('deco-fungi-grey',lambda:_env_fungi(_env_capgrey,21)),('deco-fungi-brown',lambda:_env_fungi(_env_capbrown,22,True)),
 ('deco-fungi-white',lambda:_env_fungi(_env_capwhite,23)),('deco-fungi-ochre',lambda:_env_fungi(_env_capyellow,24)),
 ('deco-moss-wet',lambda:_env_vegetation(41)),('deco-moss-thick',lambda:_env_vegetation(42,thick=True)),
 ('deco-moss-yellow',lambda:_env_vegetation(43,_env_petaly)),('deco-moss-white',lambda:_env_vegetation(44,_env_petalw))):
    ENV_MODELS.append((_slug,make_model('Crypt environment | '+_slug,_fn)))
