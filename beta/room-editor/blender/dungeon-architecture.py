"""Editable Blender architecture kit for the standalone Mind Dungeon Room Atelier.

Eight wall-attached medieval architectural ornaments and six floor structures.
Physical Blender meshes (not picture generation), original aged PBR materials,
editable in room-kit.blend and rendered at 0/90/180/270 degrees in Cycles.
One world unit is one Room Atelier metre. Wall root pivots are located at
the horizontal centre of a 1m wall run with +Y pointing INTO the room.
The wall segments themselves are still authored as proper wall elements.
"""
import math as _a_math
import random as _a_random
_a_random.seed(4817)
_a_stone=material('Architecture | damp carved dungeon stone','394244',.96,
                  secondary='68706c',grain=29)
_a_stoneedge=material('Architecture | exposed worn stone edges','5c605b',.94,
                  secondary='83847a',grain=30)
_a_darkstone=material('Architecture | fractured dark granite','1d2427',.98,
                  secondary='444746',grain=37)
_a_mortar=material('Architecture | old powdered mortar','373935',.98,
                  secondary='67665c',grain=30)
_a_rotten=material('Architecture | rotten old blackened timber','292420',.98,
                  secondary='5c4537',grain=34)
_a_woodedge=material('Architecture | grain exposed on freshly broken oak','503c32',.95,
                  secondary='87634b',grain=38)
_a_metal=material('Architecture | rusty black forged iron','202427',.90,.65,
                  secondary='6a5549',grain=37)
_a_bronze=material('Architecture | oxidised copper bronze','53483e',.84,.66,
                  secondary='8c745a',grain=41)
_a_green=material('Architecture | moss-streaked old stone','252e2a',.97,
                  secondary='56604c',grain=33)
for _a_m in (_a_stone,_a_stoneedge,_a_darkstone,_a_rotten,_a_woodedge,_a_metal,_a_bronze,_a_green):
    _microtexture(_a_m,(1.3,4.7,1.5),8,.19,.035)

