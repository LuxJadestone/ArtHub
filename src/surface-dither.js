import patternURL from './assets/dither3d/pattern.bin?url';
import rampURL from './assets/dither3d/ramp.bin?url';
import {ditherVertex,ditherFragment} from './surface-dither-shader.js';
import {resolutionAdjustedScale} from './vendor/dither-math.js';

export const DITHER_DEFAULTS=Object.freeze({mode:0,scene:0,scale:5.9,referenceHeight:1080,fov:60,variability:0,contrast:1,stretch:1,exposure:1,offset:0,paper:.78,background:.66,distance:4.2,yaw:.42,pitch:.436332,quantize:false,inverse:false,radial:false,samples:2,animation:'off'});
export const LEGACY_DEFAULTS=Object.freeze({...DITHER_DEFAULTS,scene:2,scale:6.2,referenceHeight:480,fov:45,distance:7.5,pitch:.32,radial:true,samples:1,animation:'camera'});

async function textureBytes(url,length){
  const response=await fetch(url);if(!response.ok)throw new Error(`纹理 HTTP ${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==length)throw new Error('点阵纹理数据不匹配');
  return bytes;
}

export class SurfaceDither {
  static async create(canvas,config=DITHER_DEFAULTS){
    const images=await Promise.all([textureBytes(patternURL,65536),textureBytes(rampURL,64)]);
    return new SurfaceDither(canvas,...images,config);
  }
  constructor(canvas,pattern,ramp,config=DITHER_DEFAULTS){
    this.canvas=canvas;this.config={...DITHER_DEFAULTS,...config};this.time=0;this.last=undefined;this.disposed=false;
    const gl=this.gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL 2 不可用');
    this.maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    const vs=compile(gl.VERTEX_SHADER,ditherVertex),fs=compile(gl.FRAGMENT_SHADER,ditherFragment);
    this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    const resolveFS=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
uniform sampler2D uSceneColor;
out vec4 outputColor;
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy)*2;
 outputColor=(texelFetch(uSceneColor,p,0)+texelFetch(uSceneColor,p+ivec2(1,0),0)+texelFetch(uSceneColor,p+ivec2(0,1),0)+texelFetch(uSceneColor,p+ivec2(1,1),0))*.25;
}`);
    const resolveVS=compile(gl.VERTEX_SHADER,ditherVertex);
    this.resolveProgram=gl.createProgram();gl.attachShader(this.resolveProgram,resolveVS);gl.attachShader(this.resolveProgram,resolveFS);gl.linkProgram(this.resolveProgram);gl.deleteShader(resolveVS);gl.deleteShader(resolveFS);
    if(!gl.getProgramParameter(this.resolveProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.resolveProgram));
    this.resolveUniform=gl.getUniformLocation(this.resolveProgram,'uSceneColor');
    this.sceneFramebuffer=gl.createFramebuffer();this.sceneColor=gl.createTexture();this.sceneSize=[0,0];
    this.vao=gl.createVertexArray();
    this.uniforms={};for(const name of ['Resolution','Jitter','SampleScale','OutputWeight','Mode','Scene','Scale','Fov','Variability','Contrast','Stretch','Paper','Background','Exposure','Offset','Distance','Yaw','Pitch','ObjectAngle','Quantize','Inverse','Radial','Pattern','Ramp'])this.uniforms[name]=gl.getUniformLocation(this.program,'u'+name);
    const bytes=pattern,size=64,layers=16;
    this.patternData=bytes;this.patternSize=size;this.patternLayers=layers;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    this.patternTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.patternTexture);
    gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,size,size,layers,0,gl.RED,gl.UNSIGNED_BYTE,bytes);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
    this.rampTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rampTexture);
    const rampData=ramp;
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,ramp.length,1,0,gl.RED,gl.UNSIGNED_BYTE,rampData);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.render();this.tick(performance.now());
  }
  setConfig(patch){Object.assign(this.config,patch);this.render();}
  render(){
    if(this.disposed||this.gl.isContextLost())return;
    const {gl,config:c,uniforms:u,canvas}=this;
    const maxTexture=this.maxTextureSize;
    const samples=c.samples===2?2:1;
    const offscreen=samples===2&&canvas.width*2<=maxTexture&&canvas.height*2<=maxTexture&&canvas.width*canvas.height*4<=16777216;
    const accumulate=samples===2&&!offscreen;
    this.samplesUsed=samples;this.samplingPath=offscreen?'framebuffer':accumulate?'accumulate':'single';
    const width=canvas.width*(offscreen?2:1),height=canvas.height*(offscreen?2:1);
    if(offscreen){
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.sceneColor);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.sceneFramebuffer);
      if(this.sceneSize[0]!==width||this.sceneSize[1]!==height){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.sceneColor,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('采样缓冲区不可用');
        this.sceneSize=[width,height];
      }
    }else gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,width,height);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.patternTexture);gl.uniform1i(u.Pattern,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rampTexture);gl.uniform1i(u.Ramp,1);
    gl.uniform2f(u.Resolution,width,height);
    gl.uniform2f(u.Jitter,0,0);gl.uniform1f(u.SampleScale,accumulate?2:1);gl.uniform1f(u.OutputWeight,accumulate?.25:1);
    for(const [uniform,key]of [['Paper','paper'],['Background','background'],['Variability','variability'],['Contrast','contrast'],['Stretch','stretch'],['Exposure','exposure'],['Offset','offset'],['Distance','distance'],['Pitch','pitch']])gl.uniform1f(u[uniform],c[key]);
    gl.uniform1f(u.Scale,resolutionAdjustedScale(c.scale,canvas.height*samples,c.referenceHeight));
    gl.uniform1f(u.Fov,2*Math.tan(c.fov*Math.PI/360));
    gl.uniform1f(u.Yaw,c.yaw+(c.animation==='camera'?this.time*.16:0));
    gl.uniform1f(u.ObjectAngle,c.animation==='object'?this.time*.28:0);
    gl.uniform1i(u.Mode,c.mode);
    gl.uniform1i(u.Scene,c.scene);
    for(const [uniform,key]of [['Quantize','quantize'],['Inverse','inverse'],['Radial','radial']])gl.uniform1i(u[uniform],Number(c[key]));
    if(accumulate){
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
      for(const [x,y]of [[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]]){gl.uniform2f(u.Jitter,x,y);gl.drawArrays(gl.TRIANGLES,0,3);}
      gl.disable(gl.BLEND);
    }else gl.drawArrays(gl.TRIANGLES,0,3);
    if(offscreen){
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
      gl.useProgram(this.resolveProgram);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.sceneColor);gl.uniform1i(this.resolveUniform,2);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }
  tick(now){
    if(this.disposed)return;
    if(this.last===undefined)this.last=now;
    if(now-this.last>=1000/30){this.time+=Math.min((now-this.last)/1000,.1);this.last=now;if(this.config.animation!=='off')this.render();}
    this.raf=requestAnimationFrame(t=>this.tick(t));
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.raf);const gl=this.gl;gl.deleteProgram(this.program);gl.deleteProgram(this.resolveProgram);gl.deleteFramebuffer(this.sceneFramebuffer);gl.deleteTexture(this.sceneColor);gl.deleteTexture(this.patternTexture);gl.deleteTexture(this.rampTexture);gl.deleteVertexArray(this.vao);}
}
