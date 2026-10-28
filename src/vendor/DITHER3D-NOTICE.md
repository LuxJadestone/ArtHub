# Dither3D

- Author: Rune Skovbo Johansen
- Source: https://github.com/runevision/Dither3D
- Commit: `34fa85832268dc0649aad24b1b4fe07420782724`
- License: Mozilla Public License 2.0; copy at `public/licenses/Dither3D-MPL-2.0.txt`.
- `dither3d.glsl`: GLSL ES adaptation of `Assets/Dither3D/Dither3DInclude.cginc`; grayscale branch, quantized layers and inverse dots. Unity-specific macros and color modes are omitted. Radial compensation is applied by the scene shader.
- `dither-math.js`: companion SVD equations, bottom-up PNG stack unpacking, and resolution scale normalization from `Dither3DGlobalProperties.cs`; MPL-2.0.
- `src/assets/dither3d/pattern.png`: unchanged `Dither3D_4x4.png` from upstream. The WebGL loader converts the bottom-to-top PNG layer stack to a 3D texture.
- `src/assets/dither3d/ramp.png`: unchanged `Dither3D_4x4_Ramp.png` from upstream.

Covered source and modifications are available in this public repository under MPL-2.0. Other ArtHub files are not relicensed by this notice.
