"""Ten sculpted, unoccupied medieval dungeon props for the Room Atelier.

Executed after alchemy-furniture.py's material and primitive helpers, in the
same real Blender/Cycles scene. All meshes/curves parent to floor-centred
model pivots via make_model(). No external images, flat sprite impostors or
changes to live game code. Physical materials stay editable in room-kit.blend.
"""
import math as _m

_tc_aged_iron=material('Torture chamber | pitted black iron', '262726', .85, .69,
                        secondary='625d54',grain=38)
_tc_gritty_stone=material('Torture chamber | damp lichen granite', '424345', .97,
                         secondary='77746c',grain=17)
_tc_dirty_linen=material('Torture chamber | heavy discoloured sackcloth',
                         '716555',.96,secondary='a29378',grain=29)
_tc_red_leather=material('Torture chamber | old auburn leather', '432820', .92,
                         secondary='6f4233',grain=22)
_tc_ember=material('Torture chamber | glowing coal', 'ff7f2e', .50,
                   secondary='f7b454',grain=21)
_tc_ash=material('Torture chamber | spent ash', '3b3933', .96,
                 secondary='696158',grain=37)
_tc_water=material('Torture chamber | dark still water', '26363d', .17,
                   secondary='5b7d82',grain=14)
for _mat in (_tc_aged_iron,_tc_gritty_stone,_tc_dirty_linen,_tc_red_leather,_tc_ash):
    _microtexture(_mat,(2.1,5.3,2.4),6.4,.22,.035)

def _tc_box(n,p,d,m=_fdark,r=.013):
    return _part(n,p,d,m,r)

def _tc_beam(n,a,b,r=.024,m=_tc_aged_iron):
    return _rod(n,a,b,r,m)

def _tc_ball(n,p,scale,mat=_tc_aged_iron):
    return _sphere(n,p,scale,mat,16)

def _tc_ring(n,p,r=.085,thickness=.014,mat=_tc_aged_iron,vertical=True):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thickness,
             major_segments=24,minor_segments=8,location=p)
    ob=bpy.context.object;ob.name=n
    if vertical:ob.rotation_euler.x=_m.pi/2
    ob.data.materials.append(mat)
    return ob

def _tc_chain(n,a,b,links=7,size=.052):
    """Genuine interlocking curved steel links, not texture-mapped linework."""
    a,b=Vector(a),Vector(b)
    delta=b-a
    for i in range(links):
        t=(i+.5)/links
        p=a+delta*t
        ob=_tc_ring(n+' | hand-forged link '+str(i),p,size,.010,_tc_aged_iron)
        ob.rotation_euler=(0,0,0) if i%2 else (_m.pi/2,0,0)

def _tc_rivet(n,x,y,z):
    _pin(n,(x,y,z),.016,_fbrass)

def _tc_post(n,x,y,height,thickness=.115,mat=_fwood):
    _tc_box(n,(x,y,height/2),(thickness,thickness,height),mat,.014)
    _tc_box(n+' | rusted foot shoe',(x,y,.07),
            (thickness+.025,thickness+.025,.14),_tc_aged_iron,.009)

def _tc_stone_block(n,p,d):
    _tc_box(n,p,d,_tc_gritty_stone,.027)

