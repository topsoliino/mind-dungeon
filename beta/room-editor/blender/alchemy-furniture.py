"""Four matching medieval dark-dungeon furniture meshes for Room Atelier.

Executed in build-room-kit.py after materials/camera are configured.
All forms are Blender mesh objects with a shared origin at ground contact.
The four Blender rotations are baked by the calling renderer (not by CSS).
This file only adds models to ALCHEMY_MODELS; it never modifies the game.
"""
import math as _math

_fwood = material('Alchemy | dark weathered oak', '34251e', .88, secondary='75503a', grain=29)
_fedge = material('Alchemy | worn polished edges', '65432d', .74, secondary='966b48', grain=25)
_fdark = material('Alchemy | deep oak crevices', '211914', .91, secondary='463125', grain=29)
_firon = material('Alchemy | scratched black iron', '3a3431', .69, .77, secondary='786a60', grain=29)
_fcopper = material('Alchemy | hammered copper', '8f492a', .37, .80, secondary='c87b49', grain=40)
_fbrass = material('Alchemy | tarnished brass', '89704b', .44, .74, secondary='c8a26b', grain=31)
_fglass = material('Alchemy | smoked glass', '352d2b', .17, .32, secondary='75553c', grain=9)
_fgreen = material('Alchemy | dried herbs', '484c2e', .91, secondary='8e8150', grain=22)
_fpurple = material('Alchemy | dried lavender', '574057', .91, secondary='936f85', grain=24)
_fcloth = material('Alchemy | battered linen', '6f6457', .94, secondary='a28a71', grain=42)
_fstripe = material('Alchemy | faded oxblood stripe', '743e3d', .94, secondary='a15d51', grain=35)
_fleather = material('Alchemy | cracked brown leather', '4a2b21', .86, secondary='78503a', grain=33)
_fwax = material('Alchemy | ivory wax', 'e6c28c', .54)
_flight = material('Alchemy | warm embers', 'f8ac47', .45)
_fstone = material('Alchemy | mortar granite', '585657', .93, secondary='8b8580', grain=25)

# Actual anisotropic procedural PBR microstructure (not a painted 2-D filter).
# Long oak fibres follow the plank axes; scratched steel and woven cloth have
# different roughness/bump patterns. Material nodes survive in the .blend file.
def _microtexture(mat, axis=(1,1,1), frequency=3.0, strength=.12, distance=.045):
    nt=mat.node_tree
    nodes=nt.nodes
    links=nt.links
    bsdf=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord')
    stretch=nodes.new('ShaderNodeVectorMath')
    stretch.operation='MULTIPLY'
    stretch.inputs[1].default_value=axis
    links.new(coord.outputs['Generated'],stretch.inputs[0])
    noise=nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=frequency
    noise.inputs['Detail'].default_value=5
    noise.inputs['Roughness'].default_value=.68
    links.new(stretch.outputs['Vector'],noise.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=strength
    bump.inputs['Distance'].default_value=distance
    links.new(noise.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])

for _wood in (_fwood,_fedge,_fdark,_fleather):
    _microtexture(_wood,(.38,8,2.4),2.9,.26,.075)
for _metal in (_firon,_fcopper,_fbrass):
    _microtexture(_metal,(1.2,1.2,1.2),25,.23,.021)
for _textile in (_fcloth,_fstripe):
    _microtexture(_textile,(7,7,1),11,.19,.035)

def _part(label, xyz, dimensions, mat=_fwood, radius=.009):
    return cube(label, xyz, dimensions, mat, radius)

def _pin(label, xyz, r=.014, mat=_fbrass):
    return cylinder(label, xyz, r, .014, mat, 12)

def _bottle(label, xyz, sc=.1, material_=_fglass):
    x,y,z=xyz
    _body=cylinder(label+' | glass vessel', (x,y,z+sc*.52),sc*.36,sc*.86,material_,18)
    _part(label+' | glass neck',(x,y,z+sc*1.06),(sc*.31,sc*.31,sc*.37),material_,.009)
    cylinder(label+' | cork',(x,y,z+sc*1.28),sc*.165,sc*.19,_fwood,12)

