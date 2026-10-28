import './directory.css';
import {SurfaceDither,DITHER_DEFAULTS,LEGACY_DEFAULTS} from './surface-dither.js';

let defaults=new URLSearchParams(location.search).get('preset')==='reference'?DITHER_DEFAULTS:LEGACY_DEFAULTS;

let resolution=defaults===DITHER_DEFAULTS?'native':'720';
const previewSize=()=>defaults===DITHER_DEFAULTS?[960,540]:[720,480];
const controls=[
  ['scale','点阵尺度',3,9,.1],['variability','点径变化',0,1,.05],['contrast','点阵对比度',.25,3,.05],['stretch','拉伸补偿',0,2,.1],
  ['distance','相机距离',3,14,.1],['fov','视场角',35,80,1],['exposure','曝光',.3,1.8,.05],['offset','亮度偏移',-.3,.3,.01],
];
document.querySelector('#app').innerHTML=`
<header class="directory-header"><a class="directory-brand" href="../"><span class="directory-mark">▦</span> ArtHub <span>/ 技术目录</span></a><a href="../">← 目录</a></header>
<main class="tool-main"><section class="tool-title"><div><span class="directory-code">02 / 抖动渲染</span><h1>表面稳定分形抖动</h1></div><span>WEBGL 2</span></section>
<section class="tool-layout"><div><div class="raster-stage dither-stage"><div class="raster-toolbar"><span id="mode-name">Surface-Stable Fractal Dithering</span><span id="preview-resolution">${previewSize().join(' × ')}</span></div><canvas id="surface-canvas" width="${previewSize()[0]}" height="${previewSize()[1]}" aria-label="表面稳定分形抖动预览"></canvas><div class="scene-controls"><span>拖动：旋转 / 滚轮：距离</span><button id="fullscreen">全屏</button><button id="copy-config">复制参数</button><button id="camera-reset">重置相机</button></div></div><div class="tool-meta"><span>UV / SVD / LOD</span><span>64 × 64 × 16</span><a href="https://github.com/runevision/Dither3D" target="_blank" rel="noreferrer">Dither3D ↗</a></div><div class="dither-error" id="error" role="alert" hidden></div></div>
<aside class="raster-params" aria-label="参数"><h2>参数</h2><label class="parameter" for="preset"><span>预设</span><select id="preset" disabled><option value="legacy">原演示</option><option value="reference">参考校准</option></select></label><label class="parameter" for="resolution"><span>分辨率</span><select id="resolution"><option value="native">自动 / DPR</option><option value="720">720 × 480</option><option value="960">960 × 540</option><option value="1920">1920 × 1080</option></select></label><label class="parameter" for="samples"><span>像素采样<output id="samples-used"></output></span><select id="samples"><option value="1">1 × 1</option><option value="2">2 × 2</option></select></label><div class="preset-resolution">基准高度 <output id="reference-height">1080</output> px</div><label class="parameter" for="mode"><span>模式</span><select id="mode"><option value="0">表面稳定分形</option><option value="1">屏幕 Bayer</option><option value="2">固定表面</option></select></label>${controls.map(([key,label,min,max,step])=>`<label class="parameter" for="${key}"><span>${label}<output id="${key}-value">${defaults[key]}</output></span><input type="range" id="${key}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${defaults[key]}"></label>`).join('')}
<label class="parameter" for="scene"><span>场景</span><select id="scene"><option value="0">参考几何体</option><option value="1">平面</option><option value="2">墙面场景</option></select></label>
<label class="parameter" for="animation"><span>动画</span><select id="animation"><option value="camera">镜头</option><option value="object">物体</option><option value="off">关闭</option></select></label>
${[['quantize','层级量化'],['radial','径向补偿'],['inverse','反相点阵']].map(([key,label])=>`<label class="dither-switch" for="${key}"><span>${label}</span><input type="checkbox" id="${key}" ${DITHER_DEFAULTS[key]?'checked':''}></label>`).join('')}
<div class="tool-buttons"><button id="export" disabled>导出 PNG</button><button id="reset" disabled>重置参数</button></div><output id="status" class="tool-status" aria-live="polite">纹理载入中</output></aside></section>
<footer class="directory-footer"><span>Rune Skovbo Johansen / Dither3D</span><span><a href="https://github.com/LuxJadestone/ArtHub/blob/main/src/vendor/dither3d.glsl" target="_blank" rel="noreferrer">源码</a> / <a href="../licenses/Dither3D-MPL-2.0.txt" target="_blank">MPL-2.0</a></span></footer></main>`;

