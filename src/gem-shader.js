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
uniform sampler2D uTriangleTexture;
uniform int uTriangleCount;
uniform bool uMesh;
uniform int uPlaneCount, uBounces, uSeed;
uniform float uTime, uYaw, uTilt, uIor, uDispersion, uAbsorption, uExposure, uCraft;
uniform vec3 uColor, uBackground;
uniform bool uOutlines, uCaustics, uTransparent;

mat3 rotation(float yaw, float tilt){
 float a=cos(yaw),b=sin(yaw),c=cos(tilt),d=sin(tilt);
 return mat3(a,0.,-b, 0.,1.,0., b,0.,a)*mat3(1.,0.,0., 0.,c,d, 0.,-d,c);
}

bool intersectMesh(vec3 ro,vec3 rd,out float nearT,out float farT,out vec3 nearN,out vec3 farN){
 float closest=1e6;vec3 normal=vec3(0.);
 for(int i=0;i<128;i++){
  if(i>=uTriangleCount)break;
  vec3 a=texelFetch(uTriangleTexture,ivec2(0,i),0).xyz;
  vec3 b=texelFetch(uTriangleTexture,ivec2(1,i),0).xyz;
  vec3 c=texelFetch(uTriangleTexture,ivec2(2,i),0).xyz;
  vec3 e1=b-a,e2=c-a,h=cross(rd,e2);
  float determinant=dot(e1,h);if(abs(determinant)<.000001)continue;
  float inv=1./determinant;vec3 s=ro-a;
  float u=dot(s,h)*inv;if(u<0.||u>1.)continue;
  vec3 q=cross(s,e1);float v=dot(rd,q)*inv;if(v<0.||u+v>1.)continue;
  float t=dot(e2,q)*inv;
  if(t>.0001&&t<closest){closest=t;normal=normalize(cross(e1,e2));}
 }
 farT=closest;farN=normal;nearN=normal;
 nearT=dot(rd,normal)<0.?closest:-.001;
 return closest<1e5;
}

bool intersectGem(vec3 ro,vec3 rd,out float nearT,out float farT,out vec3 nearN,out vec3 farN){
 if(uMesh)return intersectMesh(ro,rd,nearT,farT,nearN,farN);
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
 vec3 c=mix(vec3(.045,.035,.065),vec3(.28,.34,.45),smoothstep(-.4,.8,d.y));
 float panel=step(.34,d.y)*step(abs(d.x+.22),.38)*step(d.z,.78);
 float strip=step(.73,d.x)*step(abs(d.y-.10),.27);
 float warm=step(.66,-d.z)*step(abs(d.x-.08),.48)*step(-.3,d.y);
 c+=vec3(3.8,3.4,2.6)*panel+vec3(1.6,2.4,3.)*strip+vec3(2.6,1.9,1.3)*warm;
 c+=vec3(1.8,.75,.38)*step(.52,-d.x)*step(d.y,-.12)*step(-.74,d.y);
 c+=vec3(.55,.38,1.3)*step(.50,d.z)*step(.12,d.x)*step(d.x,.55);
 return c;
}

vec3 hsv(vec3 c){
 vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);
 return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);
}
float hueOf(vec3 c){
 float hi=max(c.r,max(c.g,c.b)),lo=min(c.r,min(c.g,c.b)),delta=hi-lo;
 if(delta<.0001)return .56;
 float h=hi==c.r?(c.g-c.b)/delta:hi==c.g?2.+(c.b-c.r)/delta:4.+(c.r-c.g)/delta;
 return fract(h/6.+1.);
}
vec3 paintedColor(vec3 light,vec3 normal){
 float h=hueOf(uColor);
 float maximum=max(uColor.r,max(uColor.g,uColor.b)),minimum=min(uColor.r,min(uColor.g,uColor.b));
 float saturation=smoothstep(.06,.45,(maximum-minimum)/max(maximum,.001));
 float value=.35+.65*sqrt(maximum);
 float highlightHue=(h>.83||h<.12)?h+.07:h-.09;
 float energy=dot(light,vec3(.38,.40,.22));
 float variation=fract(sin(dot(normal,vec3(12.7,63.1,27.4)))*437.585)-.5;
 float tone=clamp(1.-exp(-energy*uExposure*1.65)+variation*.045,0.,1.);
 tone=floor(tone*8.+.5)/8.;
 vec3 shadow=mix(hsv(vec3(fract(h-.055),.77*saturation,.28)),vec3(.19,.10,.23),.22);
 vec3 middle=hsv(vec3(h,.86*saturation,.78*value));
 vec3 body=hsv(vec3(h,.80*saturation,value));
 vec3 bounce=hsv(vec3(fract(highlightHue),.57*saturation,1.));
 vec3 highlight=mix(hsv(vec3(fract(highlightHue),.16*saturation,1.)),vec3(1.,.97,.83),.45);
 vec3 p=mix(shadow,middle,smoothstep(0.,.38,tone));
 p=mix(p,body,smoothstep(.28,.62,tone));
 p=mix(p,bounce,smoothstep(.55,.82,tone));
 p=mix(p,highlight,smoothstep(.79,1.,tone));
 // Small reflected accent colours, within the material's colour family.
 float accent=clamp((light.b-light.r*.55)*.45,0.,.28);
 return mix(p,hsv(vec3(fract(h+.16),.38*saturation,.87)),accent);
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
 if(uOutlines&&!uMesh){
  float edge=1.;
  for(int i=0;i<64;i++){
   if(i>=uPlaneCount)break;
   if(dot(uPlanes[i].xyz,normal)>.999)continue;
   edge=min(edge,uPlanes[i].w-dot(uPlanes[i].xyz,hit));
  }
  float line=1.-step(.009,edge);
  float facing=step(.32,dot(world*normal,normalize(vec3(-.6,.8,1.))));
  float strength=mix(.50,.12*facing,uCraft);
  color=mix(color,mix(uColor,vec3(1.,.97,.82),.7),line*strength);
 }
 vec3 painted=paintedColor(color,normal);
 color=pow(vec3(1.)-exp(-color*uExposure*1.6),vec3(.88));
 vec3 precise=floor(color*9.+.5)/9.;
 return floor(mix(precise,painted,min(.86,uCraft*1.14))*31.+.5)/31.;
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
    float motion=uTime*.7;
    vec2 centers[4]=vec2[4](vec2(-.35,.1),vec2(.29,-.25),vec2(.11,.32),vec2(-.12,-.3));
    float best=10.;int cell=0;
    for(int j=0;j<4;j++){
     vec2 site=centers[j]+.10*vec2(sin(motion+float(j)*2.1),cos(motion*.8+float(j)));
     float dist=length((q-site)*vec2(1.,1.2));if(dist<best){best=dist;cell=j;}
    }
    vec3 c=mix(uColor,vec3(.78,.47,1.),.35);
    if(cell==1)c=mix(uColor,vec3(1.,.89,.42),.65);
    if(cell==2)c=mix(uColor,vec3(.46,.96,.91),.55);
    if(cell==3)c=vec3(1.,.98,.82);
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