def _rod(label, a, b, r=.013, mat=_firon):
    a,b=Vector(a),Vector(b)
    d=b-a
    mid=(a+b)*.5
    ob=cylinder(label,mid,r,d.length,mat,12)
    ob.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return ob

def _pipe(label, coords, radius=.024, mat=_fcopper):
    crv=bpy.data.curves.new(label+' | sweep','CURVE')
    crv.dimensions='3D';crv.resolution_u=16
    crv.bevel_depth=radius;crv.bevel_resolution=3
    spline=crv.splines.new('BEZIER');spline.bezier_points.add(len(coords)-1)
    for p,co in zip(spline.bezier_points,coords):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(label,crv)
    bpy.context.scene.collection.objects.link(ob)
    crv.materials.append(mat)
    return ob

def _book(x,y,z):
    _part('Leather grimoire | pages',(x,y,z+.031),(.36,.25,.055),_fcloth,.010)
    _part('Leather grimoire | cover',(x,y,z+.066),(.39,.28,.023),_fleather,.009)
    for sx in (-.185,.185):
        _part('Book hammered binding',(x+sx,y,z+.078),(.018,.29,.009),_fbrass,.003)
    for i in range(3):
        _part('Book spine bronze studs',(x-.177,y-.095+i*.095,z+.083),(.016,.023,.014),_fbrass,.003)

def _candle(x,y,z,size=.11):
    cylinder('Candle wax with drips',(x,y,z+size*.65),size*.24,size*1.3,_fwax,18)
    cylinder('Candle iron tray',(x,y,z+.02),size*.37,.03,_firon,20)
    _part('Candle black wick',(x,y,z+size*1.32),(.012,.012,.07),_fdark,.003)
    flame=material('Alchemy | flame ochre', 'ffad43', .23)
    _part('Small amber flame',(x,y,z+size*1.62),(.032,.030,.085),flame,.018)

