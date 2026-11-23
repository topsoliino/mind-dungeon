"""Import the exact two medieval stone WALL images shown as material references.

No facade recomposition, procedural aging, color shifts, contrast changes,
image scaling, sharpen/blur, or JPEG encoding. Save original CDN PNG bytes.
The original wall model still supplies geometry and collision in the editor.

Poly Haven CC0:
 https://polyhaven.com/a/medieval_wall_02
 https://polyhaven.com/a/stone_block_wall
"""
from importlib.machinery import SourceFileLoader
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMPORTS = SourceFileLoader("original_room_preview_importer",
                       str(HERE / "build-floor-map.py")).load_module()
SOURCES = {
    "stone": ("medieval_wall_02", "wall-masonry-01.png"),
    "stone-cut": ("stone_block_wall", "wall-masonry-02.png"),
}

def build():
    return {style:IMPORTS.import_primary_preview(*item)
            for style,item in SOURCES.items()}

if __name__ == "__main__":
    build()
