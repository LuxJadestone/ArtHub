// Original ArtHub shader. Convex-plane ray tracing, Fresnel and total internal
// reflection; environment lighting and ground caustics are artistic approximations.
export const vertexShader = `#version 300 es
precision highp float;
const vec2 points[3] = vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
void main(){gl_Position=vec4(points[gl_VertexID],0.,1.);}
`;

export const fragmentShader = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;
uniform vec4 uPlanes[64];
uniform int uPlaneCount, uBounces, uSeed;
uniform float uTime, uYaw, uTilt, uIor, uDispersion, uAbsorption, uExposure;
uniform vec3 uColor, uBackground;
uniform bool uOutlines, uCaustics, uTransparent;

mat3 rotation(float yaw, float tilt){
 float a=cos(yaw),b=sin(yaw),c=cos(tilt),d=sin(tilt);
 return mat3(a,0.,-b, 0.,1.,0., b,0.,a)*mat3(1.,0.,0., 0.,c,d, 0.,-d,c);
}

bool intersectGem(vec3 ro,vec3 rd,out float nearT,out float farT,out vec3 nearN,out vec3 farN){
 nearT=-1e6;farT=1e6;nearN=vec3(0.);farN=vec3(0.);
 for(int i=0;i<64;i++){
  if(i>=uPlaneCount)break;
  vec4 plane=uPlanes[i];float denom=dot(plane.xyz,rd);float dist=plane.w-dot(plane.xyz,ro);
  if(abs(denom)<0.00001){if(dist<0.)return false;continue;}
  float t=dist/denom;
  if(denom<0.){if(t>nearT){nearT=t;nearN=plane.xyz;}}
  else if(t<farT){farT=t;farN=plane.xyz;}
 }
 return nearT<farT&&farT>0.;
}

vec3 environment(vec3 d){
 // Large studio softboxes, a dark floor and narrower coloured strip lights.
 vec3 c=mix(vec3(.018,.025,.045),vec3(.28,.34,.45),smoothstep(-.4,.8,d.y));
 float panel=step(.34,d.y)*step(abs(d.x+.22),.38)*step(d.z,.78);
 float strip=step(.73,d.x)*step(abs(d.y-.10),.27);
 float warm=step(.66,-d.z)*step(abs(d.x-.08),.48)*step(-.3,d.y);
 c+=vec3(3.8,3.4,2.6)*panel+vec3(1.6,2.4,3.)*strip+vec3(2.6,1.9,1.3)*warm;
 return c;
}

float fresnel(float cosine,float ior){float f=(ior-1.)/(ior+1.);f*=f;return f+(1.-f)*pow(1.-clamp(cosine,0.,1.),5.);}

vec3 optical(vec3 hit,vec3 incident,vec3 normal,mat3 world,float ior){
 vec3 direction=refract(incident,normal,1./ior);
 vec3 pos=hit+direction*.002;
 vec3 transmission=vec3(1.);vec3 result=vec3(0.);
 for(int bounce=0;bounce<8;bounce++){
  if(bounce>=uBounces)break;
  float a,b;vec3 na,nb;
  if(!intersectGem(pos,direction,a,b,na,nb))break;
  transmission*=exp(-(vec3(1.)-uColor)*uAbsorption*b*2.3);
  pos+=direction*b;
  vec3 exitRay=refract(direction,-nb,ior);
  float f=fresnel(dot(direction,nb),ior);
  if(dot(exitRay,exitRay)>.01){
   result+=transmission*(1.-f)*environment(world*exitRay);
   transmission*=f;
  }
  direction=reflect(direction,nb);pos+=direction*.002;
 }
 result+=transmission*uColor*.12;
 return result;
}

vec3 shade(vec3 ro,vec3 rd,mat3 world,float nearT,vec3 normal){
 vec3 hit=ro+rd*nearT;
 float delta=uDispersion;
 vec3 r=optical(hit,rd,normal,world,uIor-delta);
 vec3 g=optical(hit,rd,normal,world,uIor);
 vec3 b=optical(hit,rd,normal,world,uIor+delta);
 vec3 color=vec3(r.r,g.g,b.b);
 float f=fresnel(-dot(rd,normal),uIor);
 color=color*(1.-f)+environment(world*reflect(rd,normal))*f;
 color+=uColor*.045;
 // Small facet boundary highlights, not an overlay texture.
 if(uOutlines){
  float edge=1.;
  for(int i=0;i<64;i++){
   if(i>=uPlaneCount)break;
   if(dot(uPlanes[i].xyz,normal)>.999)continue;
   edge=min(edge,uPlanes[i].w-dot(uPlanes[i].xyz,hit));
  }
  float line=1.-step(.009,edge);
  color=mix(color,mix(uColor,vec3(1.,.97,.82),.7),line*.50);
 }
 color=vec3(1.)-exp(-color*uExposure*1.6);
 color=pow(color,vec3(.88));
 return floor(color*9.+.5)/9.;
}

void main(){
 vec2 p=(gl_FragCoord.xy-.5*uResolution)/uResolution.y*4.8;
 vec3 background=uBackground;
 float shadow=length((p-vec2(.12,-1.42))/vec2(1.06,.31));
 if(shadow<1.){
  background=mix(background,vec3(.49,.52,.56),.45);
  if(uCaustics){
   vec2 q=(p-vec2(.12,-1.42))/vec2(.88,.23);
   float angle=atan(q.y,q.x),r=length(q);
   float wave=.75+.13*sin(angle*3.+uTime*1.8+float(uSeed));
   if(r<wave){
    vec3 c=mix(uColor,vec3(.78,.47,1.),step(.35,q.x)*.55);
    if(r<.49+.13*sin(angle*2.-uTime))c=mix(uColor,vec3(1.,.89,.42),.75);
    if(length(q+vec2(.12*sin(uTime),.02))<.27)c=vec3(1.,.98,.82);
    background=mix(background,c,.85);
   }
  }
 }
 mat3 world=rotation(uYaw+uTime*.55,uTilt+.22*sin(uTime*.42));
 mat3 local=transpose(world);
 vec3 origin=local*vec3(p.x,p.y-.18,4.5);
 vec3 direction=local*vec3(0.,0.,-1.);
 float nearT,farT;vec3 normal,farNormal;
 if(intersectGem(origin,direction,nearT,farT,normal,farNormal)&&nearT>0.){
  fragColor=vec4(shade(origin,direction,world,nearT,normal),1.);
 }else{
  vec3 outlineOrigin=local*vec3(p.x*.982,(p.y-.18)*.982,4.5);
  if(uOutlines&&intersectGem(outlineOrigin,direction,nearT,farT,normal,farNormal))fragColor=vec4(.075,.065,.10,1.);
  else fragColor=vec4(background,uTransparent?0.:1.);
 }
}
`;
