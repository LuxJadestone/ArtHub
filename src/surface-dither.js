import patternURL from './assets/dither3d/pattern.png';
import rampURL from './assets/dither3d/ramp.png';
import {ditherVertex,ditherFragment} from './surface-dither-shader.js';
import {unpackPatternStack,resolutionAdjustedScale} from './vendor/dither-math.js';

export const DITHER_DEFAULTS=Object.freeze({mode:0,scene:0,scale:5.9,referenceHeight:1080,fov:60,variability:0,contrast:1,stretch:1,exposure:1,offset:0,distance:4.2,yaw:.42,pitch:.436332,quantize:false,inverse:false,radial:false,animation:'off'});
export const LEGACY_DEFAULTS=Object.freeze({...DITHER_DEFAULTS,scene:2,scale:6.2,referenceHeight:480,fov:45,distance:7.5,pitch:.32,radial:true,animation:'camera'});

async function imageData(url){
  const response=await fetch(url);if(!response.ok)throw new Error(`纹理 HTTP ${response.status}`);
  const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none'});
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);bitmap.close();
  return context.getImageData(0,0,canvas.width,canvas.height);
}

export class SurfaceDither {
  static async create(canvas,config=DITHER_DEFAULTS){
    const images=await Promise.all([imageData(patternURL),imageData(rampURL)]);
    return new SurfaceDither(canvas,...images,config);
  }
  constructor(canvas,pattern,ramp,config=DITHER_DEFAULTS){
    this.canvas=canvas;this.config={...DITHER_DEFAULTS,...config};this.time=0;this.last=undefined;this.disposed=false;
    const gl=this.gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL 2 不可用');
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    const vs=compile(gl.VERTEX_SHADER,ditherVertex),fs=compile(gl.FRAGMENT_SHADER,ditherFragment);
    this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    this.vao=gl.createVertexArray();
    this.uniforms={};for(const name of ['Resolution','Mode','Scene','Scale','Fov','Variability','Contrast','Stretch','Exposure','Offset','Distance','Yaw','Pitch','ObjectAngle','Quantize','Inverse','Radial','Pattern','Ramp'])this.uniforms[name]=gl.getUniformLocation(this.program,'u'+name);
    const {bytes,size,layers}=unpackPatternStack(pattern);
    this.patternData=bytes;this.patternSize=size;this.patternLayers=layers;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    this.patternTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.patternTexture);
    gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,size,size,layers,0,gl.RED,gl.UNSIGNED_BYTE,bytes);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
    this.rampTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rampTexture);
    const rampData=new Uint8Array(ramp.width);for(let x=0;x<ramp.width;x++)rampData[x]=ramp.data[x*4];
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,ramp.width,1,0,gl.RED,gl.UNSIGNED_BYTE,rampData);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.render();this.tick(performance.now());
  }
  setConfig(patch){Object.assign(this.config,patch);this.render();}
  render(){
    if(this.disposed||this.gl.isContextLost())return;
    const {gl,config:c,uniforms:u,canvas}=this;
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.patternTexture);gl.uniform1i(u.Pattern,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rampTexture);gl.uniform1i(u.Ramp,1);
    gl.uniform2f(u.Resolution,canvas.width,canvas.height);
    for(const [uniform,key]of [['Variability','variability'],['Contrast','contrast'],['Stretch','stretch'],['Exposure','exposure'],['Offset','offset'],['Distance','distance'],['Pitch','pitch']])gl.uniform1f(u[uniform],c[key]);
    gl.uniform1f(u.Scale,resolutionAdjustedScale(c.scale,canvas.height,c.referenceHeight));
    gl.uniform1f(u.Fov,2*Math.tan(c.fov*Math.PI/360));
    gl.uniform1f(u.Yaw,c.yaw+(c.animation==='camera'?this.time*.16:0));
    gl.uniform1f(u.ObjectAngle,c.animation==='object'?this.time*.28:0);
    gl.uniform1i(u.Mode,c.mode);
    gl.uniform1i(u.Scene,c.scene);
    for(const [uniform,key]of [['Quantize','quantize'],['Inverse','inverse'],['Radial','radial']])gl.uniform1i(u[uniform],Number(c[key]));
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  tick(now){
    if(this.disposed)return;
    if(this.last===undefined)this.last=now;
    if(now-this.last>=1000/30){this.time+=Math.min((now-this.last)/1000,.1);this.last=now;if(this.config.animation!=='off')this.render();}
    this.raf=requestAnimationFrame(t=>this.tick(t));
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.raf);const gl=this.gl;gl.deleteProgram(this.program);gl.deleteTexture(this.patternTexture);gl.deleteTexture(this.rampTexture);gl.deleteVertexArray(this.vao);}
}
