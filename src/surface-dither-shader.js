import ditherCore from './vendor/dither3d.glsl?raw';

export const ditherVertex=`#version 300 es
precision highp float;
const vec2 corners[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
void main(){gl_Position=vec4(corners[gl_VertexID],0.,1.);}
`;

export const ditherFragment=`#version 300 es
precision highp float;
precision highp sampler3D;
out vec4 outputColor;
uniform vec2 uResolution,uJitter;
uniform float uSampleScale,uOutputWeight;
uniform float uYaw,uPitch,uDistance,uObjectAngle,uExposure,uOffset,uFov,uPaper,uBackground;
uniform int uMode,uScene;
uniform bool uRadial;
${ditherCore}

mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
bool sphere(vec3 ro,vec3 rd,vec3 center,float radius,out float t,out vec3 normal){
 vec3 q=ro-center;float b=dot(q,rd),c=dot(q,q)-radius*radius,h=b*b-c;
 if(h<0.)return false;
 t=-b-sqrt(h);if(t<.001)return false;normal=normalize(q+rd*t);return true;
}
bool box(vec3 ro,vec3 rd,vec3 halfSize,out float t,out vec3 normal){
 vec3 safe=sign(rd+vec3(1e-10))*max(abs(rd),vec3(1e-7));
 vec3 a=(-halfSize-ro)/safe,b=(halfSize-ro)/safe;
 vec3 lo=min(a,b),hi=max(a,b);
 t=max(lo.x,max(lo.y,lo.z));float exitT=min(hi.x,min(hi.y,hi.z));
 if(t>exitT||t<.001)return false;
 vec3 p=(ro+rd*t)/halfSize,ap=abs(p);
 if(ap.x>ap.y&&ap.x>ap.z)normal=vec3(sign(p.x),0.,0.);
 else if(ap.y>ap.z)normal=vec3(0.,sign(p.y),0.);
 else normal=vec3(0.,0.,sign(p.z));
 return true;
}

// Reconstruction of the geometric introduction, not the later game scene.
bool referenceScene(vec3 ro,vec3 rd,out vec3 point,out vec3 normal,out vec2 uv,out float material){
 float nearest=1e6,t;vec3 n;normal=vec3(0.,1.,0.);uv=vec2(0.);material=1.;
 if(abs(rd.y)>.00001){t=(-1.-ro.y)/rd.y;vec3 floorPoint=ro+rd*t;if(t>.001&&max(abs(floorPoint.x),abs(floorPoint.z))<10.){nearest=t;uv=floorPoint.xz;}}
 for(int j=0;j<2;j++){
  vec3 center=j==0?vec3(.75,0.,-.45):vec3(1.,1.25,-.45);
  float radius=j==0?1.:.28;
  if(sphere(ro,rd,center,radius,t,n)&&t<nearest){nearest=t;normal=n;material=2.;uv=vec2(atan(n.z,n.x),asin(clamp(n.y,-1.,1.)));}
 }
 for(int j=0;j<3;j++){
  vec3 center=j==0?vec3(-.45,-.35,.65):j==1?vec3(-1.05,-.15,-.55):vec3(-1.05,1.08,-.55);
  vec3 halfSize=j==0?vec3(1.1,.65,.75):j==1?vec3(.55,.85,.55):vec3(.42,.38,.42);
  mat3 rotation=rotateY((j==0?-.55:j==2?.20:0.)+uObjectAngle);
  vec3 localRo=transpose(rotation)*(ro-center),localRd=transpose(rotation)*rd;
  if(box(localRo,localRd,halfSize,t,n)&&t<nearest){
   nearest=t;normal=rotation*n;material=3.;vec3 p=localRo+localRd*t;
   uv=abs(n.x)>.5?p.zy:abs(n.y)>.5?p.xz:p.xy;
  }
 }
 point=ro+rd*nearest;return nearest<1e5;
}

bool scene(vec3 ro,vec3 rd,out vec3 point,out vec3 normal,out vec2 uv,out float material){
 if(uScene==1){
  float planeT=-ro.z/(abs(rd.z)<.00001?.00001:rd.z);
  point=ro+rd*planeT;normal=vec3(0.,0.,sign(ro.z));uv=point.xy;material=6.;return planeT>.001;
 }
 if(uScene==0)return referenceScene(ro,rd,point,normal,uv,material);
 float nearest=1e6,t;vec3 n;material=0.;uv=vec2(0.);normal=vec3(0.,1.,0.);
 if(abs(rd.y)>.00001){
  t=(-1.1-ro.y)/rd.y;
  if(t>.001){nearest=t;uv=(ro+rd*t).xz;material=1.;}
 }
 if(sphere(ro,rd,vec3(.88,-.10,0.),1.,t,n)&&t<nearest){
  nearest=t;normal=n;material=2.;
  uv=vec2(atan(n.z,n.x),asin(clamp(n.y,-1.,1.)));
 }
 mat3 rotation=rotateY(uObjectAngle);
 vec3 localRo=transpose(rotation)*(ro-vec3(-1.5,-.30,.15)),localRd=transpose(rotation)*rd;
 if(box(localRo,localRd,vec3(.66,.8,.66),t,n)&&t<nearest){
  nearest=t;normal=rotation*n;material=3.;vec3 p=localRo+localRd*t;
  uv=abs(n.x)>.5?p.zy:abs(n.y)>.5?p.xz:p.xy;
 }
 if(box(ro-vec3(0.,.65,-3.15),rd,vec3(4.6,1.75,.12),t,n)&&t<nearest){
  nearest=t;normal=n;material=4.;uv=(ro+rd*t).xy;
 }
 if(box(ro-vec3(-3.2,-.15,-1.1),rd,vec3(.28,.95,.28),t,n)&&t<nearest){
  nearest=t;normal=n;material=5.;vec3 p=ro+rd*t;uv=abs(n.y)>.5?p.xz:abs(n.x)>.5?p.zy:p.xy;
 }
 point=ro+rd*nearest;return nearest<1e5;
}

float bayer(vec2 pixel){
 const float matrix[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
 ivec2 q=ivec2(mod(floor(pixel),4.));return (matrix[q.y*4+q.x]+.5)/16.;
}

void main(){
 vec2 screen=(gl_FragCoord.xy+uJitter-.5*uResolution)/uResolution.y;
 vec3 eye=uDistance*vec3(sin(uYaw)*cos(uPitch),sin(uPitch),cos(uYaw)*cos(uPitch));
 vec3 target=uScene==2?vec3(0.,-.15,0.):vec3(0.);
 vec3 forward=normalize(target-eye),right=normalize(cross(forward,vec3(0.,1.,0.))),up=cross(right,forward);
 vec3 direction=normalize(forward+right*screen.x*uFov+up*screen.y*uFov);
 vec3 point,normal;vec2 uv;float material;
 bool hit=scene(eye,direction,point,normal,uv,material);
 // Alternate angular coordinate avoids sphere seam derivatives.
 vec2 alternate=uv;
 if(material==2.)alternate.x=uv.x<0.?uv.x+6.283185:uv.x;
 vec2 dx=dFdx(uv),dy=dFdy(uv),dxAlt=dFdx(alternate),dyAlt=dFdy(alternate);
 dx=dot(dx,dx)<dot(dxAlt,dxAlt)?dx:dxAlt;dy=dot(dy,dy)<dot(dyAlt,dyAlt)?dy:dyAlt;
 float compensation=uRadial?1.+dot(screen*uFov,screen*uFov):1.;
 dx*=compensation/uSampleScale;dy*=compensation/uSampleScale;
 if(!hit){outputColor=uScene==2?vec4(vec3(.94,.93,.88)*(uBackground/.94),1.)*uOutputWeight:vec4(vec3(uBackground),1.)*uOutputWeight;return;}
 vec3 light=normalize(uScene==0?vec3(.55,.9,-.5):vec3(-.65,.92,.55));
 float brightness=uScene==0?.21+.69*max(0.,dot(normal,light)):.15+.78*max(0.,dot(normal,light));
 vec3 sp,sn;vec2 st;float sm;
 if(scene(point+normal*.005,light,sp,sn,st,sm))brightness*=.35;
 if(material==1.&&uScene==2){
  float grid=step(.93,fract(uv.x*.7))+step(.93,fract(uv.y*.7));brightness-=min(grid,1.)*.09;
 }
 if(material==4.){
  vec2 brick=uv*vec2(2.,3.);brick.x+=mod(floor(brick.y),2.)*.5;
  vec2 edge=min(fract(brick),1.-fract(brick));brightness-=step(min(edge.x,edge.y),.035)*.12;
 }
 brightness=clamp(brightness*uExposure+uOffset,.001,.999);
 float bw;
 if(uMode==1){float inputValue=uInverse?1.-brightness:brightness;bw=step(bayer((gl_FragCoord.xy+uJitter)*uSampleScale/max(1.,exp2(uScale-6.))),inputValue);if(uInverse)bw=1.-bw;}
 else if(uMode==2){float p=texture(uPattern,vec3(uv*exp2(8.-uScale),15.5/16.)).r;float inputValue=uInverse?1.-brightness:brightness;bw=smoothstep(1.-inputValue-.035,1.-inputValue+.035,p);if(uInverse)bw=1.-bw;}
 else bw=surfaceStableDither(uv,dx,dy,brightness);
 vec3 color=uScene==2?mix(vec3(.10,.115,.12),vec3(.96,.95,.89)*(uPaper/.96),bw):vec3(mix(.13,uPaper,bw));
 outputColor=vec4(color,1.)*uOutputWeight;
}
`;