def _table_base(alchemy=False):
    # 1.85m x 0.95m carved oak workbench, 4 feet and supported lower shelf.
    for x in (-.79,.79):
        for y in (-.355,.355):
            _part('Mortised oak square workbench leg',(x,y,.44),(.14,.14,.86),_fwood,.021)
            _part('Riveted iron foot collar',(x,y,.09),(.154,.154,.16),_firon,.013)
            for off in (-.040,.040):
                _pin('Collar hammered rivet',(x+off,y+.083,.13),.012)
    for y in (-.38,.38):
        _part('Long apron',(0,y,.758),(1.65,.095,.16),_fdark,.017)
        _part('Forged apron strap',(0,y,.692),(1.70,.030,.039),_firon,.005)
        for x in (-.65,-.2,.2,.65):_pin('Apron rivet',(x,y-.05,.71),.012)
    for x in (-.77,.77):
        _part('End apron',(x,0,.77),(.105,.69,.15),_fwood,.013)
    for y in (-.355,.355):
        _part('Lower shelf joists',(0,y,.245),(1.52,.095,.10),_fdark,.012)
    for idx in range(4):
        yy=-.34+idx*.226
        _part('Separate lower oak shelf plank',(0,yy,.25),(1.49,.220,.055),
              _fwood if idx%2 else _fdark,.009)
    for idx in range(5):
        yy=-.4+idx*.20
        _part('Uneven thick oak tabletop board',(0,yy,.925+(idx%2)*.006),
              (1.87,.195,.13),[_fwood,_fedge,_fwood,_fdark,_fwood][idx],.019)
        for x in (-.88,.88):
            _pin('Flush copper-clenched nail',(x,yy,1.001+(idx%2)*.006),.011,_firon)
    # Vertical backboard is characteristic of the prior brewing asset.
    for x in (-.83,.83):
        _part('Rear upright oak pillar',(x,.43,1.28),(.15,.16,.69),_fwood,.019)
        _part('Rear upright iron top cap',(x,.43,1.585),(.168,.18,.11),_firon,.011)
    for i in range(7):
        x=-.7+i*.232
        _part('Scratched vertical backboard',(x,.455,1.25),(.227,.08,.50),
              [_fwood,_fdark,_fwood,_fedge][_math.floor(i)%4],.012)
    _part('Heavy backboard brace',(0,.475,1.48),(1.65,.11,.12),_fdark,.015)
    _rod('Horizontal rack rod',(-.78,.40,1.66),(.78,.40,1.66),.020,_firon)
    for x in (-.63,0,.63):
        _pin('Rack wrought iron stud',(x,.38,1.51),.02,_firon)
    # Folded linen / cloth runner with physically modeled frayed red stripes.
    _part('Rough folded linen',( -.48,-.17,1.017),(.57,.31,.021),_fcloth,.009)
    for x in (-.67,-.61):
        _part('Linen faded red band',(x,-.17,1.033),(.025,.32,.004),_fstripe,.003)
    _book(.48,.12,1.018)
    _candle(-.68,.17,1.02,.12)
    if alchemy:
        # Hammered copper distillation rig on a grate/heater; independent
        # objects so users can open the .blend and edit individual pieces.
        for x in (.11,.58):
            for y in (-.08,.25):
                _part('Alembic forge leg',(x,y,1.092),(.05,.05,.13),_firon,.007)
        _part('Copper still hearth',(.35,.085,1.11),(.53,.39,.17),_firon,.025)
        for x in (.16,.25,.36,.47,.56):
            _part('Glowing ember inside hearth',(x,-.097,1.113),(.037,.02,.055),_flight,.007)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=12,location=(.34,.08,1.34))
        ob=bpy.context.object;ob.name='Hand-hammered copper still belly';ob.scale=(.26,.24,.22)
        ob.data.materials.append(_fcopper)
        cylinder('Copper alembic cap',(.34,.08,1.54),.12,.11,_fcopper,22)
        cylinder('Copper joint collar',(.34,.08,1.61),.085,.037,_fbrass,20)
        for x in (.18,.50):
            _part('Copper forge straps',(x,.08,1.31),(.017,.45,.23),_firon,.006)
        _pipe('Copper swan-neck',( (.34,.08,1.62),(.38,.06,1.78),(.60,.00,1.78),(.70,-.01,1.59)),.028)
        # Copper condensation coil: discrete toroidal turns + vertical spine.
        for z in (1.36,1.40,1.44,1.48,1.52):
            bpy.ops.mesh.primitive_torus_add(major_radius=.10,minor_radius=.018,
                                             location=(.70,-.01,z),major_segments=28,minor_segments=10)
            bpy.context.object.name='Condenser coil copper turn'
            bpy.context.object.data.materials.append(_fcopper)
        _rod('Condenser copper vertical downpipe',(.70,-.01,1.54),(.70,-.01,1.24),.016,_fcopper)
        _bottle('Red potion collector',(.67,-.12,1.019),.20)
        for i,xx in enumerate((-.55,-.35,-.17)):
            _bottle('Herb jar on shelf', (xx,.27,1.016),.17+(.02*(i%2)))
        # Stone mortar and pestle; visible on the mostly open left side.
        cylinder('Stone mortar base',(-.18,-.16,1.06),.096,.10,_fstone,18)
        _rod('Stone pestle',(-.21,-.17,1.09),(-.08,-.12,1.23),.026,_fstone)
        # Hanging plants are meshes rather than flat image cards.
        for cluster,(xx,mat) in enumerate(((-.39,_fgreen),(-.21,_fpurple))):
            _rod('Twine tied herb bundle',(xx,.40,1.64),(xx,.37,1.43),.008,_fcloth)
            for i in range(7):
                ang=i*2.4
                _part('Dry herb leaf',(xx+.045*_math.cos(ang),.35+.035*_math.sin(ang),
                   1.52-i*.015),(.045,.012,.065),mat,.009)

