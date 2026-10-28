export const PRESETS = Object.freeze({
  ruby: { name: '红宝石', english: 'Ruby', formula: 'Al₂O₃ : Cr', color: '#ef3158', ior: 1.77, dispersion: 0.035, cut: 'brilliant' },
  emerald: { name: '祖母绿', english: 'Emerald', formula: 'Be₃Al₂Si₆O₁₈', color: '#20bc82', ior: 1.58, dispersion: 0.025, cut: 'emerald' },
  sapphire: { name: '蓝宝石', english: 'Sapphire', formula: 'Al₂O₃ : Fe, Ti', color: '#4569f5', ior: 1.77, dispersion: 0.04, cut: 'brilliant' },
  amethyst: { name: '紫水晶', english: 'Amethyst', formula: 'SiO₂ : Fe', color: '#b369e8', ior: 1.55, dispersion: 0.05, cut: 'cushion' },
  diamond: { name: '钻石', english: 'Diamond', formula: 'C', color: '#dce9ef', ior: 2.42, dispersion: 0.075, cut: 'brilliant' },
});

export const SHAPES = Object.freeze({
  round: { name: '圆形', english: 'Round', path: 'M16 3A13 13 0 1 1 15.99 3Z' },
  oval: { name: '椭圆形', english: 'Oval', path: 'M16 2C30 2 30 30 16 30C2 30 2 2 16 2Z' },
  rectangle: { name: '长方形', english: 'Rectangle', path: 'M9 2H23L27 6V26L23 30H9L5 26V6Z' },
  pear: { name: '梨形', english: 'Pear', path: 'M16 2C13 9 5 16 5 22A11 9 0 0 0 27 22C27 16 19 9 16 2Z' },
  marquise: { name: '马眼形', english: 'Marquise', path: 'M16 1Q-3 16 16 31Q35 16 16 1Z' },
  heart: { name: '心形', english: 'Heart', path: 'M16 9C7-5-6 8 5 19L16 30L27 19C38 8 25-5 16 9Z' },
  crystal: { name: '晶柱形', english: 'Crystal', path: 'M16 1L25 8V24L16 31L7 24V8Z' },
});

export const DEFAULT_CONFIG = Object.freeze({
  version: 1, preset: 'ruby', color: PRESETS.ruby.color, cut: 'brilliant',
  shape: 'round',
  craft: 0.75,
  ior: 1.77, dispersion: 0.035, absorption: 1.15, bounces: 6,
  pixels: 192, speed: 0.45, exposure: 1.25, tilt: 0.32,
  outlines: true, caustics: true, background: '#dedbd5', seed: 7,
});

const ranges = {
  craft: [0, 1],
  ior: [1.05, 2.6], dispersion: [0, 0.12], absorption: [0, 3],
  bounces: [1, 8], pixels: [96, 480], speed: [0, 1.5], exposure: [0.4, 2.5],
  tilt: [-0.8, 0.8], seed: [0, 9999],
};

/** Validate external JSON as data, never merge unknown properties into instances. */
export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('配置必须是 JSON 对象');
  if (input.version !== undefined && input.version !== 1) throw new Error('不支持的配置版本');
  const result = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(result)) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (ranges[key]) {
      const [min, max] = ranges[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${key} 必须在 ${min}–${max} 之间`);
      if (['bounces', 'pixels', 'seed'].includes(key) && !Number.isInteger(value)) throw new Error(`${key} 必须为整数`);
    } else if (['color', 'background'].includes(key)) {
      if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error(`${key} 必须是六位 HEX 颜色`);
    } else if (key === 'shape') {
      if (!Object.hasOwn(SHAPES, value)) throw new Error('未知形状');
    } else if (key === 'cut') {
      if (!['brilliant', 'emerald', 'cushion'].includes(value)) throw new Error('未知切工');
    } else if (key === 'preset') {
      if (!Object.hasOwn(PRESETS, value)) throw new Error('未知预设');
    } else if (['outlines', 'caustics'].includes(key) && typeof value !== 'boolean') throw new Error(`${key} 必须是布尔值`);
    result[key] = value;
  }
  return result;
}

export function presetConfig(id, current = DEFAULT_CONFIG) {
  if (!Object.hasOwn(PRESETS, id)) throw new Error('未知预设');
  const { color, ior, dispersion, cut } = PRESETS[id];
  return validateConfig({ ...current, preset: id, color, ior, dispersion, cut });
}

/** A convex cut expressed as outward planes: dot(normal, point) <= distance. */
export function createCut(cut) {
  const planes = [];
  const add = (x, y, z, d) => {
    const length = Math.hypot(x, y, z);
    planes.push(x / length, y / length, z / length, d / length);
  };
  const sides = cut === 'cushion' ? 12 : 8;
  const ring = (h, y, d, offset = 0) => {
    for (let i = 0; i < sides; i++) {
      const a = (i + offset) * 2 * Math.PI / sides;
      const stretch = cut === 'emerald' ? 0.78 : 1;
      add(Math.cos(a) * h / stretch, y, Math.sin(a) * h, d);
    }
  };
  add(0, 1, 0, 0.62);
  add(0, -1, 0, 0.8);
  ring(1, 0, 0.98);
  ring(0.78, 0.65, 0.95);
  ring(0.92, 0.30, 1.01, 0.5);
  ring(0.74, -0.72, 0.85);
  ring(0.91, -0.34, 0.94, 0.5);
  return new Float32Array(planes);
}