def _tc_hanging_cage():
    # Hanging man-sized *iron* cage on a free-standing gallows, not the
    # ground-mounted transport cage below. Distinct raised silhouette.
    for x in (-.72,.72):
        _tc_post('Standing oak gallows post',x,.28,2.53,.20,_fdark)
        _tc_box('Heavy forged post collar',(x,.28,2.37),
                (.22,.22,.17),_tc_aged_iron)
    _tc_box('Gallows overhead crossbar',(0,.28,2.44),(1.72,.25,.25),_fdark,.027)
    for x in (-.71,.71):
        _tc_beam('Diagonal iron gallows bracket',(x,.28,1.91),
                 (x*.5,.28,2.44),.034,_tc_aged_iron)
    _tc_ring('Huge hanging central shackle',(0,.28,2.38),.10,.023)
    _tc_chain('Suspension blacksmith chain',(0,.28,2.35),(0,.28,2.05),5,.038)
    # Octagonal hanging bell cage 1m above ground.
    radius=.49
    bottom=.50
    top=1.88
    segments=10
    for i in range(segments):
        angle=2*_m.pi*i/segments
        x=radius*_m.cos(angle)
        y=radius*_m.sin(angle)+.12
        _tc_beam('Curved iron cage vertical bar',(x,y,bottom),
                 (x*.86,(y-.12)*.86+.12,top),.023)
        for h in (bottom,top-.29,top):
            j=(i+1)%segments
            a=2*_m.pi*j/segments
            x2=radius*_m.cos(a);y2=radius*_m.sin(a)+.12
            _tc_beam('Cage octagonal hand-forged iron hoop',(x,y,h),
                     (x2,y2,h),.027)
    for j in range(segments):
        angle=2*_m.pi*j/segments
        _tc_beam('Cage arched top rib',(radius*.86*_m.cos(angle),
            radius*.86*_m.sin(angle)+.12,top),(0,.12,2.06),.023)
    cylinder('Hanging cage black bottom iron pan',(0,.12,bottom),
             radius,.075,_tc_aged_iron,10)
    _tc_box('Hinged cage door latch',(.30,-.335,1.18),
            (.17,.09,.24),_tc_aged_iron)
    _tc_ring('Cage padlock shackle',(.29,-.385,1.22),.043,.012,_fbrass)
    # Ground pedestal feet and free-standing pivot are retained.
    for x in (-.72,.72):
        _tc_box('Gallows ballast foot',(x,.07,.09),(.41,.85,.17),_fdark,.018)

def _tc_interrogation_chair():
    # Much more solid and upright than the two everyday alchemy chairs.
    for x in (-.33,.33):
        for y in (-.31,.31):
            _tc_post('Interrogation chair nailed oak leg',x,y,.82,.15,_fdark)
    _tc_box('Oak reinforced interrogation seat',(0,0,.80),(.86,.80,.16),_fwood,.032)
    _tc_box('Stiffened black-brown seat leather',(0,-.025,.899),
            (.72,.66,.037),_tc_red_leather,.018)
    for x in (-.35,.35):
        _tc_box('Interrogation chair tall rear stanchion',(x,.29,1.32),
                (.18,.18,1.63),_fwood,.023)
    for z in (.98,1.36,1.70):
        _tc_box('Vertical confinement chair oak backboard',(0,.32,z),
                (.80,.105,.28),_fdark,.017)
        _tc_box('Iron cross-bound chair rear',(0,.252,z),
                (.85,.036,.05),_tc_aged_iron,.009)
        for x in (-.32,.32):_tc_rivet('Chair iron band rivet',x,.220,z)
    for x in (-.41,.41):
        _tc_post('Elbow restraint post',x,-.08,1.18,.13,_fedge)
        _tc_box('Heavy elbow shelf',(x,-.08,1.18),(.18,.78,.14),_fdark,.021)
        _tc_box('Empty wrist restraint leather strap',(x,-.27,1.255),
                (.19,.125,.026),_tc_red_leather,.009)
        _tc_ring('Loose restraint forged clasp',(x,-.25,1.285),.052,.011)
    _tc_box('Heavy foot restraint board',(0,-.42,.20),(.83,.15,.14),_fwood)
    for x in (-.24,.24):
        _tc_ring('Iron foot shackle unoccupied',(x,-.43,.29),.068,.015)
    _tc_ring('Iron throne crest engraving',(0,.225,1.67),.107,.013,_fbrass)
    _tc_box('Headboard reinforced iron top rim',(0,.32,1.89),(.83,.16,.13),_tc_aged_iron)

