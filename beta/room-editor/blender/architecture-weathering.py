"""Gothic ruin weathering layer — real extra meshes, not postprocess sprites.

Executed ONLY after the fourteen architecture roots have been constructed.
Corrosion, natural stone spall, rain erosion, shattered joists, cut grooves,
tapered masonry fragments and physical grime live in the editable .blend file.
Supports deterministic 0/90/180/270 renders without changing hitboxes.
"""
import math as _dw_math
import random as _dw_random
_dw_random.seed(319703)

_dw_soot=material('Ruins | almost black weathered soot','151a1d',.97,
                  secondary='303338',grain=36)
_dw_crack=material('Ruins | deep exposed ashlar fissures','11171a',.98,
                   secondary='353a38',grain=29)
_dw_spall=material('Ruins | newly cracked dull grey stone core','616763',.96,
                   secondary='8a877b',grain=31)
_dw_lichen=material('Ruins | damp dark green mineral crust','1f2a28',.99,
                    secondary='465148',grain=25)
_dw_darkgrain=material('Ruins | dark rotted longitudinal oak splits','171512',.98,
                       secondary='3d2d26',grain=39)
_dw_splinter=material('Ruins | aged raw timber splinter','47392f',.97,
                      secondary='6b5141',grain=29)
_dw_oxidation=material('Ruins | caked black brown oxidation','3d2a24',.98,
                       secondary='654c40',grain=29)
for _mat in (_dw_soot,_dw_crack,_dw_spall,_dw_lichen,_dw_darkgrain,
             _dw_splinter,_dw_oxidation):
    _microtexture(_mat,(.8,5.5,2.0),12,.28,.022)

