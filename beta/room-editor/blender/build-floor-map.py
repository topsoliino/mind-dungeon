"""Import the EXACT Poly Haven primary-preview image files, without processing.

The user selected these source images by their appearance, not a procedural
reinterpretation. Download and copy PNG bytes unchanged. No recoloring, noise,
contrast, compositing, cropping, sharpening, fake dirt, or JPEG re-encoding.

CC0: https://polyhaven.com/license
  floor-prison-01.png = dark_rock_02
  floor-prison-02.png = coast_sand_rocks_02
  floor-prison-03.png = cobblestone_floor_09

Output belongs ONLY to beta/room-editor/assets/tiles.
"""
from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
from pathlib import Path
import time
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "tiles"
SOURCE_IDS = {
    "dark-rock": ("dark_rock_02", "floor-prison-01.png"),
    "coast-rocks": ("coast_sand_rocks_02", "floor-prison-02.png"),
    "cobblestone": ("cobblestone_floor_09", "floor-prison-03.png"),
}
# Exactly the same Poly Haven *primary preview* family that appeared in the
# material references. Higher-resolution delivery of the same photographed art.
SOURCE_QUERY = "height=2048&quality=95"
USER_AGENT = "MindDungeon-RoomAtelier/3.0 (CC0 source import)"


def import_primary_preview(asset_id: str, filename: str) -> dict:
    url = ("https://cdn.polyhaven.com/asset_img/primary/"
           + asset_id + ".png?" + SOURCE_QUERY)
    result = OUT / filename
    result.parent.mkdir(parents=True, exist_ok=True)
    error = None
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT,
                                            "Accept": "image/png,*/*"})
            with urlopen(request, timeout=90) as response:
                contents = response.read()
            if contents[:8] != b"\x89PNG\r\n\x1a\n" or len(contents) < 100_000:
                raise ValueError("Preview is not a full PNG: " + url)
            with Image.open(BytesIO(contents)) as image:
                image.verify()  # validates ONLY; never modifies pixels
            # Atomic copy of the exact, original CDN PNG bytes.
            temp = result.with_suffix(result.suffix + ".tmp")
            temp.write_bytes(contents)
            temp.replace(result)
            digest = hashlib.sha256(contents).hexdigest()
            print(f"IMPORTED UNCHANGED {asset_id} -> {result} ({len(contents)} bytes, sha256 {digest})",
                  flush=True)
            return {"asset": asset_id, "file": filename, "sha256": digest,
                    "source": url, "sourceType": "Poly Haven primary preview PNG"}
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(2 + attempt * 3)
    raise RuntimeError(f"Cannot import exact Poly Haven photo {asset_id}: {error}")


def build(variant="all"):
    names = SOURCE_IDS if variant == "all" else {variant: SOURCE_IDS[variant]}
    return {name: import_primary_preview(*item) for name,item in names.items()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant",choices=("all",*SOURCE_IDS),default="all")
    parser.add_argument("--output",type=Path,default=None,
                        help="Deprecated: leave blank for original PNG imports.")
    args=parser.parse_args()
    if args.output:
        raise SystemExit("Refusing to transcode or alter original photo bytes; omit --output.")
    build(args.variant)
