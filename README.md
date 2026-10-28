# ArtHub

计算机图形艺术实验仓库：3D 渲染、像素画和程序化视觉效果。

## GEM LAB：实时像素宝石

部署地址（启用 GitHub Pages 后生效）：**https://luxjadestone.github.io/ArtHub/**。推送到 `main` 后，`.github/workflows/pages.yml` 自动运行测试、构建并部署到 GitHub Pages；URL 保持不变。部署进度和错误可在仓库的 Actions 页面查看。

首次启用：进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。创建 Pages 站点需要管理权限；当前云端 GitHub 集成的 Pages 创建操作返回 403，需要仓库拥有者在设置中启用。启用后重新运行部署 workflow，或者推送下一次代码更新。不要将 `node_modules`、视频参考或整个源码目录作为静态网站上传；workflow 只部署构建后的 `dist/`。

Pages 构建设置 `BASE_PATH=/ArtHub/`，本地开发默认根路径。独立组件示例部署在 `/ArtHub/examples/embed.html`；可复用模块部署在 `/ArtHub/asset/gem-lab.js`。发布产物仅含 `dist/`，不包含下载的视频、开发依赖或本地证据文件。

第一个 Web 作品是可参数化的 3D 像素宝石工作室。独立 WebGL 2 着色器实现凸多面体切工、折射、内部反射和近似色散；低分辨率渲染与切面描边形成像素画风格。

参考 timbercyke 的 [Godot 宝石动画](https://www.bilibili.com/video/BV18YxK6NEPy)。已读取公开预览和作者评论，具体证据与复现边界见 [视频参考记录](docs/video-reference.md)。地面彩色焦散是风格化近似，不是物理光子追踪。未复制原视频或作者代码。

### 运行

需要 Node.js 20.19+ 或 22.12+（当前验证 Node.js 24）、npm、支持 WebGL 2 的浏览器。

```bash
npm ci
npm run dev
```

打开终端显示的开发服务地址。工作室提供红宝石、祖母绿、蓝宝石、紫水晶、钻石预设，以及切工、颜色、折射率、色散、吸收深度、反射次数、像素精度、旋转速度、光照和描边控制。拖动旋转；空格暂停（输入框及按钮获得焦点时保持原生键盘行为）。遵循系统减少动态效果偏好。

### 可复用资产

- **参数配方**：导出 / 导入版本化 JSON；不合法的参数会被拒绝。
- **透明 PNG**：导出当前视角，使用最近邻放大 4 倍，保留像素边缘。
- **序列帧图集**：24 帧、6 列 × 4 行的透明 PNG，附帧尺寸、12 FPS 建议播放速率及参数 JSON。固定倾角与焦散相位，仅围绕竖直轴旋转一圈以形成循环；不会捕捉鼠标交互轨迹。浏览器可能询问是否允许一次下载多个文件。
- **Web Component**：开发时查看 `/examples/embed.html`，亦随生产构建输出。`<pixel-gem>` 不依赖 UI 框架；移除元素时释放动画和 GPU 资源。
- **独立 ES 模块**：`npm run build` 输出完整站点到 `dist/`，另输出约 15 KB 未压缩的 `dist/asset/gem-lab.js`。复制该模块到其他 Web 项目即可使用，运行时无外部贴图、模型、字体或第三方网络请求。

```html
<div style="width:400px;height:400px">
  <pixel-gem id="gem" preset="ruby"></pixel-gem>
</div>
<script type="module">
  import { presetConfig } from './gem-lab.js';
  const gem = document.querySelector('#gem');
  gem.addEventListener('gem-ready', () => {
    gem.config = { ...presetConfig('sapphire'), pixels: 192, speed: 0.3 };
  });
</script>
```

底层 API：`new GemAsset(canvas, config)`、`setConfig(patch)`、`getConfig()`、`setPlaying(bool)`、`rotate(radians)`、`exportPNG()`、`exportSpriteSheet()`、`dispose()`。直接使用 class 时需给 canvas 设置 CSS 宽高。

### 构建与检查

```bash
npm run build
npm run preview
npm test
npm run test:web
```

浏览器集成测试使用环境中的 `/usr/bin/chromium`；其他机器设置 `CHROMIUM_PATH`。测试真实 WebGL 像素变化、透明导出、图集变化、参数校验、拖动、暂停和移动端布局。纯软件 WebGL 会比硬件 GPU 慢；手机可降低像素精度和反射次数。`dist/`、测试结果和截图均被 Git 忽略。

第三方工具与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 视频参考分析

仓库内置 Codex skill：`.agents/skills/video-understanding/SKILL.md`。
它把视频提取为带时间索引的采样图片，再由 Codex 的图片读取能力分析。
不是只读取字幕，也不是逐帧连续观看。独立运行脚本仅生成素材，不会自动生成理解报告，不需要模型 API key。

需要 Python 3.10+、FFmpeg（含 ffprobe）。本地视频无需 Python 第三方依赖：

```bash
python tools/video_inspect.py /path/to/video.mp4 --output artifacts/video/demo
# 细看某个片段；输出目录必须为空或不存在
python tools/video_inspect.py /path/to/video.mp4 --start 10 --end 15 --interval 0.5 --output artifacts/video/detail
```

公开视频链接额外需要 yt-dlp：

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements-video.txt
.venv/bin/python tools/video_inspect.py 'https://www.bilibili.com/video/BV...' --output artifacts/video/online
```

B 站及其他平台的支持受网站变化、登录状态和网络策略影响。默认不读取浏览器 cookies；无法下载时使用你有权提供的本地视频。URL 下载最多等待 10 分钟，限制单个下载文件为 500MB（分离音视频可能各自达到限制）。

当 B 站页面结构导致 yt-dlp 提取失败，但普通浏览器能播放时，可通过正常浏览器捕获公开预览和已加载的评论（需要 `npm ci` 及 Chromium）：

```bash
node tools/bili_preview.mjs 'https://www.bilibili.com/video/BV18YxK6NEPy' --output artifacts/video/bili-new
```

该工具严格限制在公开预览的前 30 秒，不绕过登录或验证码，不读取私人浏览器身份；不会声称看过完整视频。

输出 `manifest.json`、采样 JPG，以及下载到的字幕。`--audio` 可导出音频，但不会自动转写或听懂。默认每约 5 秒采样，最多 24 张；达到上限会加大间距。需要先让 Codex 实际打开图片，再形成分析。短暂动作可能遗漏，时间戳为近似定位。

使用示例：“使用 video-understanding 分析这个视频的 10–20 秒，解释粒子和辉光效果如何实现。”

生成素材保存在被 Git 忽略的 `artifacts/` 中，不随 Web 应用构建发布。

验证：`python -m unittest discover -s tests -v`。集成测试生成真实视频，检查采样范围、音频时长、输出保护和无效参数；不需要联网。
