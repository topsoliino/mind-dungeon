"""Ten original, low-profile dark-medieval dungeon floor prop meshes.

Blender source only: real meshes and PBR materials, never pre-painted image
cards. Executed from alchemy-furniture.py AFTER torture-chamber-furniture.py,
within the unchanged Cycles / fixed-camera four-direction rendering pipeline.
Each root stays at local floor origin and uses Guardian-relative .45 scaling.
All props can be walked over except large rubble or heavy fallen timbers.
"""
import math as _fc_math
import random as _fc_random

_fc_random.seed(71029)
_fc_limestone=material('Clutter | wet blue-gray fractured limestone','4c4f50',.93,
                       secondary='8a8580',grain=27)
_fc_mortar=material('Clutter | old stone dust and lime mortar','665f57',.98,
                    secondary='978f82',grain=36)
_fc_bone=material('Clutter | ancient yellowed bone','a59980',.89,
                  secondary='d0bca0',grain=31)
_fc_bone_shadow=material('Clutter | hollow black-brown bone cavities','241f1a',.98)
_fc_rug=material('Clutter | worn burgundy woven floor rug','4d292a',.96,
                 secondary='87534d',grain=43)
_fc_rug_trim=material('Clutter | antique faded rug ornament','9d8562',.93,
                      secondary='cab48c',grain=38)
_fc_wet=material('Clutter | cold damp dungeon puddle','263b3f',.17,
                 secondary='52676c',grain=8)
_fc_wet_stain=material('Clutter | wet porous floor margin','282d2b',.77,
                       secondary='464b45',grain=13)
_fc_moss=material('Clutter | dark green moss tufts','283d2e',.97,
                  secondary='637049',grain=25)
_fc_fungus=material('Clutter | pale rot fungi','a49e81',.93,
                    secondary='c8b99a',grain=20)
_fc_root=material('Clutter | moisture-browned creeper roots','4a392b',.94,
                  secondary='836445',grain=30)
_fc_paper=material('Clutter | yellowed handmade parchment','9b8661',.91,
                   secondary='d1bc94',grain=30)
_fc_paper_ink=material('Clutter | faded charcoal manuscript ink','4b3931',.95)
_fc_pottery=material('Clutter | unglazed fired earthenware','70493c',.86,
                     secondary='af775a',grain=29)
_fc_glazed=material('Clutter | dark green fractured bottle glass','2e4740',.32,
                    secondary='6b7b64',grain=19)
_fc_sack=material('Clutter | mold-stained rough burlap','6c6049',.98,
                 secondary='a29576',grain=32)
_fc_sack_dark=material('Clutter | soiled bundle linen','4c4840',.96,
                      secondary='827765',grain=33)
_fc_iron=material('Clutter | rusty dark shackle iron','34302e',.84,.66,
                  secondary='70604d',grain=29)
for _fc_mat in (_fc_limestone,_fc_mortar,_fc_bone,_fc_rug,_fc_rug_trim,
                _fc_moss,_fc_root,_fc_sack,_fc_sack_dark,_fc_pottery,_fc_iron):
    _microtexture(_fc_mat,(2,9,3),7,.19,.027)

def _fc_box(n,pos,size,mat=_fdark,bevel=.008):
    return _part(n,pos,size,mat,bevel)

def _fc_rod(n,a,b,r=.015,mat=_fc_iron):
    return _rod(n,a,b,r,mat)

def _fc_ball(n,pos,scale,mat):
    return _sphere(n,pos,scale,mat,16)

def _fc_disc(n,pos,radius,depth,mat,vertices=18):
    return cylinder(n,pos,radius,depth,mat,vertices)

def _fc_mesh(n,verts,faces,mat,solidify=0):
    mesh=bpy.data.meshes.new(n+' | actual geometry')
    mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(n,mesh);bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    if solidify:
        modifier=ob.modifiers.new('Thin physical worn surface','SOLIDIFY')
        modifier.thickness=solidify
    return ob

def _fc_irregular(n,x,y,radius,z,mat,seed=1,npoints=13):
    rng=_fc_random.Random(seed)
    ring=[]
    for j in range(npoints):
        a=j*_fc_math.tau/npoints
        rr=radius*(.79+.38*rng.random())
        ring.append((x+rr*_fc_math.cos(a),y+rr*_fc_math.sin(a),z+
                     .002*rng.random()))
    verts=[(x,y,z-.002)]+ring
    faces=[(0,1+j,1+(j+1)%npoints) for j in range(npoints)]
    return _fc_mesh(n,verts,faces,mat,.007)

