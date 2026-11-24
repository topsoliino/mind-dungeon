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
    _a_box('Gothic robed knight heavy sculpted torso',(0,.20,.93),
           (.40,.34,.84),_a_stone,.09)
    _a_box('Angular stone cuirass breastplate',(0,-.026,1.24),
           (.52,.13,.36),_a_stoneedge,.07)
    _a_box('Knight statue stone helm and visor',(0,.18,1.65),
           (.26,.28,.36),_a_stoneedge,.045)
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
    _a_box('Gargoyle crouched stone torso',(0,.29,1.23),
           (.50,.57,.55),_a_stone,.16)
    _a_box('Gargoyle beak-like demon face',(0,-.068,1.48),
           (.35,.38,.34),_a_stoneedge,.055)
    _a_beam('Gargoyle elongated carved nose',(0,-.22,1.52),
            (0,-.42,1.41),.072,_a_stoneedge)
    for x in (-.14,.14):
        _sphere('Dark deeply carved eye cavity',(x,-.26,1.55),
                (.064,.045,.049),_a_darkstone,12)
        _a_beam('Broken stone antler horn',(x,-.01,1.63),
                (x*1.8,-.02,1.92),.061,_a_stone)
    for sgn in (-1,1):
        ob=_a_box('Gargoyle jagged spread masonry wing',
                  (sgn*.52,.42,1.41),(.65,.17,.72),_a_darkstone,.035)
        ob.rotation_euler.y=sgn*.37
        for i in range(3):
            _a_beam('Gothic carved feather ridge',
                    (sgn*.30,.33,1.61-i*.11),
                    (sgn*.76,.32,1.83-i*.22),.022,_a_stoneedge)
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

def _a_stone_dais():
    _a_box('Massive square crypt raised podium foundation',(0,0,.21),
           (1.79,1.30,.42),_a_darkstone,.034)
    _a_box('Worn split-stone elevated platform top',(0,-.07,.48),
           (1.76,1.18,.12),_a_stone,.020)
    for i in range(5):
        x=-.72+i*.36
        _a_box('Separate fitted old podium capstone',(x,-.07,.55),
               (.34,1.06,.027),_a_stoneedge if i%3 else _a_stone,.007)
    # Explicit walk-on steps at front (south, local positive Y).
    for k,(y,h,d) in enumerate(((.77,.16,.34),(.60,.31,.30))):
        _a_box('Stone steps for podium climb %d'%k,(0,y,h/2),
               (1.10,d,h),_a_stoneedge,.018)
    for x in (-.79,.79):
        _a_box('Gothic stone dais vertical edge band',(x,0,.42),
               (.09,1.29,.17),_a_stoneedge,.009)

def _a_sunken_area():
    # Depression is physically modeled DOWN from the normal floor. The editor
    # draws a cutout mask and uses -0.55m as its true walkable height.
    _a_box('Lowered dungeon floor below normal zero',(0,0,-.55),
           (1.73,1.40,.10),_a_stone,.018)
    for i in range(5):
        x=-.65+i*.33
        _a_box('Sunken room cracked bottom stone tiling',(x,0,-.489),
               (.31,1.28,.022),_a_darkstone if i%2 else _a_stone,.008)
    for x in (-.86,.86):
        _a_box('Sunken chamber enclosing rough cliff wall',(x,0,-.25),
               (.105,1.50,.52),_a_darkstone,.019)
        _a_box('Worn dungeon pit upper stone lip',(x,0,.020),
               (.17,1.52,.075),_a_stoneedge)
    _a_box('Far edge fractured sunken floor wall',(0,-.68,-.25),
           (1.76,.10,.51),_a_darkstone,.012)
    # Shallow sandstone exit staircase across near edge, -0.55 -> 0 m.
    for i in range(4):
        y=.50+i*.16
        h=-.55+(i+1)*.132
        _a_box('Short descending stone stair tread',
               (0,y,h-.03),(.92,.166,.10),_a_stoneedge,.009)
    _a_box('Chipped floor height zero leading frame',(0,.81,0),
           (1.82,.13,.07),_a_stoneedge,.018)

