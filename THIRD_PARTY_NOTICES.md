# Sources and dependencies

Visual reference: timbercyke, [一颗钻石里藏着多少光？](https://www.bilibili.com/video/BV18YxK6NEPy). The author describes a Godot 3D pixel-art workflow and permits recreation in a public comment. This is attribution of inspiration, not a claim that the original video or assets carry an open-source license. No original video frames, audio, models or shader source are distributed with this app.

The WebGL renderer and GLSL shaders in `src/` are original to this project. No third-party runtime rendering library, font, texture, mesh or shader is required.

Development tools, not bundled into the browser rendering asset:

- [Vite](https://github.com/vitejs/vite), MIT license. Its distribution includes its dependency license notices.
- [Playwright](https://github.com/microsoft/playwright), Apache-2.0 license.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp), Unlicense for its source; some packaged distributions include third-party components under their own terms. Used only for optional media inspection, not included in the Web app.
- FFmpeg and Chromium are environment-installed executables; their respective build and component licenses apply. Neither executable is redistributed by this repository.

Dependency versions are recorded in `package-lock.json` and `requirements-video.txt`. Preserve dependency license notices if redistributing tooling or dependencies.