def _fc_ring(n,pos,radius=.075,thick=.012,mat=_fc_iron,rx=0,ry=0):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=thick,
                   major_segments=20,minor_segments=8,location=pos)
    ob=bpy.context.object;ob.name=n
    ob.rotation_euler=(rx,ry,0)
    ob.data.materials.append(mat)
    return ob

def _fc_chain(n,start,step,count=6):
    for i in range(count):
        x=start[0]+step[0]*i
        y=start[1]+step[1]*i
        z=start[2]+.004*(i%2)
        _fc_ring(n+' | bent iron chain link '+str(i),(x,y,z),
                 .058,.011,_fc_iron,rx=.10 if i%2 else .58)

def _fc_rock(n,x,y,z,size,mat=_fc_limestone,seed=1):
    rng=_fc_random.Random(seed)
    verts=[]
    for bottom in (0,1):
        for j in range(7):
            a=_fc_math.tau*j/7
            radial=size*(.72+.45*rng.random())
            verts.append((x+radial*_fc_math.cos(a),
                          y+radial*_fc_math.sin(a)*.75,
                          z+(size*.38 if bottom==0 else size*(1.25+.4*rng.random()))))
    faces=[tuple(range(6,-1,-1)),tuple(range(7,14))]
    faces.extend([(j,(j+1)%7,(j+1)%7+7,j+7) for j in range(7)])
    return _fc_mesh(n,verts,faces,mat)

def _fc_bone_shaft(n,a,b,rad=.034):
    _fc_rod(n+' | long calcified bone shaft',a,b,rad,_fc_bone)
    _fc_ball(n+' | knuckle end',a,(rad*1.5,rad*1.35,rad*1.3),_fc_bone)
    _fc_ball(n+' | opposite joint',b,(rad*1.5,rad*1.35,rad*1.3),_fc_bone)

def _fc_broken_stone_rubble():
    # Genuinely different chipped stone shapes (not a repeated 2D texture).
    for i in range(14):
        angle=i*2.39996
        rad=.17+.54*((i*11)%17)/17
        x=rad*_fc_math.cos(angle);y=.68*rad*_fc_math.sin(angle)
        size=.08+.07*((i*7)%9)/9
        _fc_rock('Jagged collapsed dungeon masonry '+str(i),x,y,.014,
                 size,_fc_limestone if i%3 else _fc_mortar,71029+i)
    for i in range(12):
        a=i*2.62;r=.23+.35*((i*5)%11)/11
        _fc_box('Limestone fallen mortar chip',
                (r*_fc_math.cos(a),r*_fc_math.sin(a),.035),
                (.035,.067,.027),_fc_mortar,.004)
    _fc_rock('Largest loose cracked blocking stone',.13,-.07,.03,.21,_fc_limestone,127)

def _fc_discarded_bones():
    # Two skulls + loose femurs and ribs scattered across the floor.
    for k,(x,y) in enumerate(((-.22,.09),(.46,-.21))):
        _fc_ball('Unoccupied age-darkened human skull', (x,y,.125),
                 (.139,.123,.122),_fc_bone)
        _fc_box('Hollow left eye socket', (x-.060,y-.104,.146),
                (.060,.029,.052),_fc_bone_shadow,.017)
        _fc_box('Hollow right eye socket',(x+.060,y-.104,.146),
                (.060,.029,.052),_fc_bone_shadow,.017)
        _fc_ball('Jaw and weathered cheekbones',(x,y-.05,.052),
                 (.091,.087,.039),_fc_bone)
        for t in range(5):
            _fc_box('Small old skull tooth',(x-.059+t*.029,y-.128,.047),
                    (.014,.015,.022),_fc_bone,.003)
    for i in range(7):
        a=i*2.7
        sx=.55*_fc_math.cos(a);sy=.38*_fc_math.sin(a)
        ex=sx+.31*_fc_math.cos(a+1.3)
        ey=sy+.23*_fc_math.sin(a+1.3)
        _fc_bone_shaft('Scattered dry femur '+str(i),(sx,sy,.045),(ex,ey,.055),
                       .023 if i%3 else .032)
    for i in range(6):
        a=i*_fc_math.pi/5
        _fc_rod('Detached curved rib fragment',
                (-.03+i*.047,.19,.062),
                (-.03+i*.047+.17*_fc_math.sin(a),.38,.036),
                .014,_fc_bone)