def _a_walkway():
    # Tall 0.65m boardwalk, joists, steps and guard rails.
    for x in (-.88,.88):
        for y in (-.36,.36):
            _a_box('Timber raised dungeon walkway stout leg',(x,y,.33),
                   (.16,.15,.66),_a_rotten,.021)
            _a_box('Old iron support shoe',(x,y,.075),(.18,.18,.15),_a_metal)
    for i in range(10):
        x=-1.03+i*.229
        _a_box('Individual walkable plank board of raised gangway',
               (x,0,.69),(.222,.89,.103),_a_woodedge if i%3 else _a_rotten,.009)
    for y in (-.40,.40):
        _a_box('Underdeck wooden longitudinal joist',(0,y,.55),
               (2.12,.13,.13),_a_rotten)
    for x in (-.9,0,.9):
        _a_box('Walkway iron bound crossbeam',(x,0,.54),
               (.12,.89,.095),_a_metal)
    for k,y in enumerate((.63,.84,1.04)):
        h=(k+1)*.195
        _a_box('Walkway short climb stair step',(0,y,h/2),
               (.71,.25,h),_a_rotten,.012)
        _a_box('Walking step worn timber tread',(0,y,h+.017),
               (.76,.25,.037),_a_woodedge,.009)
    for y in (-.48,):
        for x in (-.94,.94):
            _a_box('Low wood protective gangway railing post',(x,y,1.06),
                   (.088,.09,.74),_a_rotten,.008)
        _a_box('Gangway forged guardrail',(0,y,1.42),
               (2.03,.08,.08),_a_metal)

def _a_wood_stage():
    for x in (-.72,.72):
        for y in (-.46,.46):
            _a_box('Old dungeon stage corner framing pillar',
                   (x,y,.25),(.16,.16,.49),_a_rotten)
            _a_box('Old stage iron footing',(x,y,.08),
                   (.18,.18,.15),_a_metal)
    for i in range(8):
        y=-.54+i*.153
        _a_box('Scraped theatrical timber stage top board',
               (0,y,.49), (1.70,.150,.097),
               _a_rotten if i%3 else _a_woodedge,.009)
    for x in (-.77,.77):
        _a_box('Exposed stage perimeter framing',(x,0,.36),
               (.09,1.09,.17),_a_rotten)
    _a_box('Raised old dungeon wooden stage front face',(0,.54,.29),
           (1.64,.08,.41),_a_rotten,.014)
    for k,y in enumerate((.84,.65)):
        h=.14 if k==0 else .32
        _a_box('Dungeon stage short accessible front step',
               (0,y,h/2),(.90,.25,h),_a_woodedge,.014)
    for i in range(8):
        x=-.71+i*.20
        _pin('Ancient stage nail',(x,.51,.547),.012,_a_metal)

def _a_broken_plate():
    # Walkable sloped slab with dangerous uneven corners, true bent slab
    # silhouette and support rubble. The ramp height map is 0 -> 0.24m.
    ob=_a_box('Tilted broken granite stone floor flag',
              (0,0,.16),(1.65,1.39,.14),_a_stone,.037)
    ob.rotation_euler.x=.19
    ob.rotation_euler.y=-.11
    for i in range(9):
        a=i*_a_math.tau/9
        x=.69*_a_math.cos(a);y=.52*_a_math.sin(a)
        _a_box('Broken flagstone perimeter rubble chip',
               (x,y,.06),(.12,.14,.11),_a_darkstone if i%3 else _a_stoneedge,.014)
    for j in range(6):
        a=j*.74
        _a_beam('Surface damaged flagstone crack',(-.46+.17*j,-.33,.24),
                (-.33+.15*j,.29,.16),.008,_a_darkstone)

def _a_collapsed_floor():
    # Hole is not fake solid ground: a cutout + limited intact walkway strip.
    # Existing ground under the sprite is visually darkened by editor cutout.
    for x in (-.77,.77):
        _a_box('Broken between-floor timber rim',(x,0,.10),
               (.20,1.54,.19),_a_rotten,.029)
    for y in (-.67,.67):
        _a_box('Broken timber rim foot',(0,y,.09),
               (1.66,.18,.18),_a_rotten,.018)
    for k in range(4):
        y=-.55+.31*k
        if k==2:continue
        ob=_a_box('Surviving floor joist across hole',
                 (-.29,y,.125),(.95,.145,.13),_a_rotten,.013)
        ob.rotation_euler.z=.08*(k-1)
    for k in range(5):
        x=-.72+k*.34
        if k==2:continue
        ob=_a_box('Partially collapsed angular planked section',
                 (x,.46,.084),(.30,.50,.11),
                 _a_rotten if k%2 else _a_woodedge,.013)
        ob.rotation_euler.x=.12*(k-2)
    for k in range(4):
        a=(k+.5)*_a_math.pi/5
        _a_beam('Broken diagonal splinter protruding over void',
                (-.29,-.46+.23*k,.08),
                (.22,.2+.11*k,-.24),.038,_a_woodedge)
    _a_box('Deep dark underside of collapsed chamber',(0,0,-.36),
           (1.22,1.05,.09),_a_darkstone,.013)

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
