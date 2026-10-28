# Sources and dependencies

Visual reference: timbercyke, [一颗钻石里藏着多少光？](https://www.bilibili.com/video/BV18YxK6NEPy). The author describes a Godot 3D pixel-art workflow and permits recreation in a public comment. This is attribution of inspiration, not a claim that the original video or assets carry an open-source license. No original video frames, audio, models or shader source are distributed with this app.

The pixel-gem renderer and GLSL shaders are original to this project. No third-party runtime rendering library, font or external model is required.

## Surface-Stable Fractal Dithering

[Dither3D](https://github.com/runevision/Dither3D), Copyright (c) 2025 Rune Skovbo Johansen, Mozilla Public License 2.0. Upstream commit: `34fa85832268dc0649aad24b1b4fe07420782724`.

ArtHub includes a GLSL ES adaptation at `src/vendor/dither3d.glsl`, companion math at `src/vendor/dither-math.js`, and the unchanged 4×4 pattern and brightness-ramp PNGs at `src/assets/dither3d/`. These files and their modifications are available in this public repository under MPL-2.0. The complete license is distributed at `public/licenses/Dither3D-MPL-2.0.txt` and deployed at `licenses/Dither3D-MPL-2.0.txt`. See `src/vendor/DITHER3D-NOTICE.md` for file-level provenance. The rest of ArtHub is not relicensed by this notice.

Development tools, not bundled into the browser rendering asset:

- [Vite](https://github.com/vitejs/vite), MIT license. Its distribution includes its dependency license notices.
- [Playwright](https://github.com/microsoft/playwright), Apache-2.0 license.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp), Unlicense for its source; some packaged distributions include third-party components under their own terms. Used only for optional media inspection, not included in the Web app.
- FFmpeg and Chromium are environment-installed executables; their respective build and component licenses apply. Neither executable is redistributed by this repository.

Dependency versions are recorded in `package-lock.json` and `requirements-video.txt`. Preserve dependency license notices if redistributing tooling or dependencies.

The Dither3D raw `pattern.bin` and `ramp.bin` assets are repackaged bytes of the same upstream textures under MPL-2.0. `tools/pack-dither.py` records the extraction and checksums.
