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


# Geometrically distinct furniture, not reskins of the original prison set.
# Each object is assembled from separately editable physical mesh parts.
def _sphere(label, xyz, xyz_scale, mat, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=xyz)
    obj=bpy.context.object
    obj.name=label
    obj.scale=xyz_scale
    obj.data.materials.append(mat)
    return obj

def _band(label, xyz, size, mat=_firon):
    return _part(label,xyz,size,mat,.008)

def _braced_legs(width=.77, depth=.36, height=.91, thickness=.16):
    for x in (-width,width):
        for y in (-depth,depth):
            _part('Heavy axe-hewn oak leg',(x,y,height/2),
                (thickness,thickness,height),_fwood,.026)
            _part('Massive riveted iron leg shoe',(x,y,.092),
                (thickness+.035,thickness+.037,.18),_firon,.015)
            for z in (.062,.132):
                _pin('Hammered leg rivet',(x,y-.105,z),.017,_fbrass)
    for y in (-depth,depth):
        _part('Mortised long apron',(0,y,.76),(width*2+.11,.102,.16),_fdark,.016)
        _band('Forged apron lower edge',(0,y-.064,.695),(width*2+.12,.019,.031))
        for x in (-.6,-.24,.23,.6):
            _pin('Apron iron nail',(x,y-.073,.705),.015,_fbrass)
    for x in (-width,width):
        _part('Substantial short apron',(x,0,.765),(.095,depth*2,.15),_fdark,.012)
        _part('Diagonal underbracing',(x,0,.55),(.08,depth*1.9,.065),_fwood,.009)
    for y in (-depth,depth):
        _part('Lower oak stretcher',(0,y,.23),(width*2,.090,.08),_fdark,.013)
    for i in range(4):
        y=-depth+.06+i*(depth*2-.12)/3
        _part('Lower shelf hand-hewn boards',(0,y,.255),
            (width*2-.11,.21,.048),_fwood if i%2 else _fdark,.008)

def _thick_top(width=1.89, depth=1.02, level=.91):
    # Five independent irregular planks; not one flat primitive slab.
    for i in range(5):
        y=-depth*.40+i*depth*.20
        z=level+.004*(i%3)
        _part('Worn oak tabletop slab %d'%i,(0,y,z),
              (width,depth*.198,.127),
              [_fwood,_fwood,_fedge,_fdark,_fwood][i],.022)
        for x in (-width*.46,width*.46):
            _pin('Wrought iron hand-driven nail',(x,y,z+.068),.011,_firon)
    for x in (-width*.44,width*.44):
        for i in range(2):
            y=-depth*.28+i*depth*.56
            _part('Scratched raised knot in grain',(x,y,level+.069),
                   (.093,.013,.003),_fdark,.002)

def _striped_runner(x,y,z):
    _part('Rough worn linen runner',(x,y,z),(.56,.35,.025),_fcloth,.012)
    for xx in (-.20,-.13):
        _part('Burgundy woven runner stripe',(x+xx,y,z+.014),(.031,.33,.005),_fstripe,.002)
    _part('Folded rough linen lip',(x,y-.163,z-.038),(.56,.027,.095),_fcloth,.006)

def _high_rail(left=-.82,right=.82,rear=.45,z=1.71):
    _rod('Continuous black iron hanging rail',(left,rear,z),(right,rear,z),.020,_firon)
    for x in (-.57,0,.57):
        _sphere('Rusted iron hanging ring',(x,rear,z),(.034,.034,.034),_firon,12)