def _tc_tool_table():
    # Only tools, no injuries/occupants. L-shaped rack gives unique silhouette.
    for x in (-.67,.67):
        for y in (-.33,.33):
            _tc_post('Torturers worktable wood leg',x,y,.81,.145)
    for i in range(6):
        y=-.37+i*.15
        _tc_box('Scraped artisan tabletop plank',(0,y,.82),
                (1.57,.15,.12),_fdark if i%3==0 else _fwood,.016)
    for x in (-.70,.70):
        _tc_box('Iron-banded workbench end bracket',(x,0,.80),
                (.08,.78,.10),_tc_aged_iron,.010)
    # Back vertical fitted peg-board with separately hanging iron tools.
    for x in (-.67,.67):
        _tc_box('Vertical tool-board frame',(x,.41,1.27),
                (.13,.12,.81),_fwood,.014)
    for z in (1.02,1.48):
        _tc_box('Hammered tool rail',(0,.42,z),(1.45,.15,.09),
                _tc_aged_iron,.012)
    for i,x in enumerate((-.52,-.29,-.07,.17,.39,.57)):
        _tc_ring('Torturers forged tool hanging eyelet',(x,.34,1.49),
                 .037,.008)
        _tc_beam('Short suspended metal shaft',(x,.30,1.45),
                 (x,.30,1.13+i%2*.05),.017,_tc_aged_iron)
        if i%3==0:
            _tc_box('Small iron pry-bar head',(x,.30,1.15),(.13,.035,.038),_tc_aged_iron)
        elif i%3==1:
            _tc_ring('Open-ended looped iron implement',(x,.30,1.13),.048,.012)
        else:
            _tc_box('Pincers two hinged fork tips',(x,.30,1.13),(.095,.04,.08),_tc_aged_iron)
    _tc_box('Stained leather working mat',(-.27,-.18,.90),
            (.68,.48,.025),_tc_red_leather,.013)
    _tc_beam('Tongs laying on table',(-.12,-.19,.942),
             (.21,-.06,.942),.020,_tc_aged_iron)
    for x in (-.49,.49):
        _tc_beam('Old iron blacksmith handtool', (x,-.20,.949),
                 (x,-.43,.949),.016,_tc_aged_iron)
    _tc_box('Back workbench lower shelf',(0,0,.27),(1.38,.58,.07),_fdark)
    _tc_ball('Closed stone abrasive whetstone',(.44,.19,.97),
             (.15,.087,.045),_tc_gritty_stone)

def _tc_chain_wall():
    # Free-standing independent modular wall piece; no actual room wall edits.
    for x in (-.76,.76):
        _tc_stone_block('Chain wall hewn stone outer pillar',(x,.01,1.12),(.22,.34,2.20))
    for j in range(5):
        z=.22+j*.44
        for x in (-.46,0,.46):
            _tc_stone_block('Unlevel medieval dungeon wall ashlar',
                           (x,.15,z),(.48,.28,.41))
    _tc_box('Wall crest heavily corroded lintel',(0,.08,2.28),
            (1.70,.38,.14),_tc_gritty_stone,.016)
    for x in (-.50,0,.50):
        for z in (1.75,.84):
            _tc_box('Wide forged masonry anchor plate',(x,-.037,z),
                    (.19,.045,.16),_tc_aged_iron,.012)
            for off in (-.058,.058):
                _tc_rivet('Riveted medieval wall anchor',x+off,-.070,z)
            _tc_ring('Masonry mooring ring',(x,-.10,z),.09,.021)
            if x != 0:
                _tc_chain('Loose wall shackles',(x,-.17,z-.11),
                          (x+.06,-.22,z-.52),5,.039)
    _tc_box('Wall ancient cross brace',(0,-.042,.40),
            (1.53,.05,.073),_tc_aged_iron,.011)
    for x in (-.65,.65):
        _tc_box('Chain wall grounding stone toe',(x,-.07,.12),
                (.31,.54,.23),_tc_gritty_stone)

