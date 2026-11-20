"""Pack cropped Blender body and weapon frames into web textures."""
import argparse
import json
from pathlib import Path
from shutil import copyfile

from PIL import Image

FACINGS = 8
PADDING = 2
MAX_HEIGHT = 4096


def pack_layer(directory, layer, count, width, indices):
    # Each crop keeps its offset from the original Blender camera pivot.
    frames = [None] * (FACINGS * count)
    tiles = []
    for index in indices:
        frame, facing = divmod(index, FACINGS)
        path = directory / f'{layer}-{facing}-{frame}.png'
        with Image.open(path) as source:
            rgba = source.convert('RGBA')
        bounds = rgba.getchannel('A').getbbox()
        if bounds:
            left, top, _, _ = bounds
            tiles.append((index, rgba.crop(bounds), left, top))
        elif layer == 'body':
            raise ValueError(f'Empty body frame {frame} in direction {facing}')

    x = y = PADDING
    shelf_height = 0
    cropped = []
    sheets = []

    def make_sheet():
        atlas = Image.new('RGBA', (width, y+shelf_height+PADDING))
        for tile, offset in cropped:
            atlas.paste(tile, offset)
        return atlas

    for index, tile, left, top in sorted(tiles, key=lambda item: -item[1].height):
        if x + tile.width + PADDING > width:
            next_y = y+shelf_height+PADDING
            if next_y+tile.height+PADDING > MAX_HEIGHT:
                sheets.append(make_sheet())
                cropped = []
                next_y = PADDING
            x, y = PADDING, next_y
            shelf_height = 0
        frames[index] = [x, y, tile.width, tile.height, left, top, len(sheets)]
        cropped.append((tile, (x, y)))
        x += tile.width + PADDING
        shelf_height = max(shelf_height, tile.height)

    sheets.append(make_sheet())
    return sheets, frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('renders', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    clips = json.loads((args.renders / 'clips.json').read_text())
    count = sum(frames for _, frames in clips.values())
    motion = json.loads((args.renders / 'attack-motion.json').read_text())
    vault = json.loads((args.renders / 'vault.json').read_text())
    interactions = json.loads((args.renders / 'interactions.json').read_text())
    consumption = json.loads((args.renders / 'consumption.json').read_text())
    knockback = json.loads((args.renders / 'knockback.json').read_text())
    manifest = {'clips': clips, 'attackMotion': motion, 'vault': vault,
                'interactions': interactions, 'consumption': consumption, 'knockback': knockback,
                'sheets': {}}
    for layer, width, other in [('body', 4096, None), ('weapon', 1024, 'hammer'),
                                ('hammer', 1024, 'sword')]:
        indices = (index for clip, (start, length) in clips.items()
                   if not other or not clip.startswith((f'charge-{other}-', f'heavy-{other}', f'roll-attack-{other}'))
                   for index in range(start*FACINGS, (start+length)*FACINGS))
        atlases, manifest[layer] = pack_layer(args.renders, layer, count, width, indices)
        files = []
        for number, atlas in enumerate(atlases, 1):
            suffix = '' if number==1 else f'-{number}'
            file = f'guardian-{layer}{suffix}.webp'
            atlas.save(args.output / file, quality=89, method=4)
            files.append(file)
        manifest['sheets'][layer] = files
    (args.output / 'guardian-frames.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    copyfile(args.renders / 'guardian.blend', args.output / 'guardian.blend')


if __name__ == '__main__':
    main()