# Art-direction v2: broad damp soot patches overlaid on high-frequency rock
# grain. Previous materials had only a bright, uniform noisy base colour,
# making carved stone read like plastic or a board-game piece.
def _a_aged_surface(mat,dark=.55,large_scale=3.4):
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    pbsdf=nodes.get('Principled BSDF')
    old=list(pbsdf.inputs['Base Color'].links)
    previous=old[0].from_socket if old else None
    for connection in old: links.remove(connection)
    coord=nodes.new('ShaderNodeTexCoord')
    dirt=nodes.new('ShaderNodeTexNoise')
    dirt.inputs['Scale'].default_value=large_scale
    dirt.inputs['Detail'].default_value=6.5
    dirt.inputs['Roughness'].default_value=.79
    links.new(coord.outputs['Generated'],dirt.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.28
    ramp.color_ramp.elements[0].color=(dark,dark*.97,dark*.93,1)
    ramp.color_ramp.elements[1].position=.73
    ramp.color_ramp.elements[1].color=(.94,.94,.92,1)
    links.new(dirt.outputs['Fac'],ramp.inputs[0])
    mult=nodes.new('ShaderNodeMixRGB')
    mult.blend_type='MULTIPLY'
    mult.inputs[0].default_value=.74
    if previous:
        links.new(previous,mult.inputs[1])
    else:
        mult.inputs[1].default_value=mat.diffuse_color
    links.new(ramp.outputs['Color'],mult.inputs[2])
    links.new(mult.outputs['Color'],pbsdf.inputs['Base Color'])
    # Uneven moisture changes microsurface response, not merely colour.
    rough=nodes.new('ShaderNodeMapRange')
    rough.inputs['From Min'].default_value=.18
    rough.inputs['From Max'].default_value=.78
    rough.inputs['To Min'].default_value=.78
    rough.inputs['To Max'].default_value=.99
    links.new(dirt.outputs['Fac'],rough.inputs['Value'])
    if mat in (_a_stone,_a_stoneedge,_a_darkstone,_a_green):
        links.new(rough.outputs['Result'],pbsdf.inputs['Roughness'])
for _mat in (_a_stone,_a_stoneedge,_a_darkstone,_a_mortar,_a_rotten,
             _a_woodedge,_a_metal,_a_bronze,_a_green):
    _a_aged_surface(_mat,.36 if _mat in (_a_rotten,_a_darkstone) else .53,
                    2.9 if _mat in (_a_stone,_a_rotten,_a_woodedge) else 4.2)

def _a_box(n,p,s,mat=_a_stone,bevel=.013):
    ob=cube(n,p,s,mat,bevel)
    # Chipped stone and time-warped timber must have actual irregular geometry,
    # not a clean cube plus dark paint. Deterministic per object and location
    # guarantees matching renders in all four directions and across builds.
    if min(s)>=.068 and mat in (_a_stone,_a_stoneedge,_a_darkstone,
                               _a_mortar,_a_rotten,_a_woodedge):
        import hashlib
        seed=int.from_bytes(hashlib.sha256((n+'|'+','.join('%.4f'%v for v in p)).encode()).digest()[:8],'big')
        rng=_a_random.Random(seed)
        wood=mat in (_a_rotten,_a_woodedge)
        for vert in ob.data.vertices:
            amount=(.041 if wood else .052)
            # Narrow fragments may crack but do not explode into spikes.
            vert.co.x+=rng.uniform(-1,1)*min(.024,s[0]*amount)
            vert.co.y+=rng.uniform(-1,1)*min(.021,s[1]*amount)
            vert.co.z+=rng.uniform(-1,1)*min(.013,s[2]*(.015 if wood else .032))
        ob.data.update()
        # Unequal nail-holes and splinter grooves on sizeable horizontal boards.
        if wood and max(s[0],s[1])>.80 and s[2]<.19 and 'nail' not in n.lower():
            yy=p[1]-.09*s[1]
            for k in range(2):
                xx=p[0]+(-.23 if k==0 else .17)*s[0]
                l=min(.34,s[0]*.22)
                a=cube('Deep split in rain-damaged timber | '+n,
                       (xx,yy+(k-.5)*s[1]*.16,p[2]+s[2]*.51+.002),
                       (l,.009,.006),_a_darkstone,.002)
                a.rotation_euler.z=.06*(k+.5)
    return ob

def _a_beam(n,start,end,r=.028,mat=_a_metal):
    return _rod(n,start,end,r,mat)

def _a_organic_stone(name,rings,mat=_a_stone,sides=11):
    """Closed uneven faceted stone sculpt: real tapered anatomy / drapery.
    Rings are (centerX,centerY,z,halfWidth,halfDepth) cross-sections. Unlike
    stacking rectangular cubes, this sculpts a continuous eroded silhouette.
    """
    verts=[]
    for ri,(cx,cy,z,rx,ry) in enumerate(rings):
        for i in range(sides):
            a=2*_a_math.pi*i/sides
            irregular=1+.055*_a_math.sin((ri+1)*1.9+i*3.1)
            verts.append((cx+rx*_a_math.cos(a)*irregular,
                          cy+ry*_a_math.sin(a)*(1+.045*_a_math.cos(i*2.13)),
                          z+.009*_a_math.sin(ri*2.7+i*1.4)))
    faces=[tuple(range(sides-1,-1,-1))]
    for k in range(len(rings)-1):
        for i in range(sides):
            n=(i+1)%sides
            faces.append((k*sides+i,k*sides+n,(k+1)*sides+n,(k+1)*sides+i))
    faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    mesh=bpy.data.meshes.new(name+' | weathered sculpted limestone')
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

def _a_bat_wing(name,side):
    """Anatomically connected, broken gothic wing (not rectangular paddles)."""
    s=side
    points=[
        (s*.24,.37,1.50), (s*.46,.38,1.79), (s*.87,.49,2.03),
        (s*1.04,.51,2.01), (s*.93,.49,1.77),
        (s*1.10,.49,1.59), (s*.88,.48,1.44),
        (s*.94,.46,1.23), (s*.67,.45,1.34),
        (s*.53,.40,1.16), (s*.33,.38,1.34)]
    faces=[(0,1,2),(0,2,3),(0,3,4),(0,4,5),(0,5,6),
           (0,6,7),(0,7,8),(0,8,9),(0,9,10)]
    mesh=bpy.data.meshes.new(name+' | actual jagged wing membrane')
    mesh.from_pydata(points,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(_a_darkstone)
    solid=ob.modifiers.new('Chipped carved feather stone thickness','SOLIDIFY')
    solid.thickness=.055
    for tip in (2,5,7,9):
        _a_beam('Cracked gothic wing carved strut '+name,
                (s*.24,.34,1.50),points[tip],.019,_a_stoneedge)
    return ob

def _a_column(n,x,y,h,r=.19,mat=_a_stone):
    _a_box(n+' | carved octagonal foundation',(x,y,.115),(r*2.75,r*2.75,.23),_a_darkstone,.019)
    _a_box(n+' | worn socle',(x,y,.29),(r*2.48,r*2.48,.16),_a_stoneedge,.022)
    c=cylinder(n+' | rough fluted solid column',(x,y,h*.55),
               r,h*.77,mat,10)
    c.rotation_euler.z=.105
    for k in range(8):
        a=k*_a_math.tau/8
        _a_beam(n+' | shallow fluted shaft ridge',
                (x+r*.86*_a_math.cos(a),y+r*.86*_a_math.sin(a),.49),
                (x+r*.86*_a_math.cos(a),y+r*.86*_a_math.sin(a),h-.34),
                .009,_a_stoneedge)
    _a_box(n+' | chamfered antique capital',(x,y,h-.22),
            (r*2.62,r*2.62,.15),_a_stoneedge,.022)
    _a_box(n+' | projecting fractured cap',(x,y,h-.07),
            (r*2.83,r*2.83,.15),_a_stone,.018)
    for i in range(4):
        aa=i*_a_math.tau/4
        _a_box(n+' | projecting carved abacus dentil',
             (x+r*1.25*_a_math.cos(aa),y+r*1.25*_a_math.sin(aa),h-.19),
             (.058,.058,.10),_a_darkstone,.004)

def _a_wall_pilaster():
    # Substantial half-column projecting into the chamber from the wall plane.
    _a_box('Ancient narrow pilaster wall backplate',(0,-.08,1.0),
           (.87,.14,2.0),_a_darkstone,.018)
    _a_column('W1 massive projecting stone wall pier',0,.11,2,.22,_a_stone)
    for z in (.41,1.15,1.72):
        _a_box('Carved old ashlar relief band',(0,.30,z),
               (.55,.10,.075),_a_stoneedge,.010)
    _a_box('Supporting pillar crown joins masonry',(0,-.06,1.96),
           (.90,.37,.095),_a_stone,.009)

def _a_standalone_column():
    _a_column('Freestanding weathered gothic column',0,.20,2,.21,_a_stone)
    _a_box('Asymmetrically worn pillar footing',(0,.20,.055),
           (.65,.65,.11),_a_darkstone)
    for i in range(6):
        a=i*_a_math.tau/6
        _a_box('Crumbled medieval footing chips',(.29*_a_math.cos(a),.20+.28*_a_math.sin(a),.03),
               (.08,.064,.055),_a_mortar,.009)

def _a_wooden_pillar():
    for x in (-.30,.30):
        _a_box('Oak support foot ground plate',(x,.16,.10),(.30,.57,.18),_a_rotten)
    _a_box('One heavy bark-rough oak vertical beam',(0,.15,1.01),
           (.37,.40,2.02),_a_rotten,.027)
    for z in (.22,1.13,1.81):
        _a_box('Hand-forged strap binding',(0,.15,z),
               (.40,.43,.075),_a_metal,.012)
        for x in (-.145,.145):
            _pin('Iron nail through wooden pillar',(x,-.08,z),.027,_a_bronze)
    _a_box('Wide double oak ceiling support',(0,.10,1.97),
           (.68,.51,.16),_a_woodedge,.014)
    _a_beam('Oak diagonal support',(0,.35,1.25),(.29,.35,1.88),.055,_a_rotten)
    for i in range(8):
        y=-.055+.049*i
        _a_beam('Fine carved timber grain',( -.11,y,.33),
                (-.11,y,1.76),.007,_a_woodedge)

def _a_wood_wall_ledge():
    # Upper surface can be treated as a platform in the editor height engine.
    for i in range(6):
        x=-.52+i*.204
        _a_box('Individual old overhanging wooden plank',(x,.49,1.33),
               (.206,.84,.105),_a_rotten if i%3 else _a_woodedge,.011)
    _a_box('Oak joist along wall',(0,.11,1.22),
           (1.19,.20,.17),_a_rotten,.020)
    _a_box('Weathered outer handrail base',(0,.86,1.26),
           (1.22,.07,.105),_a_woodedge,.019)
    for x in (-.48,0,.48):
        _a_beam('Long wall-shelf medieval iron diagonal',
                (x,-.03,.52),(x,.67,1.22),.052,_a_metal)
        _a_box('Heavy bracket embedded in stone',(x,-.045,.60),
               (.16,.12,.29),_a_metal,.018)
        _a_box('Oversized iron joist ferrule',(x,.57,1.25),
               (.15,.19,.10),_a_bronze,.009)
        for y in (.22,.60):
            _pin('Forged exposed shelf fixing nail',(x,y,1.389),.019,_a_metal)
    _a_box('Wall ledge cross brace',(0,.42,.99),(1.15,.12,.12),_a_rotten,.009)

def _a_stone_cornice():
    for z,d,w in ((1.55,.20,1.30),(1.71,.28,1.42),(1.86,.38,1.50),(1.95,.40,1.56)):
        _a_box('Layered gothic ashlar wall cornice',(0,d*.5-.08,z),
               (w,d,.15),_a_stoneedge if z==1.86 else _a_stone,.017)
    for x in (-.61,-.28,.08,.48):
        _a_box('Projecting stone dentil corbel',(x,.12,1.62),
               (.15,.40,.20),_a_darkstone,.019)
        _a_box('Hand-carved corbel outer face',(x,.34,1.63),
               (.116,.07,.14),_a_stoneedge,.012)
    _a_box('Stone backing cast into masonry',(0,-.10,1.69),
           (1.49,.20,.70),_a_darkstone,.013)
    for i in range(9):
        x=-.67+.165*i
        _a_box('Ancient scalloped masonry seam',(x,.30,1.88),
               (.025,.025,.029),_a_darkstone,.005)

def _a_statue_knight():
    _a_box('Wall statuary carved niche lintel',(0,-.15,1.92),
           (1.0,.25,.15),_a_darkstone)
    _a_box('Knight statuette stone base plinth',(0,.18,.37),
           (.78,.59,.23),_a_stoneedge,.032)
    _a_organic_stone('Gothic knight worn tapered chainmail and heavy robe',
          [(0,.16,.51,.28,.24),(0,.16,.73,.26,.22),
           (0,.16,1.0,.19,.18),(0,.16,1.30,.23,.19),
           (0,.16,1.48,.18,.17)],_a_stone)
    _a_organic_stone('Sculpted gothic cuirass over breastplate',
          [(0,-.016,1.05,.19,.16),(0,-.04,1.22,.245,.14),
           (0,-.028,1.43,.20,.135)],_a_stoneedge)
    _a_organic_stone('Heavily eroded narrow bascinet medieval helm',
          [(0,.13,1.47,.13,.13),(0,.13,1.58,.152,.14),
           (0,.13,1.75,.11,.12),(0,.13,1.82,.028,.030)],_a_stoneedge)
    _a_box('Gothic knight cracked nose ridge',(0,-.037,1.62),
           (.041,.076,.175),_a_darkstone,.009)
    _a_box('Stone embossed knight visor slit',(0,-.01,1.65),
           (.17,.026,.032),_a_darkstone,.009)
    for x in (-.23,.23):
        _a_beam('Carved arm and vambrace',(x,.18,1.40),
                (x*.85,.025,.95),.093,_a_stone)
        _a_box('Cape stone fold', (x*.83,.41,.88),(.13,.11,.74),_a_darkstone,.036)
    _a_beam('Knight monument long stone sword',(0,-.17,1.19),(0,-.17,.43),.034,_a_stoneedge)
    _a_box('Stone sword crossguard',(0,-.17,1.11),(.37,.09,.067),_a_darkstone,.012)
    for x in (-.17,.17):
        _a_box('Separate knight bent knee armor',(x,.20,.56),(.17,.23,.35),_a_stone,.033)

def _a_statue_gargoyle():
    _a_box('Gargoyle Gothic thick stone niche base',(0,.14,.62),
           (.87,.61,.23),_a_darkstone)
    _a_organic_stone('Gargoyle hunched weathered sternum and hunched abdomen',
          [(0,.24,.98,.19,.22),(0,.27,1.16,.29,.31),
           (0,.28,1.35,.30,.26),(0,.24,1.57,.20,.17)],_a_stone)
    _a_organic_stone('Gargoyle warped elongated skeletal jaw',
          [(0,-.12,1.38,.14,.16),(0,-.12,1.48,.175,.20),
           (0,-.13,1.62,.145,.145),(0,-.11,1.68,.08,.08)],
           _a_stoneedge)
    _a_beam('Gargoyle elongated carved nose',(0,-.22,1.52),
            (0,-.42,1.41),.072,_a_stoneedge)
    for x in (-.14,.14):
        _sphere('Dark deeply carved eye cavity',(x,-.26,1.55),
                (.064,.045,.049),_a_darkstone,12)
        _a_beam('Broken stone antler horn',(x,-.01,1.63),
                (x*1.8,-.02,1.92),.061,_a_stone)
    for sgn in (-1,1):
        _a_bat_wing('Rain-ruined angular gargoyle membrane',sgn)
        for i in range(3):
            _a_beam('Gothic carved wing ossified finger',
                    (sgn*.31,.37,1.54),
                    (sgn*(.68+.07*i),.49,1.92-i*.25),.020,_a_stoneedge)
        _a_beam('Gargoyle claw hooked back leg',
                (sgn*.23,.09,1.05),
                (sgn*.34,-.08,.73),.070,_a_stone)
    _a_box('Gargoyle heavy wall statue corbel',(0,-.11,.49),
           (.97,.36,.20),_a_stoneedge,.023)

def _a_broken_wall():
    # Broken masonry overlay with physically missing centre section.
    for side in (-1,1):
        x=side*.53
        for k in range(5):
            z=.23+k*.39
            _a_box('Broken wall outer remaining stepped ashlar',(x,.055,z),
                   (.29+.06*(k%2),.29,.32),_a_stone if k%2 else _a_darkstone,.029)
            _a_box('Exposed internal wall rubble fractures',
                   (x-side*.18,.19,z+.055),
                   (.18,.20,.14),_a_stoneedge,.028)
    for x in (-.52,0,.52):
        _a_box('Cracked gothic arch lintel of missing stones',(x,.045,1.89),
               (.42,.30,.27),_a_darkstone,.035)
    for i in range(12):
        a=i*_a_math.tau/12
        r=.24+.19*((i*3)%7)/7
        x=r*_a_math.cos(a)
        y=.18+r*.5*_a_math.sin(a)
        _a_box('Detached broken masonry inner rubble chunk',(x,y,.05+.021*(i%3)),
               (.075,.077,.059),_a_stoneedge if i%3 else _a_darkstone,.011)
    # A physical broken frame; overlay, not destructively deleting a room wall.
    for x in (-.36,.36):
        _a_beam('Deep fracture trace at missing arch edge',
                (x,.28,.71),(x*.78,.25,1.43),.018,_a_mortar)

# Floor architecture v3: exact shared dimensions and visible entry geometry.
# Local positive Y is the front. The renderer uses Z=-90-rot for these six.
def _floor_stairs(w,d,e,stone=True):
    mat=_a_stone if stone else _a_rotten
    edge=_a_stoneedge if stone else _a_woodedge
    # Deck spans y=-d/2..d*.2; steps fill remaining .3*d.
    top=e
    for k in range(3):
        y=d*(.25+k*.1)
        h=e*(2-k)/3
        if h>0:
            _a_box('Real access stair riser',(0,y,h/2),(w*.58,d*.1+.006,h),mat,.012)
            _a_box('Worn stair tread',(0,y,h-.008),(w*.58,d*.1+.008,.016),edge,.006)

def _floor_masonry(w,d,e):
    # Deep irregular ashlar courses, separate capstones, dark recessed joints.
    depth=d*.7;cy=-d*.15
    _a_box('Dark recessed crypt masonry core',(0,cy,e*.42),(w-.065,depth-.045,e*.84),_a_darkstone,.01)
    for row in range(2):
        z=(row+.5)*e*.43
        for i in range(5):
            x=-w*.4+i*w*.2
            _a_box('Individually worn front ashlar',(x,d*.2-.045,z),(w*.193,.12,e*.41),_a_stone if (i+row)%3 else _a_darkstone,.017)
        for side in (-1,1):
            for i in range(4):
                y=-d*.415+i*d*.17
                _a_box('Side masonry course',(side*(w/2-.045),y,z),(.09,d*.163,e*.41),_a_stone,.015)
    for i in range(5):
        for k in range(3):
            x=-w*.4+i*w*.2;y=-d*.383+k*d*.233
            _a_box('Uneven fitted dark flagstone cap',(x,y,e-.033),(w*.194,d*.226,.066),_a_stoneedge if (i+k)%4==0 else _a_stone,.014)
    _floor_stairs(w,d,e,True)

def _floor_timbers(w,d,e,stage=False):
    depth=d*.7;cy=-d*.15
    for x in (-w*.39,w*.39):
        for y in (-d*.37,d*.085):
            _a_box('Rotten load bearing oak post',(x,y,(e-.10)/2),(.12,.12,e-.10),_a_rotten,.013)
            _a_box('Forged iron post shoe',(x,y,.04),(.15,.15,.08),_a_metal,.008)
    for y in (-d*.44,d*.14):
        _a_box('Deep exposed joist',(0,y,e-.14),(w-.04,.12,.15),_a_rotten,.012)
    for i in range(8):
        x=-w*.4375+i*w*.125
        _a_box('Warped individually fitted oak deck plank',(x,cy,e-.041),(w*.12,depth-.012,.082),_a_rotten if i%3 else _a_woodedge,.008)
        for y in (-d*.42,d*.12):
            _pin('Dark iron plank nail',(x,y,e+.001),.010,_a_metal)
    if stage:
        for i in range(6):
            x=-w*.4167+i*w/6
            _a_box('Weathered stage skirt plank',(x,d*.185,e*.36),(w*.159,.055,e*.64),_a_rotten,.009)
    _floor_stairs(w,d,e,False)

def _a_stone_dais():
    _floor_masonry(1.8,1.85,.55)

def _a_sunken_area():
    w,d,e=1.84,1.72,-.55
    # Floor below the actual clipped hole, no floating black top mask.
    for i in range(5):
        for k in range(3):
            _a_box('Damp cut flagstone below ground',(-w*.32+i*w*.16,-d*.34+k*d*.22,e-.035),(w*.154,d*.214,.07),_a_stone if (i+k)%3 else _a_darkstone,.009)
    for side in (-1,1):
        _a_box('Recess retaining masonry',(side*w*.455,0,e*.5),(w*.09,d,e*-1),_a_darkstone,.011)
        _a_box('Chipped stone edge lip',(side*w*.455,0,-.025),(w*.09,d,.05),_a_stoneedge,.008)
    _a_box('Recess rear retaining wall',(0,-d*.46,e*.5),(w,d*.08,-e),_a_darkstone,.012)
    for k in range(3):
        y=d*(.25+k*.1);z=e*(2-k)/3
        _a_box('Visible descending tread',(0,y,z-.045),(w*.58,d*.1+.006,.09),_a_stoneedge,.009)
    for side in (-1,1):
        _a_box('Solid rim beside recess entry',(side*w*.395,d*.35,-.065),(w*.21,d*.3,.13),_a_darkstone,.01)

def _a_walkway():
    _floor_timbers(2.16,1.5,.74)

def _a_wood_stage():
    _floor_timbers(1.76,1.72,.55,True)

def _a_broken_plate():
    # A real wedge: same slope as the walkable height map (back high).
    w,d=1.73,1.45
    verts=[(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0),
           (-w/2,-d/2,.22),(w/2,-d/2,.22),(w/2,d/2,.008),(-w/2,d/2,.008)]
    mesh=bpy.data.meshes.new('Broken flagstone exact slope')
    mesh.from_pydata(verts,[],[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
    mesh.update();ob=bpy.data.objects.new('Fractured sloped stone slab',mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(_a_stone)
    bevel=ob.modifiers.new('Chipped edge','BEVEL');bevel.width=.012;bevel.segments=2
    for i in range(4):
        x=-.55+i*.34
        _a_beam('Deep irregular fracture across sloping stone',(x,-.61,.205),(x+.09,.53,.032),.007,_a_darkstone)

def _a_collapsed_floor():
    w,d=1.75,1.55
    # Open hole |x|<.23*w and |y|<.30*d; solid walkable perimeter.
    for side in (-1,1):
        _a_box('Old exposed perimeter beam',(side*w*.365,0,-.045),(w*.27,d,.09),_a_rotten,.015)
        _a_box('Surviving plank end',(0,side*d*.40,-.045),(w*.46,d*.20,.09),_a_woodedge,.008)
    for i in range(6):
        y=-d*.25+i*d*.10
        for side in (-1,1):
            _a_beam('Jagged broken joist tip',(side*w*.27,y,-.04),(side*w*.20,y+.025,-.12),.023,_a_rotten)
    for side in (-1,1):
        _a_box('Broken underfloor stone rim',(side*w*.46,0,-.23),(w*.07,d,.35),_a_darkstone,.012)
    _a_box('Deep crypt cavity below destroyed floor',(0,0,-.49),(w*.48,d*.64,.04),_a_darkstone,.01)

# Seven requested wall looks plus a second, freestanding-style stone column:
ARCH_WALL_MODELS=[
 ('wall-stone-pilaster',_a_wall_pilaster),
 ('wall-freestanding-column',_a_standalone_column),
 ('wall-wood-pillar',_a_wooden_pillar),
 ('wall-wood-ledge',_a_wood_wall_ledge),
 ('wall-stone-cornice',_a_stone_cornice),
 ('wall-statue-knight',_a_statue_knight),
 ('wall-statue-gargoyle',_a_statue_gargoyle),
 ('wall-broken-masonry',_a_broken_wall)
]
ARCH_FLOOR_MODELS=[
 ('arch-stone-dais',_a_stone_dais),
 ('arch-sunken-floor',_a_sunken_area),
 ('arch-raised-walkway',_a_walkway),
 ('arch-wood-stage',_a_wood_stage),
 ('arch-broken-stone-slab',_a_broken_plate),
 ('arch-collapsed-floor',_a_collapsed_floor)
]
ARCH_MODELS=[]
for _slug,_fn in (*ARCH_WALL_MODELS,*ARCH_FLOOR_MODELS):
    _root=make_model('Dungeon architecture | '+_slug,_fn)
    ARCH_MODELS.append((_slug,_root))

# A separate physically modelled grim weathering pass adds stone fractures,
# soot, carved detail, damp stains and real ruined wood splinters to each root.
# Crucially every additional mesh is parented to its original pivot so all
# 0/90/180/270 rotations and JSON placement remain exactly compatible.
_weather_source=Path(__file__).parent/'architecture-weathering.py'
exec(compile(_weather_source.read_text(),str(_weather_source),'exec'),globals())

