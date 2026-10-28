import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, PRESETS, SHAPES, validateConfig, presetConfig, createCut } from '../src/gem-config.js';
import { createShapeGeometry } from '../src/gem-shapes.js';

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
  for (const input of [null, [], { version: 2 }, { ior: NaN }, { ior: 9 }, { pixels: 200.5 }, { cut: 'other' }, { shape: 'constructor' }, { preset: 'constructor' }, { color: 'red' }, { outlines: 'false' }, { seed: Infinity }]) {
    assert.throws(() => validateConfig(input));
  }
});

test('all new shapes are closed outward-facing meshes; convex planes contain their vertices', () => {
  for (const shape of Object.keys(SHAPES)) for(const cut of ['brilliant','emerald','cushion']) {
    const {planes,triangles,mesh}=createShapeGeometry(cut,shape);
    assert.ok(planes.length/4<=64);assert.ok(triangles.length/9<=128);
    assert.equal(mesh,shape==='heart');
    let volume=0;const edges=new Map();
    const key=v=>v.map(n=>n.toFixed(5)).join(',');
    for(let i=0;i<triangles.length;i+=9){
      const a=[...triangles.slice(i,i+3)],b=[...triangles.slice(i+3,i+6)],c=[...triangles.slice(i+6,i+9)];
      volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
      for(const [v,w] of [[a,b],[b,c],[c,a]]){const k=[key(v),key(w)].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}
      if(!mesh)for(const v of [a,b,c])for(let p=0;p<planes.length;p+=4)assert.ok(v[0]*planes[p]+v[1]*planes[p+1]+v[2]*planes[p+2]<=planes[p+3]+1e-5,`${shape}/${cut} vertex outside plane`);
    }
    assert.ok(volume>0,`${shape}/${cut} orientation`);
    assert.ok([...edges.values()].every(n=>n===2),`${shape}/${cut} must be watertight`);
  }
});

test('shape recipes preserve material changes and old recipes default to round',()=>{
  assert.equal(validateConfig({version:1,color:'#123456'}).shape,'round');
  const config=validateConfig({...DEFAULT_CONFIG,shape:'heart'});
  assert.equal(presetConfig('emerald',config).shape,'heart');
  assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(config))),config);
});

test('hand-cut geometry is reproducible, seeded and valid across shape families',()=>{
  for(const shape of Object.keys(SHAPES)) {
    const first=createShapeGeometry('brilliant',shape,.75,7);
    const repeated=createShapeGeometry('brilliant',shape,.75,7);
    const next=createShapeGeometry('brilliant',shape,.75,8);
    assert.deepEqual(first.triangles,repeated.triangles);
    assert.notDeepEqual(first.triangles,next.triangles);
    assert.ok(first.planes.length/4<=64);
    assert.ok(first.triangles.length/9<=128);
    const regular=createShapeGeometry('brilliant',shape,0,7);
    assert.notDeepEqual(first.triangles,regular.triangles);
  }
  for(const seed of [0,1,9999])for(const cut of ['brilliant','emerald','cushion']){
    const {planes,triangles}=createShapeGeometry(cut,'round',.75,seed);
    for(let i=0;i<triangles.length;i+=3)for(let p=0;p<planes.length;p+=4)
      assert.ok(triangles[i]*planes[p]+triangles[i+1]*planes[p+1]+triangles[i+2]*planes[p+2]<=planes[p+3]+1e-5);
  }
  assert.throws(()=>validateConfig({craft:2}));
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
