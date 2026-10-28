# Dither3D

- Author: Rune Skovbo Johansen
- Source: https://github.com/runevision/Dither3D
- Commit: `34fa85832268dc0649aad24b1b4fe07420782724`
- License: Mozilla Public License 2.0; copy at `public/licenses/Dither3D-MPL-2.0.txt`.
- `dither3d.glsl`: GLSL ES adaptation of `Assets/Dither3D/Dither3DInclude.cginc`; grayscale branch, quantized layers and inverse dots. Unity-specific macros and color modes are omitted. Radial compensation is applied by the scene shader. ArtHub additionally uses determinant-based minor singular values to avoid cancellation; these are local additions, not a claim about the upstream implementation.
- `dither-math.js`: companion SVD equations, bottom-up PNG stack unpacking, and resolution scale normalization from `Dither3DGlobalProperties.cs`; MPL-2.0.
- `src/assets/dither3d/pattern.png`: unchanged `Dither3D_4x4.png` from upstream. The offline packer converts its bottom-to-top layer stack to `pattern.bin`; the WebGL loader fetches raw R8 bytes without Canvas extraction.
- `src/assets/dither3d/ramp.png`: unchanged `Dither3D_4x4_Ramp.png` from upstream. `ramp.bin` contains its 64 red-channel bytes.
- `src/assets/dither3d/pattern.bin`: the original 65536 Unity texture bytes, packaged from the unchanged PNG by `tools/pack-dither.py`; MPL-2.0. The tool also retains the original ramp bytes.

Covered source and modifications are available in this public repository under MPL-2.0. Other ArtHub files are not relicensed by this notice.
