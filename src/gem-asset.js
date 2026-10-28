import { DEFAULT_CONFIG, validateConfig, presetConfig } from './gem-config.js';
import { vertexShader, fragmentShader } from './gem-shader.js';
import { createShapeGeometry } from './gem-shapes.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Standalone renderer: no framework, network calls, external meshes or textures. */
export class GemAsset {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.config = validateConfig(options);
    this.time = 0;
    this.yaw = 0;
    this.playing = true;
    this.disposed = false;
    this.last = null;
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error('此浏览器不支持 WebGL 2，请启用硬件加速或更换浏览器');
    this.initialize();
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(canvas);
    this.onLost = (event) => { event.preventDefault(); cancelAnimationFrame(this.raf); };
    this.onRestored = () => { this.initialize(); this.last = null; this.tick(performance.now()); };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.tick(performance.now());
  }

  initialize() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShader);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    this.uniforms = new Map();
    const names = ['Resolution', 'PlaneCount', 'Bounces', 'Seed', 'Time', 'Yaw', 'Tilt', 'Ior', 'Dispersion', 'Absorption', 'Exposure', 'Color', 'Background', 'Outlines', 'Caustics', 'Transparent', 'Mesh', 'TriangleCount', 'TriangleTexture'];
    for (const name of names) this.uniforms.set(name, gl.getUniformLocation(this.program, `u${name}`));
    this.uniforms.set('Planes', gl.getUniformLocation(this.program, 'uPlanes[0]'));
    this.vao = gl.createVertexArray();
    this.triangleTexture = gl.createTexture();
    this.geometryKey = null;
  }

  setConfig(patch) {
    const next = validateConfig({ ...this.config, ...patch });
    this.config = next;
    this.render();
    return this.getConfig();
  }

  getConfig() { return { ...this.config }; }
  setPlaying(value) { this.playing = Boolean(value); this.last = null; }
  rotate(delta) { this.yaw += delta; this.render(); }

  tick(now) {
    if (this.disposed) return;
    if (this.last === null) this.last = now;
    const elapsed = Math.min((now - this.last) / 1000, 0.1);
    if (this.playing && now - this.last >= 1000 / 30) {
      this.time += elapsed * this.config.speed;
      this.last = now;
      this.render();
    }
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  render({ transparent = false, time = this.time, yaw = this.yaw, square = false } = {}) {
    if (this.disposed || this.gl.isContextLost()) return;
    const { gl, canvas, config: c } = this;
    const aspect = square ? 1 : Math.max(0.2, canvas.clientWidth / (canvas.clientHeight || canvas.clientWidth || 1));
    const height = c.pixels;
    const width = Math.round(height * aspect);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    const f = (key, value) => gl.uniform1f(this.uniforms.get(key), value);
    const i = (key, value) => gl.uniform1i(this.uniforms.get(key), value);
    gl.uniform2f(this.uniforms.get('Resolution'), width, height);
    const key = `${c.cut}:${c.shape}`;
    if (key !== this.geometryKey) {
      this.geometry = createShapeGeometry(c.cut,c.shape); this.geometryKey = key;
      const triangles = this.geometry.triangles;
      const data = new Float32Array(Math.max(3,triangles.length/3)*4);
      for(let n=0;n<triangles.length/3;n++) data.set(triangles.subarray(n*3,n*3+3),n*4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.triangleTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,3,Math.max(1,triangles.length/9),0,gl.RGBA,gl.FLOAT,data);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    const { planes,triangles,mesh }=this.geometry;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.triangleTexture);
    i('TriangleTexture',0); i('TriangleCount',triangles.length/9); i('Mesh',Number(mesh));
    gl.uniform4fv(this.uniforms.get('Planes'), planes);
    i('PlaneCount', planes.length / 4); i('Bounces', c.bounces); i('Seed', c.seed);
    f('Time', time); f('Yaw', yaw); f('Tilt', c.tilt); f('Ior', c.ior);
    f('Dispersion', c.dispersion); f('Absorption', c.absorption); f('Exposure', c.exposure);
    gl.uniform3fv(this.uniforms.get('Color'), rgb(c.color));
    gl.uniform3fv(this.uniforms.get('Background'), rgb(c.background));
    i('Outlines', Number(c.outlines)); i('Caustics', Number(c.caustics)); i('Transparent', Number(transparent));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  exportPNG({ transparent = true, scale = 4 } = {}) {
    if (!Number.isInteger(scale) || scale < 1 || scale > 8) throw new Error('scale 必须为 1–8 的整数');
    this.render({ transparent, square: true });
    const output = document.createElement('canvas');
    output.width = this.canvas.width * scale; output.height = this.canvas.height * scale;
    const context = output.getContext('2d'); context.imageSmoothingEnabled = false;
    context.drawImage(this.canvas, 0, 0, output.width, output.height);
    this.render();
    return output;
  }

  exportSpriteSheet({ frames = 24, columns = 6 } = {}) {
    if (!Number.isInteger(frames) || frames < 2 || frames > 48 || !Number.isInteger(columns) || columns < 1 || columns > frames) throw new Error('无效的序列帧尺寸');
    const size = this.config.pixels;
    const output = document.createElement('canvas');
    output.width = size * columns; output.height = size * Math.ceil(frames / columns);
    const context = output.getContext('2d');
    for (let n = 0; n < frames; n++) {
      this.render({ transparent: true, time: this.time, yaw: this.yaw + n * 2 * Math.PI / frames, square: true });
      context.drawImage(this.canvas, (n % columns) * size, Math.floor(n / columns) * size);
    }
    this.render();
    return { canvas: output, metadata: { version: 1, frames, columns, rows: Math.ceil(frames / columns), frameWidth: size, frameHeight: size, fps: 12, config: this.getConfig() } };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.raf); this.observer.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.gl.deleteProgram(this.program); this.gl.deleteVertexArray(this.vao); this.gl.deleteTexture(this.triangleTexture);
  }
}

/** <pixel-gem preset="ruby"> is a drop-in, self-contained Web Component. */
export class PixelGemElement extends HTMLElement {
  static observedAttributes = ['preset'];
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() {
    if (this.asset) return;
    const generation = this.generation = (this.generation || 0) + 1;
    this.shadowRoot.innerHTML = `<style>:host{display:block;width:100%;height:100%;min-height:160px}canvas{display:block;width:100%;height:100%;image-rendering:pixelated}</style><canvas aria-label="旋转的像素宝石"></canvas>`;
    queueMicrotask(() => {
      if (!this.isConnected || generation !== this.generation) return;
      try {
        const preset = this.getAttribute('preset') || 'ruby';
        this.asset = new GemAsset(this.shadowRoot.querySelector('canvas'), this._config || presetConfig(preset));
        this.dispatchEvent(new CustomEvent('gem-ready'));
      } catch (error) {
        this.shadowRoot.textContent = error.message;
        this.dispatchEvent(new CustomEvent('gem-error', { detail: error.message }));
      }
    });
  }
  attributeChangedCallback(name, previous, next) {
    if (this.asset && name === 'preset' && previous !== next) {
      this.asset.setConfig(presetConfig(next, this.asset.config));
    }
  }
  set config(value) { this._config = validateConfig(value); this.asset?.setConfig(this._config); }
  get config() { return this.asset?.getConfig() || this._config || { ...DEFAULT_CONFIG }; }
  disconnectedCallback() { this.generation = (this.generation || 0) + 1; this._config = this.asset?.getConfig() || this._config; this.asset?.dispose(); this.asset = null; }
}

if (!customElements.get('pixel-gem')) customElements.define('pixel-gem', PixelGemElement);
