import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

test('packed R8 payloads retain the independently verified upstream texture bytes',async()=>{
  for(const [name,length,expected]of[
    ['pattern',65536,'671715318fdac01cfbf9e353f4418e39c6feee4f42499b8eb8986f3f2a6178ca'],
    ['ramp',64,'e9d18b616b1062ea7b0ae19a8f842980beb2acfca3e0de8308144265a08850c5'],
  ]){
    const bytes=await readFile(new URL(`../src/assets/dither3d/${name}.bin`,import.meta.url));
    assert.equal(bytes.length,length);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  }
});
