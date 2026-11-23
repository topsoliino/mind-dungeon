"""Import the exact three medieval stone WALL images shown as material references.

No facade recomposition, procedural aging, color shifts, contrast changes,
image scaling, sharpen/blur, or JPEG encoding. Save original CDN PNG bytes.
The original wall model still supplies geometry and collision in the editor.

Poly Haven CC0:
 https://polyhaven.com/a/rock_wall_17
 https://polyhaven.com/a/rock_wall_16
 https://polyhaven.com/a/old_stone_wall
"""
from importlib.machinery import SourceFileLoader
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMPORTS = SourceFileLoader("original_room_preview_importer",
                       str(HERE / "build-floor-map.py")).load_module()
SOURCES = {
    "stone": ("rock_wall_17", "wall-masonry-01.png"),
    "stone-cut": ("rock_wall_16", "wall-masonry-02.png"),
    "stone-old": ("old_stone_wall", "wall-masonry-03.png"),
}

def build():
    return {style:IMPORTS.import_primary_preview(*item)
            for style,item in SOURCES.items()}

if __name__ == "__main__":
    build()
