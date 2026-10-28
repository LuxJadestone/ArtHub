import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, PRESETS, validateConfig, presetConfig, createCut } from '../src/gem-config.js';

test('all presets produce bounded convex cuts and serializable configurations', () => {
  for (const id of Object.keys(PRESETS)) {
    const config = presetConfig(id);
    assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(config))), config);
    const planes = createCut(config.cut);
    assert.ok(planes.length / 4 <= 64);
    for (let n = 0; n < planes.length; n += 4) {
      assert.ok(Math.abs(Math.hypot(...planes.slice(n, n + 3)) - 1) < 1e-6);
      assert.ok(planes[n + 3] > 0, 'origin lies within every plane');
    }
    // Each signed axis must leave the finite convex volume.
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      assert.ok(Array.from({ length: planes.length / 4 }, (_, n) => planes[n * 4 + axis] * sign).some((dot) => dot > .1));
    }
  }
});

test('invalid external values are rejected rather than silently poisoning the shader', () => {
  for (const input of [null, [], { version: 2 }, { ior: NaN }, { ior: 9 }, { pixels: 200.5 }, { cut: 'other' }, { preset: 'constructor' }, { color: 'red' }, { outlines: 'false' }, { seed: Infinity }]) {
    assert.throws(() => validateConfig(input));
  }
});

test('unknown properties are discarded and caller objects remain unchanged', () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"speed":0,"extra":"ignored"}');
  const result = validateConfig(input);
  assert.equal(result.speed, 0);
  assert.equal(result.extra, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(input.extra, 'ignored');
  assert.equal(DEFAULT_CONFIG.speed, .45);
});
