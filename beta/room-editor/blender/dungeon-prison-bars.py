"""High-fidelity real Blender meshes for two prison wall grille variants.

Each model occupies exactly one metre of wall run in X, 0.11 m of thickness
in Y and (1 or 2) metres of Z. Generated without characters or scene floor.
The existing Cycles lights illuminate *real physically modeled* wrought iron,
beveled forging, scratched rivets and rusty clamps. A front-orthographic
alpha render is subsequently projected by Canvas onto the true wall plane;
this keeps every one-metre segment perfectly aligned with stone walls and
requires only one small image for each height (no extra WebGL at runtime).
"""
import math as _pb_math

_pb_forged=material('Prison grille | charcoal-black forged iron', '252527',
                    .76, .82, secondary='53524f', grain=34)
_pb_edge=material('Prison grille | hammered bright iron abraded rims', '605c55',
                  .53, .84, secondary='9a8b7b',grain=29)
_pb_rust=material('Prison grille | orange-brown corroded oxidation', '51372d',
                  .90, .52, secondary='8a5943',grain=26)
_pb_core=material('Prison grille | very dark fractured iron crevices','171719',
                  .94, .67,secondary='403934',grain=34)
_pb_rivet=material('Prison grille | warm dark old nickel iron','817668',
                   .60, .78,secondary='aaa08e',grain=20)
for _pb_mat in (_pb_forged,_pb_edge,_pb_rust,_pb_core,_pb_rivet):
    _microtexture(_pb_mat,(1.35,1.4,3.2),20,.25,.025)

def _pb_cube(name,pos,dims,mat=_pb_forged,bevel=.006):
    return cube(name,pos,dims,mat,bevel)

def _pb_rivet_head(name,x,z,y=-.07,r=.018,mat=_pb_rivet):
    # Axial hand-forged button-head oriented onto the open cage face.
    ob=cylinder(name,(x,y,z),r,.019,mat,12)
    ob.rotation_euler.x=_pb_math.pi/2
    return ob

def _pb_bar(x,z0,z1,index):
    length=z1-z0
    if length<.10:return
    # Slightly asymmetric hammer forged profiles; nothing perfectly smooth.
    r=.025 if index%3 else .029
    body=cylinder('Individual hand-forged iron rod %d'%index,
                  (x,.006,(z0+z1)/2),r,length,_pb_forged,12)
    body.rotation_euler.z=.11*(index%4)
    # Thin irregular highlight ridge is a second physical beveled strip.
    _pb_cube('Bare iron bar seam %d'%index,
             (x-r*.61,-r*.78,(z0+z1)/2),
             (.007,.009,length*.93),_pb_edge,.002)
    # Wrought clamping sleeves on bars at the cross-brace contacts.
    for z in ([.21,z1-.14] if length>.9 else [z0+.16,z1-.12]):
        if z<=z0+.04 or z>=z1-.04:continue
        band=cylinder('Riveted rusty iron collar',(x,.005,z),r+.009,.054,
                      _pb_rust if index%2 else _pb_edge,12)
        _pb_rivet_head('Forged bar collar pin',x,z,-r-.022,.009,_pb_core)

def _pb_segment(height):
    """Genuine mesh geometry, one physically bounded wall tile."""
    h=float(height)
    # Obsidian dark iron corner posts with a broad frontal worn lip.
    for x in (-.465,.465):
        _pb_cube('Square iron keeper column',(x,0,h*.5),(.069,.101,h-.03),
                 _pb_core,.008)
        _pb_cube('Cold-worn upright post front chamfer',
                 (x,-.055,h*.5),(.011,.011,h-.05),_pb_edge,.003)
        for z in (.075,h-.075):
            _pb_cube('Rust-weakened corner forged collar',(x,0,z),
                     (.089,.120,.095),_pb_rust,.009)
            _pb_rivet_head('Corner boss through iron support',x,z,-.072,.024)
        # Visible 3D forged footplate sits flush at the dungeon floor.
        _pb_cube('Square upright grounding shoe',(x,0,.037),
                 (.092,.143,.073),_pb_core,.008)
    rails=[.075,h-.08]
    if h>=1.5:rails.extend([.58,1.47])
    else:rails.append(.46)
    rails=sorted(rails)
    for j,z in enumerate(rails):
        _pb_cube('Hammer-forged horizontal cage crossbeam',(0,0,z),
                 (.986,.092,.071 if j in (0,len(rails)-1) else .047),
                 _pb_core,.007)
        _pb_cube('Bright hand-worn exposed ridge of horizontal beam',
                 (0,-.053,z+.012),(.934,.011,.012),_pb_edge,.003)
        # Irregular rust seams and straps give cinematic age at all angles.
        for x in (-.327,.0,.327):
            _pb_cube('Oxidised lap rivet backing',
                    (x,-.053,z),(.054,.013,.057),
                    _pb_rust if j%2 else _pb_forged,.006)
            _pb_rivet_head('Raised dark steel rivet',x,z,-.076,
                           .019 if j%2 else .017)
    for i in range(7):
        x=-.459+i*.153
        if i in (0,6):continue # edge posts are already real physical columns
        _pb_bar(x,.123,h-.15,i)
        for j,z in enumerate(rails):
            if j==0 or j==len(rails)-1:continue
            # Blackened metal clamps physically wrap the bar and horizontal rail.
            _pb_cube('Forged open-front rail retainer',
                     (x,-.065,z),(.078,.035,.061),_pb_forged,.008)
            _pb_rivet_head('Metal retainer rivet',x,z,-.089,.013)
    # Opposite face iron clamps: visible in editable .blend / alternate lights.
    for x in (-.45,.45):
        for z in rails[1:-1]:
            _pb_cube('Rear riveted structural gusset',(x,.066,z),
                     (.068,.016,.10),_pb_rust,.005)
    if h>=1.5:
        # Decorative old detention chapel knotwork on the upper center rail.
        _pb_cube('Extra keeper-section overlap band',(0,-.072,1.47),
                 (.13,.015,.078),_pb_forged,.007)
        _pb_rivet_head('Central black Gothic cross boss',0,1.47,-.094,.030)
    else:
        # Shorter parapet has a thick, weathered smooth guardrail as head.
        _pb_cube('Half-height grated parapet protective coping',
                (0,0,h-.04),(.986,.126,.075),_pb_forged,.009)
        for x in (-.31,.31):
            _pb_rivet_head('Half-height protective coping iron nail',
                            x,h-.04,-.076,.021)

PB_WALL_MODELS=[]
for _pb_height,_pb_slug in ((2.0,'prison-grille-full'),(1.0,'prison-grille-half')):
    _pb_model=make_model('Dungeon iron bars | %s metres'%_pb_height,
                         lambda height=_pb_height:_pb_segment(height))
    PB_WALL_MODELS.append((_pb_slug,_pb_model,_pb_height))