def _tc_iron_maiden():
    # Gothic CLOSED iron cabinet with a slightly open forged face.
    # Never displays a person or gore. Spiked inner interior is implied.
    for x in (-.42,.42):
        _tc_post('Riveted iron coffin support',x,.0,1.63,.135,_tc_aged_iron)
    _tc_box('Iron maiden heavy coffin rear',(0,.16,1.30),
            (.92,.52,2.20),_tc_aged_iron,.044)
    _tc_box('Iron maiden raised beveled plinth',(0,.02,.17),
            (1.11,.76,.28),_fdark,.024)
    _tc_box('Forged iron plinth locking lip',(0,-.37,.24),
            (1.13,.06,.11),_tc_aged_iron)
    # Gothic pointed head using a five-point actual extruded panel.
    _flat_blade('Dark iron maiden Gothic triangular crown',[
        (-.46,.0,2.41),(-.38,.0,2.53),(0,.0,2.82),
        (.38,.0,2.53),(.46,.0,2.41)],.46,_tc_aged_iron)
    # Door slightly ajar, hinged at the left; a narrow dark inner gap.
    door=_tc_box('Iron maiden offset slightly ajar steel door',
                 (.17,-.19,1.37),(.78,.08,1.97),_tc_aged_iron,.026)
    door.rotation_euler.z=-.17
    for z in (.63,1.21,1.79):
        _tc_box('Iron maiden hand-forged front door band',
                (.18,-.25,z),(.81,.04,.052),_firon,.011)
        _tc_rivet('Iron maiden door rivet',-.18,-.273,z)
        _tc_rivet('Iron maiden door rivet',.52,-.273,z)
    for z in (.68,1.58,2.17):
        _tc_box('Heavy rusted door hinge on side',
                (-.47,-.07,z),(.13,.23,.17),_fbrass,.018)
    _tc_ring('Bronze iron maiden engraved front sigil',
             (.22,-.289,1.65),.17,.021,_fbrass)
    _tc_ring('Iron maiden padlock on chest',(.52,-.30,1.15),.081,.017)
    _tc_box('Black hanging latch handle',(.52,-.32,1.03),
            (.07,.06,.24),_tc_aged_iron,.009)

def _tc_ember_brazier():
    # Dwarfing flames are represented by geometry, no animated effect.
    for i in range(4):
        a=_m.pi*2*i/4
        x=.39*_m.cos(a);y=.39*_m.sin(a)
        _tc_post('Blacksmith curved brazier support',x,y,.79,.115,_tc_aged_iron)
        _tc_beam('Diagonal brazier underframe',(x,y,.42),(0,0,.70),.034)
    cylinder('Brazier forged iron basin lower',(0,0,.84),.43,.18,_tc_aged_iron,18)
    cylinder('Brazier deep ash-blackened upper fire bowl',(0,0,1.00),
             .48,.21,_tc_aged_iron,20)
    cylinder('Brazier glowing inner coal surface',(0,0,1.115),
             .395,.029,_tc_ash,20)
    _tc_ring('Brazier forged outer rim',(0,0,1.116),.48,.04,_fbrass,False)
    for i in range(27):
        theta=i*2.399
        radius=.33*((i%8)+1)/9
        x=radius*_m.cos(theta);y=radius*_m.sin(theta)
        z=1.13+((i*7)%5)*.022
        _tc_ball('Hot irregular charcoal embers',(x,y,z),
                 (.054,.065,.044),_tc_ember if i%3 else _tc_ash)
    for i in range(7):
        a=i*2.399
        x=.21*_m.cos(a);y=.21*_m.sin(a)
        _tc_ball('Smoke-black mineral coals',(x,y,1.20),
                 (.10,.09,.06),_tc_ash)
    for a in (0,_m.pi/2,_m.pi,3*_m.pi/2):
        _tc_ring('Iron side carrying ring',(.50*_m.cos(a),.50*_m.sin(a),.93),
                 .087,.020)
    # Real Cycles emission with a compact ember glow, no in-game dynamic light.
    bsdf=_tc_ember.node_tree.nodes.get('Principled BSDF')
    if bsdf and bsdf.inputs.get('Emission'):
        bsdf.inputs['Emission'].default_value=(1.0,.17,.019,1)
        if bsdf.inputs.get('Emission Strength'):
            bsdf.inputs['Emission Strength'].default_value=.8

def _tc_pillory():
    # Three openings, one large head and two smaller hands, empty/unused.
    for x in (-.81,.81):
        _tc_post('Pillory massive oak support',x,.07,1.89,.19)
        _tc_box('Forged pillory pillar top cap',(x,.07,1.91),
                (.22,.22,.15),_tc_aged_iron,.012)
        _tc_box('Pillory supporting foot', (x,.04,.11),(.40,.74,.20),_fwood)
    for z in (.98,1.38):
        _tc_box('Pillory lower solid crossbeam',(0,.06,z),
                (1.69,.17,.16),_fdark,.024)
    # Two separate, physically carved row halves, open dark gaps visible.
    for z in (1.50,1.72):
        for x in (-.64,-.40,-.14,.14,.40,.64):
            _tc_box('Gapped medieval pillory oak body',(x,.06,z),
                    (.255,.185,.205),_fwood,.013)
    # Visible open circular stocks and iron ring edges; no occupied holes.
    for x,radius in ((-.49,.10),(0,.17),(.49,.10)):
        _tc_ring('Iron-rimmed pillory opening',(x,-.053,1.62),
                 radius,.022,_tc_aged_iron)
    for z in (1.48,1.85):
        _tc_box('Iron stocks outer horizontal strap',(0,-.071,z),
                (1.69,.033,.043),_tc_aged_iron)
    for x in (-.79,.79):
        for z in (1.49,1.87):
            _tc_rivet('Pillory ancient iron nail',x,-.096,z)
    _tc_box('Pillory front locking bar',(.77,-.057,1.58),
            (.13,.07,.35),_tc_aged_iron,.013)
    _tc_ring('Pillory heavy door clasp',(.76,-.108,1.58),.053,.013,_fbrass)