def _fc_tattered_rug():
    # Hand-built creased unevenly cut fabric, ragged edges and holes.
    coords=[(-.86,-.46),(-.57,-.49),(-.40,-.41),(-.21,-.52),
            (.24,-.44),(.43,-.46),(.72,-.43),(.86,-.31),
            (.82,-.16),(.90,.05),(.81,.38),(.48,.44),
            (.32,.36),(-.10,.47),(-.34,.41),(-.65,.45),
            (-.83,.21),(-.77,.04),(-.90,-.17)]
    verts=[(x,y,.029+.012*_fc_math.sin(5*x+2*y)) for x,y in coords]
    verts += [(0,0,.032)]
    center=len(verts)-1
    faces=[(center,i,(i+1)%len(coords)) for i in range(len(coords))]
    # Skip two sectors to leave physical ragged holes in the rug.
    faces=[face for j,face in enumerate(faces) if j not in (4,5)]
    _fc_mesh('Tattered oxblood wool rug with ripped edge',verts,faces,_fc_rug,.015)
    for x in (-.70,.70):
        _fc_rod('Faded antique woven border',
                (x,-.30,.050),(x,.27,.050),.014,_fc_rug_trim)
    for y in (-.32,.31):
        _fc_rod('Long oxidised beige carpet trim',(-.67,y,.050),
                (.66,y,.050),.014,_fc_rug_trim)
    for i in range(7):
        x=-.68+i*.21
        _fc_rod('Frayed textile trailing yarn',
                (x,-.45,.03),(x-.012,-.51-.03*(i%3),.012),
                .006,_fc_rug_trim)
    for i in range(3):
        _fc_box('Broken stitched motif of carpet',
                (-.27+i*.24,.06,.057),(.08,.018,.005),_fc_rug_trim,.002)

def _fc_discarded_chains():
    # Three actual interlinked loops, with recognizable handcuffs.
    _fc_chain('Heavy iron shackle chain A',(-.69,-.30,.065),
              (.17,.078,0),8)
    _fc_chain('Tangled chain B',(-.38,.33,.065),
              (.15,-.09,0),7)
    _fc_chain('Tangled chain C',(-.20,-.06,.080),
              (.13,.11,0),6)
    for x,y in ((-.66,-.34),(.65,.24)):
        _fc_ring('Forged floor restraint cuff',(x,y,.071),.108,.025,
                 _fc_iron,rx=.16)
        _fc_box('Cuff riveted iron hinge',(x+.108,y,.08),
                (.057,.048,.033),_fbrass,.006)
    for x,y in ((-.07,-.17),(.39,-.14)):
        _fc_disc('Rusted chain anchor washer',(x,y,.041),
                 .07,.027,_fc_iron,12)
        _pin('Ancient shackle nail',(x,y,.060),.018,_fbrass)

def _fc_rotten_wood():
    # Broken oak boards, splinter wedges and nails. Bulky enough to block.
    poses=[(-.36,-.23,.12,1.38,.17,.13),(.19,.16,.10,1.23,.19,.12),
           (.35,-.30,.085,1.12,.13,.09),(-.13,.31,.065,.94,.16,.07)]
    for i,(x,y,z,wx,dy,h) in enumerate(poses):
        ob=_fc_box('Rotten snapped oak crate timber '+str(i),(x,y,z),
                   (wx,dy,h),_fdark if i%2 else _fwood,.014)
        ob.rotation_euler.z=(-.38,.26,1.03,-.49)[i]
        for j in range(2):
            sx=x+(-.38 if j==0 else .34)
            _fc_box('Worn exposed splinter on timber',
                    (sx,y,z+.061),(.16,.037,.023),_fedge,.004)
    for i in range(5):
        a=i*2.8
        x=.27*_fc_math.cos(a)
        y=.21*_fc_math.sin(a)
        _fc_rock('Splinter-like protruding rotten knot',x,y,.085,.042,
                 _fedge,i+30)
        _fc_rod('Half bent forged old nail',(x,y,.13),
                (x+.045,y+.045,.055),.009,_fc_iron)