const canvas=document.querySelector('#surface-canvas');let renderer;
function fitCanvas(){
  const aspect=resolution==='720'?1.5:resolution==='native'?(defaults===DITHER_DEFAULTS?16/9:1.5):16/9;
  canvas.style.aspectRatio=String(aspect);canvas.closest('.dither-stage').style.setProperty('--dither-aspect',aspect);
  const width=resolution==='native'?Math.max(1,Math.round(canvas.getBoundingClientRect().width*devicePixelRatio)):Number(resolution);
  const height=Math.max(1,Math.round(width/aspect));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  if(renderer){renderer.displayScale=Math.max(1,width/Math.max(1,canvas.getBoundingClientRect().width*devicePixelRatio));renderer.render();}
  document.querySelector('#samples-used').value=renderer?`${renderer.samplesUsed} × ${renderer.samplesUsed}`:'';
  document.querySelector('#preview-resolution').textContent=`${width} × ${height} / DPR ${devicePixelRatio}`;
}
const resizeObserver=new ResizeObserver(fitCanvas);resizeObserver.observe(canvas);
addEventListener('resize',fitCanvas);
document.querySelector('#resolution').addEventListener('change',e=>{resolution=e.target.value;fitCanvas();});
document.querySelector('#samples').addEventListener('change',e=>change({samples:Number(e.target.value)}));
document.querySelector('#copy-config').addEventListener('click',async()=>{
  if(!renderer)return;
  const data={config:renderer.config,resolution,canvas:[canvas.width,canvas.height],displayWidth:canvas.getBoundingClientRect().width,dpr:devicePixelRatio,samples:renderer.samplesUsed,browser:navigator.userAgent};
  try{await navigator.clipboard.writeText(JSON.stringify(data,null,2));document.querySelector('#status').value='参数已复制';}
  catch{document.querySelector('#status').value='复制失败';}
});
document.querySelector('#fullscreen').addEventListener('click',async()=>{
  const stage=document.querySelector('.dither-stage'),button=document.querySelector('#fullscreen');button.disabled=true;
  try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}
  catch{document.querySelector('#app main').classList.toggle('dither-expanded');fitCanvas();}
  finally{button.disabled=false;}
});
document.addEventListener('fullscreenchange',()=>{document.querySelector('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏';fitCanvas();});
fitCanvas();
function sync(){
  if(!renderer)return;
  const c=renderer.config;
  document.querySelector('#preset').value=defaults===DITHER_DEFAULTS?'reference':'legacy';
  document.querySelector('#reference-height').value=c.referenceHeight;
  document.querySelector('#samples-used').value=`${renderer.samplesUsed} × ${renderer.samplesUsed}`;
  document.querySelector('#resolution').value=resolution;document.querySelector('#samples').value=String(c.samples);
  for(const [key]of controls){document.getElementById(key).value=c[key];document.getElementById(`${key}-value`).value=Number(c[key]).toFixed(Number.isInteger(c[key])?0:2);}
  document.querySelector('#mode').value=String(c.mode);document.querySelector('#scene').value=String(c.scene);document.querySelector('#animation').value=c.animation;
  for(const key of ['quantize','radial','inverse'])document.getElementById(key).checked=c[key];
  for(const key of ['variability','contrast','stretch','quantize','radial'])document.getElementById(key).disabled=c.mode!==0;
  document.querySelector('#mode-name').textContent=['Surface-Stable Fractal Dithering','Screen-Space Bayer','Fixed Surface Pattern'][c.mode];
}
function change(patch){if(renderer){renderer.setConfig(patch);sync();}}
document.querySelectorAll('[data-key]').forEach(input=>input.addEventListener('input',()=>change({[input.dataset.key]:Number(input.value)})));
document.querySelector('#mode').addEventListener('change',e=>change({mode:Number(e.target.value)}));
document.querySelector('#scene').addEventListener('change',e=>change({scene:Number(e.target.value)}));
document.querySelector('#preset').addEventListener('change',e=>{
  defaults=e.target.value==='reference'?DITHER_DEFAULTS:LEGACY_DEFAULTS;
  resolution=defaults===DITHER_DEFAULTS?'native':'720';fitCanvas();
  if(renderer)renderer.time=0;change(defaults);
  const url=new URL(location.href);if(e.target.value==='reference')url.searchParams.set('preset','reference');else url.searchParams.delete('preset');history.replaceState(null,'',url);
});
document.querySelector('#animation').addEventListener('change',e=>{if(renderer)renderer.time=0;change({animation:e.target.value});});
for(const key of ['quantize','radial','inverse'])document.getElementById(key).addEventListener('change',e=>change({[key]:e.target.checked}));
document.querySelector('#reset').addEventListener('click',()=>{renderer.time=0;change(defaults);document.querySelector('#status').value='参数已重置';});
document.querySelector('#camera-reset').addEventListener('click',()=>{if(renderer)renderer.time=0;change({yaw:defaults.yaw,pitch:defaults.pitch,distance:defaults.distance,fov:defaults.fov});});
let drag;
canvas.addEventListener('pointerdown',e=>{if(!renderer)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);change({animation:'off'});});
canvas.addEventListener('pointermove',e=>{if(!drag||!renderer)return;change({yaw:renderer.config.yaw+(e.clientX-drag[0])*.006,pitch:Math.max(.07,Math.min(1.15,renderer.config.pitch+(e.clientY-drag[1])*.005))});drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointerup',()=>{drag=undefined;});canvas.addEventListener('pointercancel',()=>{drag=undefined;});
canvas.addEventListener('wheel',e=>{if(!renderer)return;e.preventDefault();change({distance:Math.max(3,Math.min(14,renderer.config.distance+e.deltaY*.008))});},{passive:false});
document.querySelector('#export').addEventListener('click',()=>{if(!renderer)return;renderer.render();canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='surface-stable-dither.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#status').value=`PNG / ${canvas.width} × ${canvas.height}`;},'image/png');});
SurfaceDither.create(canvas,defaults).then(result=>{
  renderer=result;canvas.renderer=result;fitCanvas();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)renderer.setConfig({animation:'off'});
  sync();document.querySelector('#preset').disabled=false;document.querySelector('#export').disabled=false;document.querySelector('#reset').disabled=false;document.querySelector('#status').value='64 × 64 × 16';
}).catch(error=>{const box=document.querySelector('#error');box.hidden=false;box.textContent=error.message;document.querySelector('#status').value='渲染失败';});
addEventListener('pagehide',event=>{if(!event.persisted){resizeObserver.disconnect();renderer?.dispose();}});