def _wood_backboard(left=-.80,right=.80,rear=.47,base=.99,top=1.62):
    # Separate silhouette: raised workshop screen with stepped left gable,
    # hand-sawn individual planks and broad forged top rail.
    _part('Workshop left pierced timber post',(left,rear,(base+top)/2),
          (.15,.17,top-base),_fwood,.019)
    _part('Workshop right pierced timber post',(right,rear,(base+top)/2),
          (.15,.17,top-base),_fwood,.019)
    for i in range(7):
        x=left+.125+(right-left-.25)*i/6
        height=top-base-.10+(.05 if i%3==0 else 0)
        _part('Hand-sawn vertical alchemist panel',(x,rear,base+height/2),
              (.195,.073,height),[_fwood,_fdark,_fedge,_fwood][i%4],.010)
        _part('Deep vertical seam',(x+.103,rear-.043,base+height/2),
              (.009,.010,height*.80),_fdark,.001)
    _part('Upper planked cap rail',(0,rear,top-.07),(right-left+.17,.14,.12),_fdark,.019)
    for x in (-.73,.73):
        _part('Decorative iron rail socket',(x,rear,top-.07),(.08,.168,.10),_firon,.011)
    _high_rail(left,right,rear,top+.08)

def _workbench_v2():
    # Tall heavy writing/repair workbench, strongly different from the small
    # original prison table. No brewing copper machinery on this independent prop.
    _braced_legs(.80,.365,.92,.17)
    _thick_top(1.95,1.02,.935)
    _wood_backboard(-.84,.84,.48,1.02,1.69)
    # Thick side shelf / distinctive stepped upper-left workshop casework.
    for z in (1.22,1.49):
        _part('Upper left hutch shelf',(-.46,.29,z),(.67,.27,.055),_fwood,.009)
        _band('Hutch shelf front forged lip',(-.46,.135,z+.004),(.69,.025,.031))
    _part('Stepped high left workshop gable',(-.75,.46,1.65),(.26,.19,.30),_fedge,.028)
    for z in (1.17,1.47):
        _pin('Gable plate iron boss',(-.75,.344,z),.025,_fbrass)
    _book(.47,-.12,1.003)
    _striped_runner(-.49,-.19,1.008)
    _candle(-.69,.08,1.004,.13)
    _rod('Wall rack forged hooks',(.28,.40,1.80),(.69,.40,1.80),.013,_firon)
    for x in (.36,.48,.61):
        _rod('Drop forged tool hook',(x,.37,1.80),(x,.37,1.70),.012,_firon)
    # Wood grain grooves, shallow gouges and oxidised metal on the top rim.
    for i in range(9):
        x=-.58+i*.14
        y=-.03+.17*_math.sin(i*3.1)
        _part('Scraped oak grain incision',(x,y,1.009),(.09,.006,.003),
              _fdark,.001)
    for x in (-.88,.88):
        for y in (-.34,.35):
            _part('Dark forged corner protector',(x,y,1.003),(.14,.15,.016),
                  _firon,.006)
            _pin('Iron corner rivet',(x,y,1.023),.018,_fbrass)

def _wooden_barrel(x,y,z=.27,scale=1):
    # A rounded multi-stave cask on its side below the alchemist worktop.
    _sphere('Bulging wooden oak cask',(x,y,z+.16*scale),
            (.23*scale,.17*scale,.22*scale),_fwood,20)
    for i in (-.1,.1):
        _band('Curved cask black hoop',(x+i*scale,y,z+.16*scale),
              (.031*scale,.35*scale,.37*scale),_firon)

