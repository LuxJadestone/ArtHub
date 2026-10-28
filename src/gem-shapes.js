import { SHAPES } from './gem-config.js';

const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const turn = (a, b, c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

export function shapeOutline(shape) {
  if (!Object.hasOwn(SHAPES, shape)) throw new Error('未知形状');
  if (shape === 'heart') return [[0,-1.12],[.57,-.57],[.96,.04],[.98,.57],[.66,.97],[.30,.98],[0,.49],[-.30,.98],[-.66,.97],[-.98,.57],[-.96,.04],[-.57,-.57]];
  if (shape === 'pear') return [[0,1.18],[-.42,.55],[-.73,.03],[-.82,-.44],[-.62,-.85],[-.30,-1.04],[.30,-1.04],[.62,-.85],[.82,-.44],[.73,.03],[.42,.55]];
  if (shape === 'rectangle') return [[-.58,-1.09],[.58,-1.09],[.78,-.89],[.78,.89],[.58,1.09],[-.58,1.09],[-.78,.89],[-.78,-.89]];
  if (shape === 'marquise') return [[0,-1.24],[.48,-.68],[.66,0],[.48,.68],[0,1.24],[-.48,.68],[-.66,0],[-.48,-.68]];
  if (shape === 'crystal') return [[0,-1.23],[.62,-.65],[.62,.65],[0,1.23],[-.62,.65],[-.62,-.65]];
  return Array.from({ length: 12 }, (_, i) => {
    const a = i * 2 * Math.PI / 12;
    return [Math.cos(a) * (shape === 'oval' ? .78 : 1), Math.sin(a) * (shape === 'oval' ? 1.16 : 1)];
  });
}

// Ear clipping handles the heart's concave notch without filling it with a fan.
function triangulate(points) {
  const indices = points.map((_, i) => i); const result = [];
  const inside = (p, a, b, c) => turn(a,b,p)>=-1e-8 && turn(b,c,p)>=-1e-8 && turn(c,a,p)>=-1e-8;
  while (indices.length > 3) {
    let clipped = false;
    for (let i=0; i<indices.length; i++) {
      const a=indices[(i+indices.length-1)%indices.length], b=indices[i], c=indices[(i+1)%indices.length];
      if (turn(points[a],points[b],points[c])<=1e-8) continue;
      if (indices.some((k)=>k!==a&&k!==b&&k!==c&&inside(points[k],points[a],points[b],points[c]))) continue;
      result.push([a,b,c]); indices.splice(i,1); clipped=true; break;
    }
    if (!clipped) throw new Error('轮廓无法三角化');
  }
  result.push(indices); return result;
}

export function createShapeGeometry(cut, shape = 'round') {
  const contour = shapeOutline(shape), count = contour.length;
  const table = cut === 'emerald' ? .76 : cut === 'cushion' ? .48 : .59;
  const front = contour.map(([x,y]) => [x*table,y*table,.42]);
  const topScale = cut === 'emerald' ? .55 : cut === 'cushion' ? .20 : .28;
  const top = contour.map(([x,y]) => [x*topScale,y*topScale,.51]);
  const back = contour.map(([x,y]) => [x*.22,y*.22,-.62]);
  const rim = contour.map(([x,y]) => [x,y,0]);
  const triangles=[];
  const add=(a,b,c)=>triangles.push([...a,...b,...c]);
  for (const [a,b,c] of triangulate(contour)) { add(top[a],top[b],top[c]); add(back[c],back[b],back[a]); }
  for (let i=0; i<count; i++) {
    const j=(i+1)%count;
    add(rim[i],rim[j],front[j]); add(rim[i],front[j],front[i]);
    add(front[i],front[j],top[j]); add(front[i],top[j],top[i]);
    add(rim[j],rim[i],back[i]); add(rim[j],back[i],back[j]);
  }
  const planes=[];
  for (const tri of triangles) {
    const a=tri.slice(0,3),b=tri.slice(3,6),c=tri.slice(6,9);
    const normal=cross(sub(b,a),sub(c,a)); const length=Math.hypot(...normal);
    const n=normal.map(v=>v/length); const plane=[...n,n.reduce((sum,v,i)=>sum+v*a[i],0)];
    if (!planes.some(p=>p.every((v,i)=>Math.abs(v-plane[i])<1e-5))) planes.push(plane);
  }
  if (planes.length>64) throw new Error('切面数量超出限制');
  return { planes: new Float32Array(planes.flat()), triangles: new Float32Array(triangles.flat()), mesh: shape === 'heart' };
}