def _tc_wheel():
    # Large single upright spoked medieval wheel, never with a person.
    for x in (-.68,.68):
        _tc_post('Breaking wheel deep oak ground leg',x,.12,.72,.17)
        _tc_box('Heavy wedge-shaped floor runner',(x,-.05,.14),
                (.24,1.0,.20),_fdark,.012)
    for x in (-.46,.46):
        _tc_post('Wheel central ironbound upright',x,.25,1.33,.14)
        _tc_beam('Diagonal wheel-frame forged strut',(x,-.16,.28),
                 (x,.23,1.53),.050,_fwood)
    _tc_beam('Iron long central wheel bearing axle',(0,-.36,1.42),
             (0,.40,1.42),.075,_tc_aged_iron)
    # Wheel plane X-Z; torus oriented around the Y-axis.
    for radius in (.71,.77,.82):
        _tc_ring('Wide circular oak wheel structural rim',(0,-.05,1.42),
                 radius,.053,_fwood,True)
    _tc_ring('Iron-riveted perimeter wheel tire',(0,-.052,1.42),
             .827,.019,_tc_aged_iron,True)
    _tc_ball('Wheel black iron centre hub',(0,-.08,1.42),
             (.17,.12,.17),_tc_aged_iron)
    for i in range(12):
        angle=i*_m.tau/12
        x=.76*_m.cos(angle);z=1.42+.76*_m.sin(angle)
        _tc_beam('Physical oak wheel spoke',(0,-.05,1.42),
                 (x,-.05,z),.039,_fwood)
        _tc_ball('Wheel rim hammered outer rivet',
                 (.79*_m.cos(angle),-.108,1.42+.79*_m.sin(angle)),
                 (.028,.018,.029),_fbrass)
    _tc_box('Wheel bearing crank grip',(.13,-.34,1.45),
            (.34,.085,.09),_tc_aged_iron)
    _tc_ball('Wheel bearing handle',(.31,-.34,1.45),
             (.054,.051,.056),_fbrass)

def _tc_prison_transport_cage():
    # Compact, ground-standing rectangular prisoner transport crate, contrasting
    # explicitly with the round suspended gallows cage above.
    w=.57;d=.44
    for x in (-w,w):
        for y in (-d,d):
            _tc_post('Small wheeled prison cage iron upright',x,y,1.30,.086,_tc_aged_iron)
    for z in (.20,.69,1.28):
        for y in (-d,d):
            _tc_beam('Iron cage perimeter length rail',
                     (-w,y,z),(w,y,z),.033)
        for x in (-w,w):
            _tc_beam('Iron cage perimeter end rail',
                     (x,-d,z),(x,d,z),.033)
    for x in (-.38,-.19,0,.19,.38):
        for y in (-d,d):
            _tc_beam('Narrow cage front and back grille bar',
                     (x,y,.20),(x,y,1.28),.019)
    for y in (-.26,0,.26):
        for x in (-w,w):
            _tc_beam('Cage side lattice bar',(x,y,.20),(x,y,1.28),.022)
    for i in range(6):
        y=-.42+i*.17
        _tc_box('Heavy transporting wooden sled floor',(0,y,.19),
                (1.24,.17,.10),_fdark if i%2 else _fwood,.009)
    for x in (-.62,.62):
        _tc_box('Cage sled runner',(x,0,.065),(.20,1.20,.13),_fwood,.015)
    _tc_box('Iron transport cage roof cross frame',(0,0,1.36),
            (1.25,.13,.11),_tc_aged_iron,.011)
    _tc_box('Hinged small iron prison cage door',(.10,-.47,.68),
            (.51,.028,.89),_tc_aged_iron,.011)
    for i in range(5):
        x=-.15+i*.13
        _tc_beam('Door narrow open prison bars',(x,-.49,.27),(x,-.49,1.13),.024)
    _tc_ring('Transport cage gate hasp',(.38,-.50,.71),.051,.013,_fbrass)
    for x in (-.58,.58):
        _tc_ring('Cage dragging handle',(x,.55,.44),.12,.023)

