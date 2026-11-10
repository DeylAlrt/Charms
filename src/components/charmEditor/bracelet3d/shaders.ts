import { LINK, LINK_BULGE } from './linkModel';

/** The GPU programs that give the metal its look. Plain WebGL 1, so it runs on older phones too. */

const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/** ✏️ The room the metal reflects: a jewellery-photo studio with softboxes, so polished steel
 *  picks up crisp bright and dark stripes as it turns. */
const STUDIO = `
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.30, 0.30, 0.33), vec3(1.0, 1.0, 1.02), smoothstep(-0.5, 0.6, d.y));
  c *= 0.38 + 0.62 * smoothstep(0.0, 0.12, abs(d.y + 0.02));
  float az = atan(d.x, d.z);
  float up = smoothstep(-0.35, 0.15, d.y);
  c += up * 2.4 * exp(-pow((az + 0.85) / 0.22, 2.0));
  c += up * 1.6 * exp(-pow((az - 0.95) / 0.12, 2.0));
  c += up * 1.2 * exp(-pow((az - 2.6) / 0.30, 2.0));
  c += up * 0.9 * exp(-pow((az + 2.4) / 0.18, 2.0));
  c += 2.8 * pow(max(dot(d, normalize(vec3(-0.65, 0.42, 0.62))), 0.0), 60.0);
  c += 0.8 * pow(max(dot(d, normalize(vec3(0.0, 1.0, -0.15))), 0.0), 6.0);
  return c;
}
vec3 tonemap(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
`;

const f = (n: number) => n.toFixed(4);

/** The charm links: each bows outward across its face and bends to follow the round of the bracelet. */
export const LINK_VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv; attribute vec2 aMask;
uniform mat4 uModel, uViewProj; uniform float uBend;
varying vec3 vW, vN; varying vec2 vUv, vM;
void main() {
  vec3 p = aPos, n = aNor;
  float t = (p.z + ${f(LINK.hz)}) / ${f(2 * LINK.hz)};
  float u = p.x / ${f(LINK.hx)};
  p.z += ${f(LINK_BULGE)} * (1.0 - u * u) * t;
  n.x += n.z * 2.0 * ${f(LINK_BULGE)} * u / ${f(LINK.hx)} * t;
  n = normalize(n);
  float r0 = 1.0 / uBend, th = p.x * uBend, c = cos(th), s = sin(th);
  float r = r0 + p.z;
  p = vec3(r * s, p.y, r * c - r0);
  n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  vec4 w = uModel * vec4(p, 1.0);
  vW = w.xyz; vN = (uModel * vec4(n, 0.0)).xyz; vUv = aUv; vM = aMask;
  gl_Position = uViewProj * w;
}`;

/** Twin chain links: plain metal, no photo. */
export const CHAIN_VS = `
attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uModel, uViewProj;
varying vec3 vW, vN; varying vec2 vUv, vM;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vW = w.xyz; vN = (uModel * vec4(aNor, 0.0)).xyz; vUv = vec2(0.5); vM = vec2(0.0);
  gl_Position = uViewProj * w;
}`;

/** Polished metal everywhere, the brushed stamped plate inside, and the charm photo on the front. */
export const METAL_FS = PREC + STUDIO + `
uniform sampler2D uTex, uBack; uniform vec3 uMetal, uCam;
varying vec3 vW, vN; varying vec2 vUv, vM;
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW), R = reflect(-V, N);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  vec3 F = uMetal + (1.0 - uMetal) * pow(1.0 - nv, 5.0);
  vec3 polished = tonemap(env(R) * F * 1.15);
  vec3 Rb = normalize(mix(R, N, 0.28));
  float stamp = texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).r;
  vec3 brushed = tonemap(env(Rb) * F) * mix(0.45, 1.0, stamp);
  vec3 metal = mix(polished, brushed, vM.y);
  vec4 t = texture2D(uTex, vUv);
  float m = vM.x * smoothstep(0.3, 0.7, t.a);
  vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
  vec3 photo = t.rgb * (0.78 + 0.34 * max(dot(N, L), 0.0)) + tonemap(env(R)) * 0.10;
  gl_FragColor = vec4(mix(metal, photo, m), 1.0);
}`;

/** Flat cut-outs: dangles, twin chain and magnet heart halves, the watch face. */
export const CUTOUT_VS = `
attribute vec2 aQ;
uniform mat4 uModel, uViewProj;
varying vec2 vUv;
void main() { vUv = vec2(aQ.x, 1.0 - aQ.y); gl_Position = uViewProj * uModel * vec4(aQ, 0.0, 1.0); }`;

export const CUTOUT_FS = PREC + `
uniform sampler2D uTex; uniform float uShade, uFlipX;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uTex, vec2(mix(vUv.x, 1.0 - vUv.x, uFlipX), vUv.y));
  if (t.a < 0.45) discard;
  gl_FragColor = vec4(t.rgb * uShade, 1.0);
}`;

/** The soft shadow under the bracelet. */
export const SHADOW_FS = PREC + `
varying vec2 vUv;
void main() {
  float a = 0.30 * (1.0 - smoothstep(0.1, 1.0, length(vUv * 2.0 - 1.0)));
  gl_FragColor = vec4(vec3(0.10, 0.15, 0.26) * a, a);
}`;
