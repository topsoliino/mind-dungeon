"""Compress the Blender sprite study and crop each weapon frame for the web."""
import argparse
import json
from pathlib import Path
from shutil import copyfile

from PIL import Image

CELL = 128
FACINGS = 8
ATLAS_COLUMNS = 28
WEAPON_WIDTH = 1024
PADDING = 2
CLIP_FRAMES = (4, 16, 16, 16, 8, 20, 20)


def pack_weapons(source):
    # All cells retain their original drawing origin through the crop offsets.
    frames = [None] * (FACINGS * sum(CLIP_FRAMES))
    tiles = []
    for index in range(len(frames)):
        row, column = divmod(index, ATLAS_COLUMNS)
        x, y = column * CELL, row * CELL
        tile = source.crop((x, y, x + CELL, y + CELL))
        bounds = tile.getchannel('A').getbbox()
        if bounds:
            left, top, _, _ = bounds
            tiles.append((index, tile.crop(bounds), left, top))

    x = y = PADDING
    shelf_height = 0
    cropped = []
    for index, tile, left, top in sorted(tiles, key=lambda item: -item[1].height):
        if x + tile.width + PADDING > WEAPON_WIDTH:
            x, y = PADDING, y + shelf_height + PADDING
            shelf_height = 0
        frames[index] = [x, y, tile.width, tile.height, left, top]
        cropped.append((tile, (x, y)))
        x += tile.width + PADDING
        shelf_height = max(shelf_height, tile.height)

    atlas = Image.new('RGBA', (WEAPON_WIDTH, y + shelf_height + PADDING))
    for tile, offset in cropped:
        atlas.paste(tile, offset)
    return atlas, frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('renders', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = (FACINGS * sum(CLIP_FRAMES) + ATLAS_COLUMNS - 1) // ATLAS_COLUMNS

    body = Image.open(args.renders / 'guardian-body.png').convert('RGBA')
    weapon = Image.open(args.renders / 'guardian-weapon.png').convert('RGBA')
    if not body.size == weapon.size == (CELL * ATLAS_COLUMNS, CELL * rows):
        raise ValueError('Unexpected Blender atlas layout.')
    weapon, frames = pack_weapons(weapon)
    body.save(args.output / 'guardian-body.webp', quality=89, method=4)
    weapon.save(args.output / 'guardian-weapon.webp', quality=89, method=4)
    (args.output / 'guardian-weapon.json').write_text(json.dumps(frames, separators=(',', ':')) + '\n')
    copyfile(args.renders / 'guardian.blend', args.output / 'guardian.blend')


if __name__ == '__main__':
    main()
