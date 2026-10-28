import test from 'node:test';
import assert from 'node:assert/strict';
import {singularFrequencies,unpackPatternStack} from '../src/vendor/dither-math.js';

test('UV singular frequencies are invariant under screen rotation',()=>{
  const first=singularFrequencies([.03,0],[0,.01]);
  assert.ok(Math.abs(first[0]-.03)<1e-9);assert.ok(Math.abs(first[1]-.01)<1e-9);
  const a=.71,c=Math.cos(a),s=Math.sin(a);
  const rotated=singularFrequencies([.03*c,.01*s],[-.03*s,.01*c]);
  assert.ok(Math.abs(first[0]-rotated[0])<1e-9);assert.ok(Math.abs(first[1]-rotated[1])<1e-9);
});

test('doubling the surface footprint moves by one power-of-two level',()=>{
  const a=singularFrequencies([.02,0],[0,.02])[1],b=singularFrequencies([.04,0],[0,.04])[1];
  assert.ok(Math.abs(Math.log2(b/a)-1)<1e-9);
});

test('PNG stack unpacking preserves bottom-up slice and row order',()=>{
  const width=64,height=1024,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data[(y*width+x)*4]=(y*3+x)%251;
  const {bytes,size,layers}=unpackPatternStack({width,height,data});
  assert.equal(size,64);assert.equal(layers,16);
  assert.equal(bytes[0],(1023*3)%251);
  assert.equal(bytes[63],(1023*3+63)%251);
  assert.equal(bytes[64],(1022*3)%251);
  assert.equal(bytes[15*64*64+63*64],0);
  assert.throws(()=>unpackPatternStack({width:32,height:32,data}));
});
