/* Copyright (c) 2025 Rune Skovbo Johansen.
 * GLSL companion math and texture-layout glue for ArtHub, 2026.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. https://mozilla.org/MPL/2.0/
 */
export function singularFrequencies(dx,dy){
  const q=dx[0]**2+dx[1]**2+dy[0]**2+dy[1]**2,r=dx[0]*dy[1]-dx[1]*dy[0],d=Math.sqrt(Math.max(0,q*q-4*r*r));
  return [Math.sqrt(Math.max(1e-12,(q+d)/2)),Math.sqrt(Math.max(1e-12,(q-d)/2))];
}

// Dither3DGlobalProperties.cs: normalized to the authored reference resolution.
export function resolutionAdjustedScale(scale,height,referenceHeight=1080){
  return scale+Math.log2(Math.max(1,height)/referenceHeight);
}

export function unpackPatternStack(pattern){
  const size=pattern.width,layers=pattern.height/size;
  if(size!==64||layers!==16)throw new Error('点阵纹理尺寸不匹配');
  const bytes=new Uint8Array(size*size*layers);
  for(let z=0;z<layers;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++)bytes[(z*size+y)*size+x]=pattern.data[(((layers-z)*size-1-y)*size+x)*4];
  return{bytes,size,layers};
}