def _alembic_v2():
    # Large silhouette-critical copper retort, not a little generic jar.
    # Almost half the bench is an iron stove, condenser and cooling coil.
    x=.31;y=-.02
    for xx in (.04,.54):
        for yy in (-.22,.19):
            _part('Blacksmith wrought forge stand',(xx,yy,1.105),
                  (.055,.055,.19),_firon,.009)
    _part('Blackened square copper furnace',(x,y,1.12),(.58,.46,.22),_firon,.024)
    _part('Open arched hearth vent',(x,-.25,1.11),(.30,.019,.12),_fdark,.016)
    for j in range(6):
        xx=.13+j*.07
        _part('Orange glowing hot embers',(xx,-.268,1.115),(.028,.012,.052),
              _flight,.006)
    _sphere('Large hammer-finished copper alembic belly',(x,y,1.39),
            (.270,.245,.260),_fcopper,40)
    cylinder('Copper still bottom ring',(x,y,1.24),.258,.050,_fcopper,32)
    cylinder('Alembic pressed copper lid',(x,y,1.61),.168,.069,_fcopper,28)
    cylinder('Bell-shaped alembic funnel neck',(x,y,1.695),.075,.12,_fcopper,24)
    for side in (-.23,.23):
        _band('Alembic bolted forged holding strap',(x+side,y,1.35),
              (.031,.52,.23),_firon)
        for yy in (-.14,.14):
            _pin('Alembic retaining rivet',(x+side,yy,1.44),.013,_fbrass)
    _pipe('Tall copper swan neck from the retort',[
        (x,y,1.75),(.39,-.01,1.91),(.59,-.02,1.88),
        (.76,-.08,1.72),(.76,-.08,1.63)],.029,_fcopper)
    # Clearly recognisable spiral condenser, unlike the earlier tiny coil.
    _rod('Coil dark forged stand',(.70,-.05,1.04),(.70,-.05,1.60),.028,_firon)
    for i in range(6):
        z=1.31+i*.064
        bpy.ops.mesh.primitive_torus_add(major_radius=.118,
                     minor_radius=.019,major_segments=30,minor_segments=10,
                     location=(.70,-.05,z))
        coil=bpy.context.object
        coil.name='Copper condenser winding %d'%i
        coil.data.materials.append(_fcopper)
    _pipe('Condenser return outlet',[(.70,-.05,1.30),(.70,-.17,1.25),
                  (.66,-.22,1.19)],.019,_fcopper)
    _bottle('Medicinal red tincture collection flask',(.67,-.24,1.015),.23)

def _brew_station_v2():
    # Separately constructed station. Giant copper still on the RIGHT,
    # high stepped herb shelving on the LEFT, tall rear drying rail.
    _braced_legs(.77,.35,.92,.16)
    _thick_top(1.87,1.02,.93)
    for x in (-.79,.79):
        _part('Raised apothecary back posts',(x,.44,1.38),
            (.16,.16,.81),_fwood,.022)
        _part('Dented wrought iron post cap',(x,.44,1.745),
            (.18,.18,.105),_firon,.011)
    # Open railing allows the large copper silhouette to remain visible.
    _part('Raised alchemical back beam',(0,.46,1.68),(1.66,.15,.15),_fdark,.015)
    _high_rail(-.76,.76,.38,1.82)
    # Asymmetric left-hand apothecary shelves (recognisable frontal structure).
    for z in (1.23,1.47):
        _part('Apothecary left wooden shelf',(-.46,.32,z),
              (.68,.34,.057),_fwood,.016)
        _band('Shelving forged edge',(-.45,.139,z),(.68,.026,.034))
    for x in (-.73,-.17):
        _part('Alchemy narrow shelf support',(x,.40,1.39),
              (.065,.07,.54),_fedge,.007)
    _part('High left carved apothecary wing',(-.77,.40,1.59),
          (.19,.21,.35),_fdark,.020)
    for x,sc in ((-.63,.13),(-.46,.145),(-.27,.12)):
        _bottle('Amber alchemy ingredient bottle',(x,.20,1.23),sc)
    for x in (-.67,-.42,-.20):
        _pin('Apothecary shelf nail',(x,.133,1.23),.013,_fbrass)
    _alembic_v2()
    _striped_runner(-.55,-.25,1.008)
    _candle(-.69,-.10,1.01,.145)
    _candle(-.48,-.22,1.008,.10)
    cylinder('Carved granite mortar bowl',(-.20,-.18,1.08),.13,.115,_fstone,20)
    _rod('Stone pestle arm',(-.21,-.19,1.09),(-.07,-.23,1.26),.034,_fstone)
    _book(-.32,.13,1.005)
    # High hanging herbs make this immediately identifiable as a brew table.
    for i,(xx,mat) in enumerate(((-.48,_fgreen),(-.22,_fpurple),(.04,_fgreen))):
        _rod('Dry herbs twine', (xx,.39,1.80),(xx,.38,1.62),.011,_fcloth)
        for k in range(8):
            t=k*2.37
            xx2=xx+(.065+(.02 if k%2 else 0))*_math.cos(t)
            yy2=.39+.044*_math.sin(t)
            z=1.71-k*.023
            _sphere('Torn botanist leaf',(xx2,yy2,z),
                    (.034,.014,.062),mat,10)
    _wooden_barrel(.41,.02,.28)
    for x in (-.45,-.22):
        _bottle('Lower shelf flask',(x,.08,.28),.17)
    _part('Linen herb-sack on low shelf',(-.53,-.10,.36),
          (.28,.23,.18),_fcloth,.04)

