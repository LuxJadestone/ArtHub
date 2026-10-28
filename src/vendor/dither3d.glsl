/*
 * Copyright (c) 2025 Rune Skovbo Johansen
 * WebGL 2 / GLSL adaptation for ArtHub, 2026.
 * Source: runevision/Dither3D, Dither3DInclude.cginc
 * Upstream commit: 34fa85832268dc0649aad24b1b4fe07420782724
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

uniform highp sampler3D uPattern;
uniform sampler2D uRamp;
uniform float uScale,uVariability,uContrast,uStretch,uPixelFootprint;
uniform bool uQuantize,uInverse;

// Stable singular values: det / sigmaMax avoids cancellation at grazing angles.
vec2 surfaceFrequencies(vec2 dx,vec2 dy){
 float Q=dot(dx,dx)+dot(dy,dy),R=dx.x*dy.y-dx.y*dy.x;
 float discriminant=sqrt(max(0.,Q*Q-4.*R*R));
 float largest=sqrt(max((Q+discriminant)*.5,1e-12));
 return vec2(largest,max(abs(R)/largest,1e-6));
}

// Filter the final display footprint, including SSAA resolve and CSS reduction.
// The unresolved periodic signal must tend to its mean, not a sampled beat.
float patternVisibility(float cyclesPerSample){
 return 1.-smoothstep(.25,.5,cyclesPerSample*uPixelFootprint);
}

float surfaceStableDither(vec2 coordinates,vec2 dx,vec2 dy,float brightness){
 if(uInverse)brightness=1.-brightness;
 const float resolution=64.,dotsPerSide=4.,dotsTotal=16.;
 float brightnessCurve=texture(uRamp,vec2(.5/resolution+(1.-1./resolution)*brightness,.5)).r;
 vec2 frequency=surfaceFrequencies(dx,dy);
 float scaleExp=exp2(uScale);
 float spacing=frequency.y*scaleExp*dotsPerSide*.125;
 float brightnessSpacing=pow(brightnessCurve*2.+.001,-(1.-uVariability));
 spacing*=brightnessSpacing;
 float spacingLog=log2(max(spacing,1e-12));
 float level=floor(spacingLog),fraction=fract(spacingLog);
 vec2 uv=coordinates/exp2(level);
 float layer=mix(.25*dotsTotal,dotsTotal,1.-fraction);
 float tweak=1.;
 if(uQuantize){float original=layer;layer=floor(layer+.5);tweak=sqrt(layer/original);}
 float pattern=texture(uPattern,vec3(uv,(layer-.5)/dotsTotal)).r;
 float contrast=uContrast*scaleExp*brightnessSpacing*.1;
 contrast*=pow(frequency.y/frequency.x,uStretch);
 float base=mix(.5,brightness,clamp(1.05/(1.+contrast),0.,1.));
 float threshold=1.-brightnessCurve*tweak;
 float result=clamp((pattern-threshold)*contrast+base,0.,1.);
 float cycles=frequency.x*sqrt(layer)/exp2(level);
 result=mix(brightness,result,patternVisibility(cycles));
 return uInverse?1.-result:result;
}
