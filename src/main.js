import './style.css';
import './gem-asset.js';
import { PRESETS, SHAPES, DEFAULT_CONFIG, presetConfig, validateConfig } from './gem-config.js';

const icon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 4h16l6 10-14 15L2 14 8 4Z M2 14h28M8 4l8 25L24 4M8 4l8 10 8-10" stroke="currentColor" stroke-width="1.2"/></svg>`;
document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="../">${icon}<span>ArtHub<span class="brand-slash"> / </span><strong>技术目录</strong></span></a><span class="top-note">3D 渲染 <span class="small-dot"></span> 01</span><a class="source-link" href="https://www.bilibili.com/video/BV18YxK6NEPy" target="_blank" rel="noreferrer">参考 <span>↗</span></a></header>
<main>
 <section class="intro"><div><p class="eyebrow">3D / PIXEL</p><h1>像素宝石</h1></div><div class="edition"><span>WEBGL 2</span><strong>01</strong></div></section>
 <section class="workspace" aria-label="宝石工作室">
  <div class="stage-column">
   <div class="stage" id="stage">
    <div class="stage-header"><span class="stage-pill"><i></i> 预览</span><span class="stage-code" id="material-code">ROUND / 192 PX</span></div>
    <pixel-gem preset="ruby" id="gem"></pixel-gem>
    <div class="gem-label"><span id="gem-formula">Al₂O₃ : Cr</span><h2 id="gem-name">Ruby<span>红宝石</span></h2><p id="gem-caption">圆形</p></div>
    <div class="stage-bottom"><span class="drag-hint">↔ 拖动旋转 · 空格暂停</span><div><button id="reset-view" class="stage-button" aria-label="重置视角" title="重置视角">↺</button><button id="play" class="stage-button" aria-label="暂停动画" title="暂停动画">Ⅱ</button></div></div>
    <div id="render-error" class="render-error" role="alert" hidden></div>
   </div>
   <div class="collection shape-collection"><div class="section-heading"><h2>形状 <span class="new-tag">07</span></h2><button id="shape-front" class="text-button">正面视角 ↗</button></div><div class="shapes" role="group" aria-label="宝石形状">${Object.entries(SHAPES).map(([id,s])=>`<button class="shape-card ${id==='round'?'active':''}" data-shape="${id}" aria-pressed="${id==='round'}"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="${s.path}" stroke="currentColor" stroke-width="1.2"/></svg><span>${s.name}<small>${s.english}</small></span></button>`).join('')}</div></div>
   <div class="collection"><div class="section-heading"><h2>材质</h2><span>05</span></div><div class="presets" role="group" aria-label="宝石预设">${Object.entries(PRESETS).map(([id, p], index) => `<button class="preset ${id === 'ruby' ? 'active' : ''}" data-preset="${id}" aria-pressed="${id === 'ruby'}"><span class="gem-swatch" style="--gem:${p.color}">${icon}</span><span class="preset-name">${p.name}<small>${p.english}</small></span><span class="preset-index">0${index + 1}</span></button>`).join('')}</div></div>
  </div>
  <aside class="inspector" aria-label="资产参数">
   <div class="inspector-heading"><div><p class="eyebrow">PARAMETERS</p><h2>参数</h2></div><button id="reset" class="text-button">重置 ↺</button></div>
   <div class="craft-controls"><div class="craft-heading"><span>切面模式</span><button id="new-gem" class="text-button">变体 ↻</button></div><div class="craft-choices" role="group" aria-label="切面模式"><button data-craft="0.75" aria-pressed="true">非对称<small>0.75</small></button><button data-craft="0" aria-pressed="false">对称<small>0.00</small></button></div><p id="seed-value">Seed 7</p></div>
   <fieldset><legend><span>01</span> 形态与颜色</legend><label class="select-label" for="shape">形状 <select id="shape" data-param="shape">${Object.entries(SHAPES).map(([id,s])=>`<option value="${id}">${s.name} · ${s.english}</option>`).join('')}</select></label><label class="select-label cut-label" for="cut">切工 <select id="cut" data-param="cut"><option value="brilliant">明亮式 · Brilliant</option><option value="emerald">阶梯式 · Emerald</option><option value="cushion">枕形式 · Cushion</option></select></label><label class="color-label" for="color"><span>晶体颜色</span><span class="color-value"><output id="color-value">#EF3158</output><input type="color" id="color" data-param="color" value="#ef3158" aria-label="晶体颜色"></span></label></fieldset>
   <fieldset><legend><span>02</span> 光学</legend>
    ${slider('ior', '折射率', 1.05, 2.6, 0.01, 1.77)}
    ${slider('dispersion', '色散', 0, 0.12, 0.001, 0.035)}
    ${slider('absorption', '吸收系数', 0, 3, 0.05, 1.15)}
    ${slider('bounces', '反射次数', 1, 8, 1, 6)}
   </fieldset>
   <fieldset><legend><span>03</span> 显示</legend>
    ${slider('pixels', '分辨率', 96, 480, 16, 192)}
    ${slider('speed', '旋转速度', 0, 1.5, 0.05, 0.45)}
    ${slider('exposure', '曝光', 0.4, 2.5, 0.05, 1.25)}
    <div class="switch-row"><label for="outlines">切面描边</label><input type="checkbox" role="switch" id="outlines" data-param="outlines" checked></div><div class="switch-row"><label for="caustics">彩色焦散 <small>风格化</small></label><input type="checkbox" role="switch" id="caustics" data-param="caustics" checked></div>
   </fieldset>
   <div class="asset-box"><div><span class="asset-dot"></span> 导出</div><button id="export-png" class="primary-button">透明 PNG <span>↗</span></button><div class="export-row"><button id="export-config">↓ 参数 JSON</button><button id="export-sheet">↓ 序列帧图集</button></div><button id="import-config" class="import-button">导入 JSON ↗</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>
  </aside>
 </section>
 <footer><span>ArtHub / 3D 渲染</span><span>参考：timbercyke / Godot</span></footer>