def _chair_base(arm=False):
    w=.36 if arm else .31
    depth=.33
    back_height=1.40 if arm else 1.51
    for x in (-w,w):
        for y in (-depth,depth):
            legheight=back_height if y>0 else (.84 if arm else .72)
            _part('Square carved chair post',(x,y,legheight/2),(.115,.112,legheight),_fwood,.017)
            _part('Forged iron chair shoe',(x,y,.07),(.125,.121,.14),_firon,.010)
            for off in (-.018,.02):_pin('Chair foot nails',(x+off,y-.066,.105),.009,_fbrass)
    seat_w=2*w+.16
    for j in range(4):
        xx=-w+.02+j*(2*w-.04)/3
        _part('Separate thick seat plank',(xx,0,.72),(.20,.75,.12),
              [_fedge,_fwood,_fdark,_fwood][j],.018)
    for x in (-w,w):
        _part('Chair longitudinal stretcher',(x,0,.29),(.072,.70,.076),_fdark,.010)
    for y in (-depth,depth):
        _part('Chair transverse stretcher',(0,y,.33),(2*w,.07,.071),_fdark,.010)
    for x in (-w,w):
        _part('Hand-forged chair leg side shield',(x,-depth,.67),(.135,.029,.15),_firon,.01)
        _pin('Chair shield rivet',(x,-depth-.023,.67),.018,_fbrass)
    # Mechanical wear is modeled on individual parts, not drawn over PNGs.
    # Solid backboard and two forged rails, with matching visible wood grain.
    for j in range(3):
        xx=-w+.11+j*(w-.11)
        _part('Carved upright backrest stave',(xx,depth+.018,1.12),(.19,.072,.59),_fwood,.016)
    _part('Dark high back crest',(0,depth+.02,back_height-.11),(2*w+.12,.11,.17),_fedge,.028)
    _part('Forged iron crest rim',(0,depth-.043,back_height-.15),(2*w+.10,.018,.040),_firon,.007)
    for xx in (-w*.65,0,w*.65):
        _pin('Brass crest rivet',(xx,depth-.054,back_height-.15),.021,_fbrass)
    _part('Chair linen cushion',(0,-.015,.79),(seat_w-.09,.63,.065),_fcloth,.023)
    # Physical brass-inlaid alchemical signet on the outward backrest face.
    # Four slim bars compose the circle's cardinal etching and tiny center boss.
    bpy.ops.mesh.primitive_torus_add(major_radius=.105,minor_radius=.010,
            location=(0,depth+.067,1.17),major_segments=30,minor_segments=8)
    mark=bpy.context.object;mark.name='Embossed alchemist ring sigil'
    mark.rotation_euler.x=_math.pi/2
    mark.data.materials.append(_fbrass)
    _part('Sigil horizontal stroke',(0,depth+.080,1.17),(.19,.014,.010),_fbrass,.003)
    _part('Sigil vertical stroke',(0,depth+.080,1.17),(.014,.014,.19),_fbrass,.003)
    _part('Sigil center stud',(0,depth+.096,1.17),(.035,.017,.035),_fcopper,.005)
    for x in (-.12,-.07):
        _part('Chair faded stripe',(x,-.012,.828),(.025,.59,.007),_fstripe,.004)
    if arm:
        for x in (-w,w):
            _part('Wooden armrest | curved worn',(x,-.06,1.01),(.123,.60,.12),_fedge,.039)
            _part('Forged arm support',(x,-.27,.91),(.125,.05,.09),_firon,.015)
            _pin('Brass arm anchor',(x,-.29,1.01),.018,_fbrass)
        _part('Armchair crest second wooden crossbeam',(0,depth+.02,1.04),(2*w+.12,.10,.14),_fdark,.018)
        for x in (-w,w):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(x,depth,back_height+.035))
            ob=bpy.context.object;ob.name='Chair iron finial';ob.scale=(.08,.08,.08)
            ob.data.materials.append(_fbrass)
    else:
        # High-backed arc illusion from three tiered physical crest pieces.
        _part('Carved gothic middle crest',(0,depth+.02,back_height+.007),(.35,.12,.10),_fedge,.030)
        _part('Carved gothic crown',(0,depth+.02,back_height+.065),(.17,.12,.065),_fbrass,.023)

work=make_model('Alchemy Work Table | independent oak furniture',lambda:_table_base(False))
brew=make_model('Compact Brewing Table | alchemy still + workbench',lambda:_table_base(True))
# 20 percent smaller across ALL three dimensions, preserving perspective
# and floor pivot alignment. Collision footprint is likewise 80 percent.
brew.scale=(.8,.8,.8)
highback=make_model('High-Back Medieval Chair | oak and iron',lambda:_chair_base(False))
armchair=make_model('Medieval Alchemist Armchair | oak and iron',lambda:_chair_base(True))
ALCHEMY_MODELS=[
    ('work-table',work),('brew-table-small',brew),
    ('chair-highback',highback),('chair-arm',armchair)
]