def _dw_rough_fragment(n,loc,sx,sy,sz,mat=_a_darkstone,seed=1):
    """Irregular closed six-sided shard, not a perfect cube."""
    rng=_dw_random.Random(seed)
    x,y,z=loc
    vertices=[]
    for floor in (0,1):
        for k in range(7):
            a=k*_dw_math.tau/7
            factor=.74+.40*rng.random()
            vertices.append((x+sx*_dw_math.cos(a)*factor,
                             y+sy*_dw_math.sin(a)*factor,
                             z+(floor*sz)+(rng.random()-.5)*sz*.13))
    polys=[tuple(range(6,-1,-1)),tuple(range(7,14))]
    polys.extend((k,(k+1)%7,(k+1)%7+7,k+7) for k in range(7))
    mesh=bpy.data.meshes.new(n+' | fractured actual stone shape')
    mesh.from_pydata(vertices,[],polys);mesh.update()
    obj=bpy.data.objects.new(n,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def _dw_mark(n,coords,mat=_dw_crack,thickness=.008):
    for i,(a,b) in enumerate(zip(coords,coords[1:])):
        _a_beam(n+' | irregular cut '+str(i),a,b,thickness,mat)

def _dw_rain_stain(n,loc,w=.055,length=.35):
    x,y,z=loc
    _a_box(n+' | cold damp stone streak',loc,(w,.013,length),_dw_soot,.002)
    _dw_rough_fragment(n+' | deposited lichen',(x,y,z-length*.5),
                       w*1.4,.015,.012,_dw_lichen,47)

def _dw_ashlar_damage():
    for k in range(8):
        x=[-.24,.23,.12,-.07,.30,-.29,.19,-.19][k]
        z=.42+k*.177
        _dw_mark('Ancient fractured capital and pillar shaft',
          [(x,.323,z),(x+.029,.337,z+.082),
           (x-.013,.341,z+.16)],_dw_crack,.009)
    for i in range(7):
        a=i*2.39
        x=.26*_dw_math.cos(a);y=.11+.24*_dw_math.sin(a)
        _dw_rough_fragment('Lost flaked sandstone around pilaster foot',
                           (x,y,.028),.055,.044,.07,_dw_spall if i%3 else _a_darkstone,i+9)
    for x in (-.31,.23):
        _dw_rain_stain('Centuries of cold damp along masonry wall',
                       (x,.31,1.35),.06,.47)

def _dw_freestanding():
    for a in (0,.8,1.9,3.0):
        x=.205*_dw_math.cos(a);y=.20+.21*_dw_math.sin(a)
        _dw_mark('Column quarry fractures',
                 [(x,y,.55),(x+.016,y-.009,.87),
                  (x-.018,y+.011,1.01),(x+.004,y,1.23)],
                 _dw_crack,.009)
    for i in range(10):
        a=i*2.3
        _dw_rough_fragment('Asymmetrical exposed freestone chips',
          (.34*_dw_math.cos(a),.2+.32*_dw_math.sin(a),.017),
          .058,.047,.045,_dw_spall if i%4==0 else _a_darkstone,i+90)
    _dw_rain_stain('Damp verdigris on pillar',(.13,-.015,1.3),.057,.4)

def _dw_wood_pillar():
    for i in range(11):
        x=-.14+.026*i
        z=.32+.07*(i%3)
        _dw_mark('Long rotten fibrous oak grain',
         [(x,-.078,z),(x+.009,-.083,z+.31),
          (x-.006,-.087,z+.75),(x+.009,-.09,z+.92)],
         _dw_darkgrain,.004 if i%2 else .007)
    for z in (.28,1.11,1.79):
        _dw_rough_fragment('Corroded iron plate raised rust',(.06,-.081,z),
            .03,.014,.024,_dw_oxidation,int(z*91))
    for i in range(6):
        x=-.13+i*.055
        _a_beam('Sharp exposed rotten timber splinter at joist end',
                (x,.30,1.93),(x-.03,.36,2.02+.045*(i%3)),
                .010,_dw_splinter)

def _dw_wall_ledge():
    for i in range(6):
        x=-.52+i*.204
        z=1.383
        _dw_mark('Widened dry rot split across projecting oak boards',
             [(x-.062,.22,z),(x-.038,.39,z+.002),
              (x-.051,.63,z-.001),(x-.023,.80,z+.003)],
             _dw_darkgrain,.008 if i%2 else .012)
    for i in range(10):
        x=-.54+i*.118
        _a_beam('Dangerous hanging snapped wall ledge edge splinter',
                (x,.855,1.28),(x+.025,.91,1.21-.034*(i%4)),
                .008,_dw_splinter)
    for x in (-.48,0,.48):
        _a_box('Rust bleeding below corroded anchor bolts',
               (x,.70,1.17),(.07,.017,.12),_dw_oxidation,.007)

def _dw_cornice():
    for i in range(7):
        x=-.61+i*.205
        _dw_mark('Gothic cornice capstone eroded seam',
            [(x,.29,2.024),(x+.044,.30,1.977),
             (x+.026,.33,1.915)],_dw_crack,.010)
    for x in (-.57,-.13,.38):
        _dw_rain_stain('Soot leaking down from overhanging cornice',
                       (x,.23,1.66),.07,.25)
    for i in range(6):
        x=-.65+.257*i
        _dw_rough_fragment('Clipped Gothic stone dentil chips',
              (x,.30,1.48),.035,.05,.064,_dw_spall if i%2 else _a_darkstone,107+i)

def _dw_knight():
    # Sculpture should read as one aged monumental warrior, not a blocky toy.
    for side in (-1,1):
        x=side*.19
        for k in range(4):
            z=.67+k*.21
            _dw_mark('Chiseled chainmail cloak fold in stone',
                [(x,.002,z),(x+side*.023,-.016,z+.08),
                 (x+side*.011,-.025,z+.19)],
                _dw_crack,.010)
        _a_box('Gothic stone angular armored shoulder pauldron',
              (side*.22,.14,1.36),(.20,.26,.14),_a_darkstone,.026)
        _a_box('Low eroded iron-age boot stone carving',
              (side*.14,.064,.51),(.17,.28,.17),_a_stone,.019)
    _dw_mark('Broken knight cuirass breastplate scratch',
        [(-.11,-.185,1.32),(-.03,-.191,1.20),
         (.04,-.187,1.18),(.12,-.16,1.06)],_dw_crack,.011)
    # Narrow visor undercut: face is hidden in realistic dark cavity.
    _a_box('Sculpted dark visor eye shadow', (0,-.032,1.668),
           (.18,.023,.027),_dw_crack,.006)
    for i in range(5):
        _dw_rough_fragment('Chipped knight plinth pieces',
            ((i-2)*.11,-.26,.376),.038,.042,.022,
            _dw_spall if i%3==0 else _a_darkstone,120+i)

def _dw_gargoyle():
    # Cold cut cavities, fanged stone maw and individually carved talons.
    for s in (-1,1):
        _dw_mark('Wing membrane age fracture',
           [(s*.47,.473,1.52),(s*.68,.484,1.65),
            (s*.90,.489,1.72)],_dw_crack,.014)
        for i in range(3):
            x=s*(.22+i*.067)
            _a_beam('Sharp carved gargoyle talon gripping pedestal',
                (x,-.12,.79),(x+s*.035,-.23,.68),
                .018,_a_stoneedge)
        _a_box('Wet black Gargoyle eye cavity',
               (s*.13,-.268,1.56),(.080,.019,.048),_dw_crack,.010)
    for i in range(4):
        _a_beam('Tipped weathered stone fang',
                (-.08+i*.055,-.37,1.36),
                (-.08+i*.055,-.405,1.29),.017,_a_stoneedge)
    _dw_mark('Fracture across right Gothic bat wing',
             [(.42,.48,1.66),(.65,.49,1.81),(.85,.50,1.76)],
             _dw_crack,.012)
    for x in (-.4,.33):
        _dw_rain_stain('Bleak moisture on grotesque gargoyle plinth',
                       (x,.42,.63),.037,.10)

def _dw_broken_wall():
    for s in (-1,1):
        x=s*.52
        for k in range(4):
            z=.37+k*.37
            _dw_rough_fragment('Deep exposed jagged interrupted stone layers',
             (x-s*.22,.31,z),.095,.13,.08,_dw_spall if k%3 else _a_darkstone,88+k+int(s*4))
            _dw_mark('Broken arch jagged internal fissure',
              [(x-s*.12,.35,z-.14),(x-s*.19,.34,z+.03),
               (x-s*.09,.37,z+.16)],_dw_crack,.011)
    for i in range(12):
        a=2.3*i
        r=.21+.34*(i%5)/5
        _dw_rough_fragment('Shattered stone grit at breach base',
            (r*_dw_math.cos(a),.33+.36*r*_dw_math.sin(a),.020),
            .045,.053,.035,_a_darkstone if i%2 else _dw_spall,i+206)
    _a_box('Black depth into exposed abandoned passage',
           (0,-.04,1.01),(.28,.055,1.18),_dw_soot,.014)

def _dw_dais():
    for k in range(13):
        x=-.77+k*.12
        _dw_mark('Weather-etched slate platform fissure',
           [(x,-.35,.564),(x+.034,-.04,.565),
            (x-.021,.30,.565)],_dw_crack,.008 if k%3 else .012)
    for i in range(9):
        x=-.78+i*.19
        _dw_rough_fragment('Crumbled old elevated dais coping',
         (x,.56,.47),.047,.063,.043,
         _a_darkstone if i%3 else _dw_spall,180+i)
    for x in (-.75,.75):
        _dw_rain_stain('Damp stone crypt dais side', (x,.57,.3),.037,.23)

def _dw_sunken():
    for x in (-.88,.88):
        for i in range(7):
            y=-.62+i*.215
            _dw_rain_stain('Oozing groundwater stains from sunken chamber',
                          (x,y,-.27),.038,.34)
    for i in range(12):
        angle=i*2.39
        x=.68*_dw_math.cos(angle);y=.51*_dw_math.sin(angle)
        _dw_rough_fragment('Hewn crypt depression fallen stone chips',
            (x,y,-.48),.044,.042,.05,_a_darkstone if i%2 else _dw_spall,287+i)
    _a_box('Soot-black scummed drainage pool on crypt floor',
           (0,-.19,-.47),(.42,.38,.011),_dw_lichen,.01)

def _dw_walkway():
    for i in range(10):
        x=-1.03+i*.229
        y=.04+.03*(i%3)
        _dw_mark('Rain rotted uneven gangway plank fissure',
           [(x-.048,-.23,.749),(x-.038,y,.749),
            (x-.055,.31,.751)],_dw_darkgrain,.011)
        for f in (-.30,.29):
            _pin('Black old structural nail on warped gangway plank',
                 (x,f,.749),.010,_a_metal)
    for i in range(6):
        x=-.92+i*.36
        _a_beam('Hanging rotted timber fibres along exposed catwalk',
                (x,-.45,.59),(x+.06,-.48,.49-.045*(i%3)),
                .010,_dw_splinter)
    for x in (-.90,.90):
        _a_box('Wet black decay under oak walkway post',
               (x,-.36,.17),(.12,.065,.24),_dw_oxidation,.012)

def _dw_stage():
    for i in range(8):
        y=-.54+i*.153
        _dw_mark('Endgrain and black dry rot in old execution platform',
          [(-.69,y,.548),(-.41,y+.015,.548),
           (-.18,y-.009,.550)],_dw_darkgrain,.011)
        _dw_mark('Open warped platform board fissure',
          [(.03,y,.544),(.30,y-.022,.547),
           (.66,y+.008,.545)],_dw_darkgrain,.008)
    for k in range(12):
        x=-.75+k*.135
        _a_beam('Ragged broken outer stage timber fibres',
                (x,.55,.31),(x+.008,.62,.23-.026*(k%4)),
                .009,_dw_splinter)
    for x in (-.76,.76):
        _a_box('Dungeon stage iron brace corroded underboard',
               (x,.48,.32),(.063,.06,.31),_a_metal,.012)

def _dw_broken_slab():
    # Wide, branched cracked flagstone — the structural stone remains intact
    # enough to walk over; engraved fractures are actually raised geometry.
    for i in range(5):
        sx=-.63+i*.29
        _dw_mark('Branching jagged stone plate deep fracture',
          [(sx,-.49,.28),(sx+.034,-.31,.267),
           (sx-.08,-.14,.274),(sx+.02,.10,.246),
           (sx-.08,.37,.22)],_dw_crack,.013)
    for i in range(8):
        a=i*2.43
        x=.60*_dw_math.cos(a);y=.47*_dw_math.sin(a)
        _dw_rough_fragment('Snapped loose slab stone edge and debris',
             (x,y,.044),.06,.069,.09,_a_darkstone if i%3 else _dw_spall,i+389)
    _a_box('Under slab wedge where ancient flagstone has sunk',
           (.42,.28,.08),(.24,.37,.105),_dw_soot,.02)

def _dw_collapsed():
    for i in range(15):
        a=i*2.4
        x=.68*_dw_math.cos(a);y=.58*_dw_math.sin(a)
        if abs(x)<.35 and abs(y)<.38:continue
        _a_beam('Interlocking protruding rotten torn wooden floor splinters',
                (x,y,.14),(x+.11*_dw_math.sin(a),
                         y+.09*_dw_math.cos(a),-.03-.06*(i%4)),
                .013,_dw_splinter)
    for i in range(7):
        x=-.69+i*.22
        _dw_rough_fragment('Dry crumbled mortar fallen between split flooring',
             (x,.50,.021),.038,.036,.028,_a_darkstone,i+401)
    for i in range(6):
        y=-.45+i*.17
        _dw_mark('Full black underfloor torn joist fissure',
           [(-.71,y,.206),(-.54,y+.028,.213),
            (-.33,y-.012,.2)],_dw_darkgrain,.010)
    _a_box('Eroded dark cavity beyond collapsed intermediate storey',
           (0,0,-.49),(1.16,1.0,.06),_dw_soot,.009)

_ARCH_WEAR_PROFILES={
 'wall-stone-pilaster':_dw_ashlar_damage,
 'wall-freestanding-column':_dw_freestanding,
 'wall-wood-pillar':_dw_wood_pillar,
 'wall-wood-ledge':_dw_wall_ledge,
 'wall-stone-cornice':_dw_cornice,
 'wall-statue-knight':_dw_knight,
 'wall-statue-gargoyle':_dw_gargoyle,
 'wall-broken-masonry':_dw_broken_wall,
 'arch-stone-dais':_dw_dais,
 'arch-sunken-floor':_dw_sunken,
 'arch-raised-walkway':_dw_walkway,
 'arch-wood-stage':_dw_stage,
 'arch-broken-stone-slab':_dw_broken_slab,
 'arch-collapsed-floor':_dw_collapsed
}

for slug,pivot in ARCH_MODELS:
    sculpt=_ARCH_WEAR_PROFILES[slug]
    seen=set(bpy.context.scene.objects)
    sculpt()
    for ob in list(bpy.context.scene.objects):
        if ob not in seen and ob.type in ('MESH','CURVE'):
            ob.parent=pivot
            ob.matrix_parent_inverse=pivot.matrix_world.inverted()
