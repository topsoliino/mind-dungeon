"""Save the original UV-ready flat Diffuse maps for all 3 dungeon walls.

NO cropped presentation previews, custom direction rotations, fake seams,
or postprocessing. The 3D wall face supplies the proper vertical orientation.
"""
from pathlib import Path
from importlib.machinery import SourceFileLoader

HERE=Path(__file__).resolve().parent
floor=SourceFileLoader("room_atelier_uv_importer",str(HERE/"build-floor-map.py")).load_module()
WALLS={
 "stone":("rock_wall_17","wall-albedo-01.jpg"),
 "stone-cut":("rock_wall_16","wall-albedo-02.jpg"),
 "stone-old":("old_stone_wall","wall-albedo-03.jpg"),
}

def build():
    return {key:floor.import_diffuse(*source) for key,source in WALLS.items()}

if __name__=="__main__":
    for style,metadata in build().items():
        print("WALL",style,metadata,flush=True)
