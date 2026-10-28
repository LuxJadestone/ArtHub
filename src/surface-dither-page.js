import './directory.css';
import {SurfaceDither,DITHER_DEFAULTS} from './surface-dither.js';

const controls=[
  ['scale','点阵尺度',4,9,.1],['variability','点径变化',0,1,.05],['contrast','点阵对比度',.25,3,.05],['stretch','拉伸补偿',0,2,.1],
  ['distance','相机距离',3.5,14,.1],['exposure','曝光',.3,1.8,.05],['offset','亮度偏移',-.3,.3,.01],
];
document.querySelector('#app').innerHTML=`
<header class="directory-header"><a class="directory-brand" href="../"><span class="directory-mark">▦</span> ArtHub <span>/ 技术目录</span></a><a href="../">← 目录</a></header>
<main class="tool-main"><section class="tool-title"><div><span class="directory-code">02 / 抖动渲染</span><h1>表面稳定分形抖动</h1></div><span>WEBGL 2</span></section>
<section class="tool-layout"><div><div class="raster-stage dither-stage"><div class="raster-toolbar"><span id="mode-name">Surface-Stable Fractal Dithering</span><span>720 × 480</span></div><canvas id="surface-canvas" width="720" height="480" aria-label="表面稳定分形抖动预览"></canvas><div class="scene-controls"><span>拖动：旋转 / 滚轮：距离</span><button id="camera-reset">重置相机</button></div></div><div class="tool-meta"><span>UV / SVD / LOD</span><span>64 × 64 × 16</span><a href="https://github.com/runevision/Dither3D" target="_blank" rel="noreferrer">Dither3D ↗</a></div><div class="dither-error" id="error" role="alert" hidden></div></div>
<aside class="raster-params" aria-label="参数"><h2>参数</h2><label class="parameter" for="mode"><span>模式</span><select id="mode"><option value="0">表面稳定分形</option><option value="1">屏幕 Bayer</option><option value="2">固定表面</option></select></label>${controls.map(([key,label,min,max,step])=>`<label class="parameter" for="${key}"><span>${label}<output id="${key}-value">${DITHER_DEFAULTS[key]}</output></span><input type="range" id="${key}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${DITHER_DEFAULTS[key]}"></label>`).join('')}
<label class="parameter" for="scene"><span>场景</span><select id="scene"><option value="0">几何体</option><option value="1">平面</option></select></label>
<label class="parameter" for="animation"><span>动画</span><select id="animation"><option value="camera">镜头</option><option value="object">物体</option><option value="off">关闭</option></select></label>
${[['quantize','层级量化'],['radial','径向补偿'],['inverse','反相点阵']].map(([key,label])=>`<label class="dither-switch" for="${key}"><span>${label}</span><input type="checkbox" id="${key}" ${DITHER_DEFAULTS[key]?'checked':''}></label>`).join('')}
<div class="tool-buttons"><button id="export" disabled>导出 PNG</button><button id="reset" disabled>重置参数</button></div><output id="status" class="tool-status" aria-live="polite">纹理载入中</output></aside></section>
<footer class="directory-footer"><span>Rune Skovbo Johansen / Dither3D</span><span><a href="https://github.com/LuxJadestone/ArtHub/blob/main/src/vendor/dither3d.glsl" target="_blank" rel="noreferrer">源码</a> / <a href="../licenses/Dither3D-MPL-2.0.txt" target="_blank">MPL-2.0</a></span></footer></main>`;

const canvas=document.querySelector('#surface-canvas');let renderer;
function sync(){
  if(!renderer)return;
  const c=renderer.config;
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
document.querySelector('#animation').addEventListener('change',e=>{if(renderer)renderer.time=0;change({animation:e.target.value});});
for(const key of ['quantize','radial','inverse'])document.getElementById(key).addEventListener('change',e=>change({[key]:e.target.checked}));
document.querySelector('#reset').addEventListener('click',()=>{renderer.time=0;change(DITHER_DEFAULTS);document.querySelector('#status').value='参数已重置';});
document.querySelector('#camera-reset').addEventListener('click',()=>{if(renderer)renderer.time=0;change({yaw:DITHER_DEFAULTS.yaw,pitch:DITHER_DEFAULTS.pitch,distance:DITHER_DEFAULTS.distance});});
let drag;
canvas.addEventListener('pointerdown',e=>{if(!renderer)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);change({animation:'off'});});
canvas.addEventListener('pointermove',e=>{if(!drag||!renderer)return;change({yaw:renderer.config.yaw+(e.clientX-drag[0])*.006,pitch:Math.max(.07,Math.min(1.15,renderer.config.pitch+(e.clientY-drag[1])*.005))});drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointerup',()=>{drag=undefined;});canvas.addEventListener('pointercancel',()=>{drag=undefined;});
canvas.addEventListener('wheel',e=>{if(!renderer)return;e.preventDefault();change({distance:Math.max(3.5,Math.min(14,renderer.config.distance+e.deltaY*.008))});},{passive:false});
document.querySelector('#export').addEventListener('click',()=>{if(!renderer)return;renderer.render();canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='surface-stable-dither.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#status').value='PNG / 720 × 480';},'image/png');});
SurfaceDither.create(canvas).then(result=>{
  renderer=result;canvas.renderer=result;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)renderer.setConfig({animation:'off'});
  sync();document.querySelector('#export').disabled=false;document.querySelector('#reset').disabled=false;document.querySelector('#status').value='64 × 64 × 16';
}).catch(error=>{const box=document.querySelector('#error');box.hidden=false;box.textContent=error.message;document.querySelector('#status').value='渲染失败';});
addEventListener('pagehide',event=>{if(!event.persisted)renderer?.dispose();});