def _fc_moss_roots_fungi():
    # No invisible decal: real tiny moss spore clumps, gnarled twisted roots,
    # and recognizable pale mushroom stems/caps in several sizes.
    for i in range(29):
        angle=i*2.39996
        rad=.09+.56*((i*7)%13)/13
        x=rad*_fc_math.cos(angle);y=.70*rad*_fc_math.sin(angle)
        _fc_ball('Moss tuft living geometry',(x,y,.026),
                 (.067,.055,.020),_fc_moss)
    for i in range(9):
        a=i*1.77
        px=-.42+.65*((i*7)%11)/11
        py=.32*_fc_math.sin(a)
        end=(px+.24*_fc_math.cos(a),py+.22*_fc_math.sin(a),.028)
        _fc_rod('Creeping aged tree root',
                (px,py,.035),end,.019,_fc_root)
    for i,(x,y,scale) in enumerate(((-.35,.20,.12),(.25,-.24,.14),
                                    (.45,.20,.085),(-.07,-.15,.105))):
        _fc_rod('Mushroom thin gnarled foot',
                (x,y,.03),(x,y,.03+scale*.8),.025,_fc_fungus)
        _fc_ball('Pale dungeon fungus inverted cap',
                 (x,y,.035+scale),(.08+scale*.3,.075+scale*.2,.036),
                 _fc_fungus)
        _fc_box('Mushroom gills dark underside',(x,y,.035+scale*.76),
                (.075,.065,.008),_fc_root,.003)

def _fc_scrolls_books():
    # A fallen chained book, actual rolled paper tube and loose curled pages.
    _fc_box('Vellum pages thick closed book',(-.32,-.11,.080),
            (.40,.28,.082),_fc_paper,.011)
    _fc_box('Worn black oxhide book cover',(-.32,-.11,.132),
            (.43,.31,.025),_fc_sack_dark,.012)
    for side in (-.52,-.11):
        _fc_box('Dented books bronze spine fitting',(side,-.10,.148),
                (.024,.32,.015),_fbrass,.003)
    for x,y,angle in ((.21,-.15,.46),(.46,.20,-.26)):
        cylinder_obj=_fc_disc('Real cylindrical curled parchment scroll',
                             (x,y,.075),.062,.39,_fc_paper,18)
        cylinder_obj.rotation_euler.x=_fc_math.pi/2
        cylinder_obj.rotation_euler.z=angle
        _fc_ring('Old ribbon scroll tie',(x,y,.065),.064,.009,
                 _fc_rug_trim,rx=_fc_math.pi/2,ry=angle)
    for i in range(4):
        x=-.22+i*.17
        y=.26+.045*(i%2)
        _fc_box('Scattered loose parchment folio',(x,y,.021),
                (.23,.13,.009),_fc_paper,.002)
        for line in range(3):
            _fc_box('Faded ink scribble',(x,y-.035+line*.031,.029),
                    (.10,.004,.002),_fc_paper_ink,.001)

def _fc_damp_puddles():
    # Non-blocking 3D glossy wet material with uneven physically modelled
    # borders: never flat texture cards on floor (actual low thin meshes).
    positions=[(-.28,-.17,.34,80),(.31,.16,.29,44),(.02,.41,.22,65)]
    for i,(x,y,r,seed) in enumerate(positions):
        _fc_irregular('Wide dark damp porous stone fringe',
                      x,y,r*1.28,.013,_fc_wet_stain,seed,20)
        _fc_irregular('Shallow translucent cold standing puddle',
                      x,y,r,.029,_fc_wet,seed+1,20)
        for j in range(3):
            a=(i*5+j)*2.63
            _fc_ball('Subtle individual puddle highlight',
                     (x+r*.5*_fc_math.cos(a),
                      y+r*.4*_fc_math.sin(a),.041),
                     (.036,.013,.0025),_fc_wet_stain)
    for i in range(5):
        a=i*1.44
        _fc_irregular('Tiny dark water stain',
                       .55*_fc_math.cos(a),.43*_fc_math.sin(a),
                       .046,.017,_fc_wet_stain,i+50,10)