</main><div class="toast" id="toast" role="status" aria-live="polite"></div>`;

function slider(id, label, min, max, step, value) {
  return `<div class="slider-control"><label for="${id}">${label}<output id="${id}-value">${value}</output></label><input id="${id}" data-param="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" title="${label}: ${min}–${max}"></div>`;
}

const gem = document.querySelector('#gem');
const toast = document.querySelector('#toast');
let playing = true;
let toastTimer;
function message(text) { toast.textContent = text; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500); }

function sync() {
  const config = gem.config;
  const preset = PRESETS[config.preset];
  for (const input of document.querySelectorAll('[data-param]')) {
    const value = config[input.dataset.param];
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    const output = document.getElementById(`${input.id}-value`);
    if (output) output.value = input.type === 'color' ? value.toUpperCase() : Number(value).toFixed(input.id === 'dispersion' ? 3 : Number.isInteger(value) ? 0 : 2);
    if (input.type === 'range') input.style.setProperty('--progress', `${(value - input.min) / (input.max - input.min) * 100}%`);
  }
  document.querySelector('#gem-name').replaceChildren(document.createTextNode(preset.english), Object.assign(document.createElement('span'), { textContent: preset.name }));
  document.querySelector('#gem-formula').textContent = preset.formula;
  document.querySelector('#material-code').textContent = `${SHAPES[config.shape].english.toUpperCase()} / ${config.pixels} PX`;
  document.querySelector('#gem-caption').textContent = SHAPES[config.shape].name;
  document.querySelector('#seed-value').textContent = `Seed ${config.seed}`;
  for(const button of document.querySelectorAll('[data-shape]')) {
    const selected=button.dataset.shape===config.shape;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  }
  for(const button of document.querySelectorAll('[data-craft]')){
    const selected=(Number(button.dataset.craft)>0)===(config.craft>0);
    button.setAttribute('aria-pressed',String(selected));
  }
  for (const button of document.querySelectorAll('[data-preset]')) {
    const selected = button.dataset.preset === config.preset;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  }
  document.querySelector('#stage').style.backgroundColor = config.background;
}

gem.addEventListener('gem-ready', () => {
  const initialShape=new URLSearchParams(location.search).get('shape');
  if(initialShape&&Object.hasOwn(SHAPES,initialShape)) gem.asset.setConfig({shape:initialShape});
  sync();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && playing) togglePlay();
});
gem.addEventListener('gem-error', (event) => {
  const error = document.querySelector('#render-error'); error.hidden = false; error.textContent = event.detail;
  for (const button of document.querySelectorAll('[id^="export-"]')) button.disabled = true;
});
document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => {
  if (!gem.asset) return;
  gem.asset.setConfig(presetConfig(button.dataset.preset, gem.config)); sync();
}));
document.querySelectorAll('[data-param]').forEach((input) => input.addEventListener('input', () => {
  if (!gem.asset) return;
  const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
  if(input.dataset.param==='shape') { changeShape(value); return; }
  gem.asset.setConfig({ [input.dataset.param]: value }); sync();
}));

function changeShape(shape) {
  if(!gem.asset)return;
  gem.asset.time=0;gem.asset.yaw=0;gem.asset.setConfig({shape});
  updateShapeLink();
  sync();
}
function updateShapeLink(){const url=new URL(location.href);url.searchParams.set('shape',gem.config.shape);history.replaceState(null,'',url);}
document.querySelectorAll('[data-shape]').forEach(button=>button.addEventListener('click',()=>changeShape(button.dataset.shape)));
document.querySelectorAll('[data-craft]').forEach(button=>button.addEventListener('click',()=>{gem.asset?.setConfig({craft:Number(button.dataset.craft)});sync();}));
document.querySelector('#new-gem').addEventListener('click',()=>{
  if(!gem.asset)return;
  gem.asset.setConfig({craft:gem.config.craft||.75,seed:(gem.config.seed+1)%10000});sync();
  message(`Seed ${gem.config.seed}`);
});
document.querySelector('#shape-front').addEventListener('click',()=>{
  if(!gem.asset)return;
  if(playing)togglePlay();
  gem.asset.time=0;gem.asset.yaw=0;gem.asset.setConfig({tilt:0});sync();
});

function togglePlay() {
  if (!gem.asset) return;
  playing = !playing; gem.asset.setPlaying(playing);
  const button = document.querySelector('#play'); button.textContent = playing ? 'Ⅱ' : '▷';
  button.setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
}
document.querySelector('#play').addEventListener('click', togglePlay);
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A'].includes(event.target.tagName)) { event.preventDefault(); togglePlay(); }
});
document.querySelector('#reset-view').addEventListener('click', () => { if (gem.asset) { gem.asset.yaw = 0; gem.asset.time = 0; gem.asset.render(); } });
document.querySelector('#reset').addEventListener('click', () => { gem.asset?.setConfig(DEFAULT_CONFIG); updateShapeLink(); sync(); message('已恢复红宝石默认参数'); });

let drag;
gem.addEventListener('pointerdown', (e) => { if (!gem.asset) return; drag = e.clientX; gem.setPointerCapture(e.pointerId); gem.classList.add('dragging'); });
gem.addEventListener('pointermove', (e) => { if (drag === undefined) return; gem.asset?.rotate((e.clientX - drag) * .012); drag = e.clientX; });
const endDrag = () => { drag = undefined; gem.classList.remove('dragging'); };
gem.addEventListener('pointerup', endDrag); gem.addEventListener('pointercancel', endDrag);

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const jsonDownload = (data, filename) => download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
const assetName = () => `${gem.config.preset}${gem.config.shape==='round'?'':'.'+gem.config.shape}`;
const pngDownload = (canvas, filename) => canvas.toBlob((blob) => { if (blob) download(blob, filename); else message('图片导出失败'); }, 'image/png');
document.querySelector('#export-config').addEventListener('click', () => { jsonDownload(gem.config, `${assetName()}.gem.json`); message('JSON 已导出'); });
document.querySelector('#export-png').addEventListener('click', () => {
  if (!gem.asset) return;
  pngDownload(gem.asset.exportPNG(), `${assetName()}.png`); message('已导出透明背景 PNG（4 倍像素缩放）');
});
document.querySelector('#export-sheet').addEventListener('click', async () => {
  if (!gem.asset) return;
  const button = document.querySelector('#export-sheet'); button.disabled = true;
  message('正在生成 24 帧旋转图集…');
  await new Promise((resolve) => setTimeout(resolve, 40));
  try {
    const result = gem.asset.exportSpriteSheet();
    pngDownload(result.canvas, `${assetName()}.sprites.png`);
    jsonDownload(result.metadata, `${assetName()}.sprites.json`);
    message('图集与帧信息已导出：6 列 × 4 行，24 帧');
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
document.querySelector('#import-config').addEventListener('click', () => document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 65536) throw new Error('参数文件过大，请选择小于 64 KB 的 JSON');
    const config = validateConfig(JSON.parse(await file.text()));
    if (!gem.asset) throw new Error('渲染器未就绪');
    gem.asset.setConfig(config); updateShapeLink(); sync(); message('配方已载入');
  } catch (error) { message(`无法导入：${error.message}`); }
  event.target.value = '';
});
sync();
