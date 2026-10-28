#!/usr/bin/env python3
# MPL-2.0: Dither3D PNG-stack packaging glue for ArtHub.
# Upstream textures: Rune Skovbo Johansen, runevision/Dither3D.
"""Pack unchanged upstream PNGs as raw R8 data. Requires Pillow; not a build dependency."""
from hashlib import sha256
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'src/assets/dither3d'
pattern = Image.open(assets / 'pattern.png').convert('RGBA')
assert pattern.size == (64, 1024)
source = pattern.tobytes()
packed = bytes(source[(((16 - z) * 64 - 1 - y) * 64 + x) * 4]
               for z in range(16) for y in range(64) for x in range(64))
assert sha256(packed).hexdigest() == '671715318fdac01cfbf9e353f4418e39c6feee4f42499b8eb8986f3f2a6178ca'
ramp = Image.open(assets / 'ramp.png').convert('RGBA')
assert ramp.size == (64, 1)
ramp_bytes = ramp.tobytes()[::4]
assert sha256(ramp_bytes).hexdigest() == 'e9d18b616b1062ea7b0ae19a8f842980beb2acfca3e0de8308144265a08850c5'
(assets / 'pattern.bin').write_bytes(packed)
(assets / 'ramp.bin').write_bytes(ramp_bytes)
print('pattern.bin: 65536 bytes; ramp.bin: 64 bytes')