def _fc_broken_pottery():
    # Breakaway earthenware fragments: irregular 3D chunks, a standing
    # chipped jug + fallen glass bottle and pottery shards.
    _fc_disc('Broken remaining clay jug bottom',(-.19,-.11,.092),
             .18,.15,_fc_pottery,14)
    _fc_ring('Torn open ceramic jug rim',(-.19,-.11,.175),
             .182,.023,_fc_pottery,rx=.14)
    _fc_ring('Pottery handle remaining loop',(-.37,-.11,.17),
             .072,.024,_fc_pottery,rx=_fc_math.pi/2)
    for i in range(11):
        a=i*2.4
        radius=.29+.30*((i*7)%11)/11
        x=radius*_fc_math.cos(a);y=.65*radius*_fc_math.sin(a)
        ob=_fc_rock('Sharp broken clay bowl shard '+str(i),
                     x,y,.016,.060 if i%3 else .105,
                     _fc_pottery,i+109)
        ob.rotation_euler.z=a
    _fc_disc('Smoked green glass bottle body',(.32,.22,.077),
             .085,.27,_fc_glazed,16).rotation_euler.x=_fc_math.pi/2
    _fc_rod('Cracked glass neck remnant',
            (.32,.10,.09),(.37,-.04,.08),.038,_fc_glazed)
    for i in range(4):
        _fc_ball('Scattered glass sliver',
                  (.32+.11*_fc_math.cos(i*1.5),
                   .18+.17*_fc_math.sin(i*1.5),.028),
                  (.053,.018,.011),_fc_glazed)

def _fc_burlap_and_linen():
    # Nonuniform stuffed sacks, folds, stitched seam, broken fabric patches.
    for i,(x,y,a,sz) in enumerate(((-.30,-.10,-.34,.32),
                                   (.24,.16,.58,.25))):
        ob=_fc_ball('Collapsed moldy grain burlap sack',
                    (x,y,.09),(.42*sz/.32,.29*sz/.32,.10),
                    _fc_sack if i==0 else _fc_sack_dark)
        ob.rotation_euler.z=a
        _fc_rod('Burlap sack folded dark seam',
                (x-.25,y-.02,.158),(x+.22,y+.08,.142),
                .015,_fc_root)
        _fc_ring('Twine tied broken sack mouth',
                 (x+.26,y+.02,.10),.053,.011,_fc_root,rx=.4)
    # Ragged free-form fallen linen patch with wrinkles.
    verts=[(-.60,.34,.030),(-.42,.52,.023),(-.18,.49,.052),
           (.10,.60,.029),(.40,.48,.036),(.55,.31,.022),
           (.22,.23,.063),(-.14,.27,.043)]
    faces=[(0,1,2),(0,2,7),(2,3,4),(2,4,6),(2,6,7),(4,5,6)]
    _fc_mesh('Torn physically draped dirty linen sheet',verts,faces,_fc_sack_dark,.012)
    for i in range(7):
        x=-.45+i*.13
        _fc_rod('Worn loose unravelled burlap fibre',
                (x,.49,.048),(x-.026,.54+(i%2)*.04,.026),
                .004,_fc_sack)

_FLOOR_SCULPTURES=[
 ('floor-rubble','Broken limestone rubble and masonry',_fc_broken_stone_rubble,.45),
 ('floor-bones','Discarded dungeon bones and ancient skulls',_fc_discarded_bones,.45),
 ('floor-rug','Tattered medieval burgundy floor rug',_fc_tattered_rug,.45),
 ('floor-chains','Abandoned rusted chains and shackles',_fc_discarded_chains,.45),
 ('floor-wood','Collapsed rotten oak and broken wood planks',_fc_rotten_wood,.45),
 ('floor-moss','Creeping moss roots and pallid fungi',_fc_moss_roots_fungi,.45),
 ('floor-scrolls','Discarded scrolls and torn medieval books',_fc_scrolls_books,.45),
 ('floor-puddles','Damp medieval dungeon puddles and wet patches',_fc_damp_puddles,.45),
 ('floor-pottery','Broken ceramic jugs pottery and glass',_fc_broken_pottery,.45),
 ('floor-cloth','Old burlap sacks and abandoned linen',_fc_burlap_and_linen,.45)
]
FLOOR_MODELS=[]
for slug,title,sculpt,scale in _FLOOR_SCULPTURES:
    root=make_model(title,sculpt)
    root.scale=(scale,)*3
    FLOOR_MODELS.append((slug,root))