def _tc_dungeon_washbasin():
    # Grounded masonry sink and drainage chute, no person or blood.
    _tc_stone_block('Prison washbasin broad stone foot',(0,0,.16),
                    (1.31,.82,.30))
    for x in (-.53,.53):
        _tc_stone_block('Washbasin cracked granite side',(x,0,.51),
                        (.23,.74,.49))
    _tc_stone_block('Washbasin rear thick stone gutter',(0,.34,.53),
                    (1.27,.15,.48))
    _tc_stone_block('Washbasin broad carved front stone lip',(0,-.32,.69),
                    (1.25,.15,.16))
    _tc_box('Dark standing waste-water pool',(0,-.01,.57),
            (1.01,.50,.026),_tc_water,.022)
    _tc_stone_block('Grooved drainage spout',(.49,-.42,.47),
                    (.20,.27,.105))
    _tc_box('Drainage gutter narrow black-water inlay',(.49,-.43,.526),
            (.10,.25,.012),_tc_water,.008)
    _tc_box('Raised masonry soap shelf',(-.50,.40,.91),
            (.31,.26,.09),_tc_gritty_stone,.012)
    _tc_ball('Rough lye soap on stone shelf',(-.53,.32,.988),
             (.104,.067,.039),_tc_dirty_linen)
    for x,y,z in ((-.65,-.27,.80),(-.58,-.33,.92)):
        _tc_box('Hanging frayed linen washing rag',(x,y,z),
                (.16,.033,.35),_tc_dirty_linen,.008)
    # Wood and forged hoop bucket is distinguishable as a real prop.
    cylinder('Half-filled rough oak prison wash bucket',(.71,.13,.35),
             .19,.55,_fwood,14)
    for z in (.15,.53):
        _tc_ring('Washing bucket rusty iron hoop',(.71,.13,z),
                 .194,.015,_tc_aged_iron,False)
    cylinder('Dirty water visible in open bucket',(.71,.13,.632),
             .165,.012,_tc_water,14)
    _tc_beam('Forged bent handle left',(.54,.13,.60),(.57,.13,.84),.016)
    _tc_beam('Forged bent handle right',(.88,.13,.60),(.84,.13,.84),.016)
    _tc_beam('Forged bucket handle bow',(.57,.13,.84),(.84,.13,.84),.019)

_TORTURE_SCULPTURES=[
 ('iron-cage','Hanging iron cage | wrought iron octagonal gibbet',_tc_hanging_cage, .45),
 ('interrogation-chair','Interrogation chair | oak, iron and leather',_tc_interrogation_chair, .45),
 ('tool-table','Torture tool workshop table | unoccupied',_tc_tool_table,.45),
 ('chain-wall','Standing dungeon chain wall modular segment',_tc_chain_wall,.45),
 ('iron-maiden','Closed gothic iron maiden cabinet',_tc_iron_maiden,.45),
 ('ember-brazier','Iron brazier of hot charcoal',_tc_ember_brazier,.45),
 ('pillory','Unoccupied medieval oak pillory',_tc_pillory,.45),
 ('torture-wheel','Upright spoked medieval wheel',_tc_wheel,.45),
 ('prison-cage','Short movable square prisoners cage',_tc_prison_transport_cage,.45),
 ('washbasin','Medieval kerker stone wash basin',_tc_dungeon_washbasin,.45)
]

TORTURE_MODELS=[]
for slug,name,model_fn,scale in _TORTURE_SCULPTURES:
    model=make_model(name,model_fn)
    model.scale=(scale,)*3
    TORTURE_MODELS.append((slug,model))
