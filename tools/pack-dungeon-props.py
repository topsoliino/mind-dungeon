"""python tools/pack-dungeon-props.py RENDER_DIRECTORY beta"""
from PIL import Image
from pathlib import Path
import json
import sys
source,destination=map(Path,sys.argv[1:])
items={}
for p in sorted(source.glob('*.png')):
 im=Image.open(p).convert('RGBA');n=im.width;box=im.getbbox();s=im.crop(box);span=max(5,1.2*int(p.stem[-1])) if p.stem.startswith(('seal','spent')) else 3.8 if p.stem=='brew' else 2.6
 # Independent crops retain the ground pivot of the orthographic camera.
 s.thumbnail((round(s.width*.7),round(s.height*.7)),Image.Resampling.LANCZOS)
 items[p.stem]=(s,[(n/2-box[0])/(box[2]-box[0]),(n/2-box[1])/(box[3]-box[1]),span*(box[2]-box[0])/n,span*(box[3]-box[1])/n])
atlas=Image.new('RGBA',(1024,2048));x=y=h=0;meta={}
for name,(s,transform) in items.items():
 if x+s.width>1024:x=0;y+=h+4;h=0
 atlas.paste(s,(x,y));meta[name]=[x,y,s.width,s.height,*[round(v,6) for v in transform]]
 h=max(h,s.height);x+=s.width+4
atlas.crop((0,0,1024,y+h)).save(destination/'art/props/dungeon-props.webp',quality=91,method=6)
adapter=destination/'dungeon-props.js'
code=adapter.read_text()
start=code.index(' const frames=')
end=code.index(' if(!window.AlleyGenerator',start)
frames=' const frames={\n'+',\n'.join('  '+json.dumps(k)+':'+json.dumps(v) for k,v in meta.items())+'\n };\n'
adapter.write_text(code[:start]+frames+code[end:])