def _gothic_back(width=.39,rear=.325,base=.89,top=1.79):
    # One actual pointed-arch mesh (rather than three cubes pretending to arch).
    outline=[(-width,base),(width,base),
             (width,top-.27),(.26,top-.09),(0,top),
             (-.26,top-.09),(-width,top-.27)]
    verts=[(x,rear-.046,z) for x,z in outline]+[
        (x,rear+.047,z) for x,z in outline]
    n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new('Seven-sided pointed cathedral chair panel')
    mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new('Physical pointed Gothic oak back',mesh)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(_fdark)
    bevel=ob.modifiers.new('Soft hand-carved Gothic corners','BEVEL')
    bevel.width=.014;bevel.segments=3
    ob.modifiers.new('Weighted wooden panel normals','WEIGHTED_NORMAL')
    for x in (-width,width):
        _part('Thick gothic outer stanchions',(x,rear,top*.5),
            (.12,.14,top),_fwood,.018)
        _part('Rusted Gothic spine foot',(x,rear,.07),
            (.14,.16,.14),_firon,.011)
    # Medieval pointed cap arches and inset iron straps.
    _rod('Left Gothic silhouette iron arc',(-width,rear-.063,top-.28),
         (0,rear-.063,top+.010),.022,_firon)
    _rod('Right Gothic silhouette iron arc',(width,rear-.063,top-.28),
         (0,rear-.063,top+.010),.022,_firon)
    _band('Gothic horizontal iron transverse crest',(0,rear-.070,top-.34),
          (width*1.84,.025,.063))
    for x in (-.22,0,.22):
        _pin('Cathedral wrought iron crest bolt',(x,rear-.092,top-.34),.023,_fbrass)

def _chair_seat(width=.34,depth=.32):
    for x in (-width,width):
        for y in (-depth,depth):
            _part('Hand-scarred oak chair leg',(x,y,.385),
                  (.13,.13,.77),_fwood,.020)
            _band('Solid cold iron chair foot',(x,y,.075),(.14,.14,.148))
    for y in (-depth,depth):
        _part('Seat under rail',(0,y,.53),(width*2+.06,.08,.14),
              _fdark,.013)
    for x in (-width,width):
        _part('Raised stretchers',(x,0,.29),(.07,depth*2+.04,.10),
              _fedge,.011)
    for i in range(4):
        x=-width+.10+i*(width*2-.2)/3
        _part('Chair seat plank no.%d'%i,(x,0,.745),
              (.21,depth*2+.09,.105),
              [_fwood,_fedge,_fwood,_fdark][i],.014)

def _heraldic_sigils(y,z,r=.14):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.016,
              major_segments=32,minor_segments=10,location=(0,y,z))
    mark=bpy.context.object
    mark.name='Forged brass sigil with physical torus ring'
    mark.rotation_euler.x=_math.pi/2
    mark.data.materials.append(_fbrass)
    _rod('Carved diagonal alchemical mark one',(-r*.70,y+.007,z-r*.70),
         (r*.70,y+.007,z+r*.70),.013,_fbrass)
    _rod('Carved diagonal alchemical mark two',(r*.70,y+.007,z-r*.70),
         (-r*.70,y+.007,z+r*.70),.013,_fbrass)
    _sphere('Medallion brass center',(0,y+.02,z),(.034,.016,.034),_fcopper)

