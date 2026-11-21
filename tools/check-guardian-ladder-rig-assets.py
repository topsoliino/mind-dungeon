"""Check the real Blender-to-GLB ladder export, not just the JS overlay."""
import gzip
import json
from pathlib import Path
import struct

ASSETS = Path(__file__).resolve().parent.parent / 'beta' / 'art' / 'player-study'
manifest = json.loads((ASSETS / 'guardian-frames.json').read_text())
clips = manifest['clips']
assert 'climb-up' in clips and 'climb-down' in clips, 'Missing Blender ladder clips'
up, down = clips['climb-up'], clips['climb-down']
assert up[1] >= 32 and down[1] >= 32, 'Ladder motion is too short'
assert down[0] == up[0]+up[1], 'Clips must follow each other'
for name, (start, length) in clips.items():
    if name not in ('climb-up','climb-down'):
        assert start+length <= up[0], 'Original animation slot was overwritten'

binary = gzip.decompress((ASSETS / 'guardian-rig.glb.gz').read_bytes())
assert binary[:4] == b'glTF', 'Bad exported GLB'
version, length = struct.unpack_from('<II', binary, 4)
assert version == 2 and length == len(binary)
size, tag = struct.unpack_from('<I4s', binary, 12)
assert tag == b'JSON'
model = json.loads(binary[20:20+size])
animations = model.get('animations',[])
assert len(animations) == 1, 'The browser needs one continuous scene animation'
channels = animations[0]['channels']
assert len(channels) >= 12, 'Armature animation tracks absent'
accessors = model['accessors']
timestamps = []
for sampler in animations[0]['samplers']:
    accessor = accessors[sampler['input']]
    if 'max' in accessor:
        timestamps.append(max(accessor['max']))
assert timestamps, 'Could not inspect GLB keyframe times'
max_time = max(timestamps)
expected_time = (down[0]+down[1]-1)/24
assert max_time >= expected_time-.09, (
    f'GLB ({max_time:.2f}s) stops before Blender ladder keys ({expected_time:.2f}s)')
names = {node.get('name') for node in model['nodes']}
for bone in ('Hips','Chest','Arm.L','Arm.R','Thigh.L','Thigh.R'):
    assert bone in names, f'Missing keyed rig bone {bone}'
print('Guardian Blender ladder export OK:',
      'clips', {key: clips[key] for key in ('climb-up','climb-down')},
      'duration', round(max_time,2), 'channels',len(channels))
