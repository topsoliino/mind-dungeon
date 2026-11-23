"""Build one non-tiled 4096px dark-medieval prison-floor artwork.

One 32x32-world-unit canvas. Smaller rooms crop it at native world scale;
room size never rescales individual stones. Requires Pillow, no Blender.
Run: python3 beta/room-editor/blender/build-floor-map.py
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps
import math
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'tiles' / 'floor-prison-01.webp'
SEED = 0xD00D6E
SIZE = 4096
WORLD = 32
PPU = SIZE / WORLD
R = random.Random(SEED)

def p(v):
    return round(v * PPU)

def random_noise(pixels):
    layer = Image.new('L', (pixels, pixels))
    layer.putdata(bytes(R.randrange(256) for _ in range(pixels * pixels)))
    return layer.resize((SIZE, SIZE), Image.Resampling.BICUBIC)

def polygon_around(cx, cy, radius_x, radius_y, points=8):
    phase = R.random() * math.tau
    vertices = []
    for i in range(points):
        theta = phase + math.tau*i/points
        shape = R.uniform(.76, 1.14)
        vertices.append((p(cx + math.cos(theta)*radius_x*shape),
                         p(cy + math.sin(theta)*radius_y*shape)))
    return vertices

def jitter_color(rgb, d):
    return tuple(max(0, min(255, c + d + R.randrange(-5, 6))) for c in rgb)

def line_organic(draw, x, y, length, direction, width, fill):
    points = [(p(x), p(y))]
    for i in range(1, 5):
        t = i / 4
        warp = math.sin(t*math.pi)*R.uniform(-.05,.05)
        px = x + math.cos(direction)*length*t - math.sin(direction)*warp
        py = y + math.sin(direction)*length*t + math.cos(direction)*warp
        points.append((p(px), p(py)))
    draw.line(points, fill=fill, width=width, joint='curve')

# Base: layered, deterministic dirt mineral mottling with detail at several scales.
n1, n2, n3 = random_noise(66), random_noise(256), random_noise(1024)
tone = ImageChops.add(ImageChops.multiply(n1, Image.new('L', n1.size, 144)),
                      ImageChops.multiply(n2, Image.new('L', n2.size, 66)), scale=1.0)
tone = Image.blend(tone, n3, .13)
ground = ImageOps.colorize(tone, black='#171b20', white='#535054')
d = ImageDraw.Draw(ground, 'RGBA')

# Uneven stone paving with irregular missing sections; no grid, seams or repeating texture.
stone_colors = [(63,65,68),(72,70,71),(75,73,70),(62,65,72),
                (86,80,76),(56,62,67),(82,78,77),(67,64,65)]
stones = []
for row in range(56):
    y = (row + .43) * WORLD / 56
    x = -R.uniform(0,.7)
    while x < WORLD:
        step = R.uniform(.37,.82)
        x += step
        if R.random() < .24:
            continue
        cx = x + R.uniform(-.18,.18)
        cy = y + R.uniform(-.16,.16)
        rx = R.uniform(.22,.53)
        ry = R.uniform(.15,.39)
        pts = polygon_around(cx,cy,rx,ry,points=R.randrange(6,10))
        base = jitter_color(R.choice(stone_colors),R.randint(-10,9))
        shadow = tuple(max(0,c-22) for c in base)
        d.polygon([(u+3,v+4) for u,v in pts],fill=(*shadow,218))
        d.polygon(pts,fill=(*base,228),outline=(25,27,30,205),width=R.choice([2,3,4]))
        # Chips / lichen-like mineral striation inside each polygon.
        if R.random() < .64:
            x0,y0 = cx-R.uniform(0,rx*.45),cy-R.uniform(0,ry*.4)
            line_organic(d,x0,y0,R.uniform(.07,.28),R.uniform(-1.3,1.3),2,(19,21,24,118))
        if R.random() < .20:
            stones.append((cx,cy,rx,ry))

# Wet, compacted soil and trapped mold are translucent and irregular, not geometric tiles.
weather = Image.new('RGBA',(SIZE,SIZE))
wd = ImageDraw.Draw(weather,'RGBA')
for i in range(130):
    x,y = R.uniform(-1,WORLD+1),R.uniform(-1,WORLD+1)
    rx,ry = R.uniform(.12,.9),R.uniform(.12,.8)
    col = R.choice([(17,18,19,65),(21,23,25,92),(56,44,37,49),
                    (28,35,33,80),(32,33,38,76)])
    wd.polygon(polygon_around(x,y,rx,ry,R.randrange(8,13)),fill=col)
weather=weather.filter(ImageFilter.GaussianBlur(9))
ground=Image.alpha_composite(ground.convert('RGBA'),weather)
d=ImageDraw.Draw(ground,'RGBA')

# Stone chips, pebbles, filth, hairline fractures, oxidized dust and old straw.
for i in range(5800):
    x,y=R.uniform(0,WORLD),R.uniform(0,WORLD)
    radius=R.choice([.006,.009,.013,.019,.032,.047])
    col=R.choice([(13,16,18,120),(26,28,27,170),(100,91,79,111),
                  (113,105,90,86),(38,36,33,165)])
    d.ellipse((p(x-radius),p(y-radius*.6),p(x+radius),p(y+radius*.6)),fill=col)
for i in range(440):
    x,y=R.uniform(0,WORLD),R.uniform(0,WORLD)
    angle=R.uniform(-math.pi,math.pi)
    length=R.uniform(.08,.6)
    col=R.choice([(13,14,17,145),(27,23,22,115),(117,108,90,74)])
    line_organic(d,x,y,length,angle,R.choice([1,2,3]),col)
for cx,cy,rx,ry in stones:
    angle=R.uniform(0,math.tau)
    length=R.uniform(.08,.23)
    line_organic(d,cx,cy,length,angle,2,(10,12,14,195))
for i in range(210):
    x,y=R.uniform(0,WORLD),R.uniform(0,WORLD)
    angle=R.uniform(0,math.tau)
    length=R.uniform(.06,.38)
    line_organic(d,x,y,length,angle,R.choice([1,2]),(126,102,65,R.randrange(85,175)))

# Sparse ancient puddles: soft damp fringes plus sharp, low-specular central deposits.
water = Image.new('RGBA',(SIZE,SIZE))
w = ImageDraw.Draw(water,'RGBA')
for i in range(19):
    x,y=R.uniform(.5,WORLD-.5),R.uniform(.5,WORLD-.5)
    rx,ry=R.uniform(.20,.67),R.uniform(.09,.34)
    w.polygon(polygon_around(x,y,rx,ry,11),fill=(14,23,26,72))
water=water.filter(ImageFilter.GaussianBlur(12))
ground=Image.alpha_composite(ground,water)

# Tiny neutral warm/cool grain connects the floor to Guardian's high-contrast metal.
grain=random_noise(1024)
grain_color=ImageOps.colorize(grain,black='#1c1c1e',white='#77716c').convert('RGBA')
ground=Image.blend(ground,grain_color,.075).convert('RGB')
OUT.parent.mkdir(parents=True,exist_ok=True)
ground.save(OUT,'WEBP',quality=88,method=6)
if not OUT.is_file() or OUT.stat().st_size < 100_000:
    raise SystemExit('Floor map export missing or unexpectedly small')
print(f'ONE CONTINUOUS DARK-MEDIEVAL FLOOR: {OUT} ({SIZE}x{SIZE}, {OUT.stat().st_size} bytes)',flush=True)