def _high_chair_v2():
    # Narrow cathedral-backed study chair with pointed gothic arch.
    _chair_seat(.31,.30)
    _gothic_back(.34,.315,.84,1.80)
    _part('Full linen seat cushion',(0,-.04,.81),(.59,.56,.055),_fcloth,.025)
    for x in (-.13,-.08):
        _part('Faded striping across high chair cushion',(x,-.04,.843),
              (.026,.55,.007),_fstripe,.002)
    # Signet must face the camera, not be buried against the back panel.
    _heraldic_sigils(.385,1.36,.155)
    for x in (-.34,.34):
        _band('Tall spine forged back bracket',(x,.392,1.35),
              (.14,.022,.17))
        for z in (1.31,1.39):
            _pin('Gothic spine black rivet',(x,.407,z),.013,_fbrass)
    _band('Footboard rear wrought iron binding',(0,.333,.97),
          (.72,.022,.067))

def _arm_chair_v2():
    # A shorter, wider, far more massive 3-D armchair with visible arms,
    # turned metal finials and a straight raised alchemical back.
    _chair_seat(.37,.345)
    for x in (-.375,.375):
        _part('Thick alchemist chair back pillar',(x,.34,1.20),
              (.15,.16,.70),_fwood,.022)
        _band('Back pillar wrought iron collar',(x,.34,1.47),
              (.169,.17,.13))
        _sphere('Large beaten brass ball finial',(x,.34,1.57),
                (.105,.105,.105),_fbrass,20)
    for i in range(5):
        x=-.28+i*.14
        _part('Deep vertical armchair backboard plank',(x,.355,1.27),
              (.145,.075,.42),[_fwood,_fdark,_fedge,_fwood,_fdark][i],.009)
    _part('Strong horizontal upper armchair crest',(0,.345,1.49),
          (.88,.16,.15),_fdark,.028)
    _band('Distinct upper black forge crest rim',(0,.258,1.48),
          (.87,.026,.064))
    _part('Wider dark-red leather seat pad',(0,-.015,.82),
          (.70,.62,.077),_fleather,.032)
    # Front hanging burlap cushion fringe and well worn armrests.
    _part('Frayed beige cloth over right chair arm',(.373,-.17,1.10),
          (.155,.25,.030),_fcloth,.012)
    for x in (-.37,.37):
        _part('Broad smoothed timber armrest',(x,-.10,1.08),
              (.18,.73,.16),_fedge,.045)
        _part('Sculpted diagonal arm supporter',(x,-.27,.90),
              (.11,.086,.30),_fdark,.019)
        _band('Cold iron armrest end sleeve',(x,-.426,1.08),
              (.18,.10,.17))
        _pin('Visible iron armrest bolt',(x,-.482,1.08),.028,_fbrass)
    _heraldic_sigils(.407,1.28,.132)
    for x in (-.40,.40):
        for y in (-.35,.35):
            _pin('Hammered chair shoe rivet',(x,y-.078,.08),.011,_fbrass)

work=make_model('Alchemy Work Table | raised medieval hutch and timber joinery',_workbench_v2)
brew=make_model('Compact Brewing Table | copper alembic and herb apothecary',_brew_station_v2)
# 20 percent smaller across ALL three dimensions, preserving perspective
# and floor pivot alignment. Collision footprint is likewise 80 percent.
brew.scale=(.8,.8,.8)
highback=make_model('High-Back Gothic Chair | pointed cathedral back',_high_chair_v2)
armchair=make_model('Alchemist Armchair | leather seat, brass finials and iron arms',_arm_chair_v2)
ALCHEMY_MODELS=[
    ('work-table',work),('brew-table-small',brew),
    ('chair-highback',highback),('chair-arm',armchair)
]
