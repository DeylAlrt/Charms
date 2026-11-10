import type { Charm } from '../../charmEditorUtils';
import { LINK_W, getStripPicture } from '../stripImages';
import { attachedLinkFile, isWatchPart, WATCH_FACE_LINKS } from '../watches';
import { HANGING_SCALE, LUG_OVERLAP, meetingSides, watchLayout } from '../StripLinks';
import { pairsOn } from '../twinChains';
import { CHAIN_LINK, LINK, LINK_BULGE, chainLinkMesh, linkMesh, stampCanvas, type Mesh } from './linkModel';
import { CHAIN_VS, CUTOUT_FS, CUTOUT_VS, LINK_VS, METAL_FS, SHADOW_FS } from './shaders';

/**
 * Draws the customer's bracelet in 3D with WebGL: real metal links wearing the charm photos,
 * joined into a ring that spins, can be dragged round, tilted and zoomed. Uses the same
 * bracelet pictures as the flat view, so every charm works without extra images.
 */

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

/** ✏️ Look and feel */
const VIEW = {
  startAngle: -0.35,   // radians; which part of the bracelet faces you first
  tilt: 0.52,          // how far from above you look at it (0 = side on)
  spinPerMs: 0.00018,  // slow automatic spin
  dragPerPx: 0.009,    // how far a drag turns it
  minZoom: 0.75, maxZoom: 2.2,
};
const SILVER: Vec3 = [0.90, 0.91, 0.93];
const GOLD: Vec3 = [1.0, 0.76, 0.34];
const BLACK: Vec3 = [0.05, 0.05, 0.055];

/* ---------- Small maths helpers (column-major, like WebGL) ---------- */
const M4 = {
  mul(a: Mat4, b: Mat4): Mat4 {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  id(): Mat4 { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  t(x: number, y: number, z: number): Mat4 { const o = M4.id(); o[12] = x; o[13] = y; o[14] = z; return o; },
  s(x: number, y: number, z: number): Mat4 { const o = M4.id(); o[0] = x; o[5] = y; o[10] = z; return o; },
  ry(a: number): Mat4 { const o = M4.id(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  persp(fov: number, asp: number, n: number, f: number): Mat4 {
    const o = new Float32Array(16), t = 1 / Math.tan(fov / 2);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f);
    return o;
  },
  look(e: Vec3, t: Vec3, u: Vec3): Mat4 {
    const z = V3.norm(V3.sub(e, t)), x = V3.norm(V3.cross(u, z)), y = V3.cross(z, x);
    const o = M4.id();
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -V3.dot(x, e); o[13] = -V3.dot(y, e); o[14] = -V3.dot(z, e);
    return o;
  },
  chain: (...ms: Mat4[]) => ms.reduce((a, b) => M4.mul(a, b)),
};
const V3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
/** A point in a link's own frame, for the link at `angle` round the ring. */
const ringPoint = (angle: number, p: Vec3): Vec3 => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
};

/* ---------- What gets drawn ---------- */
type Hanging = {
  tex: WebGLTexture;
  /** Size and left edge in link units; `k` is how much it's shrunk, like on the strip. */
  w: number; h: number; left: number; k: number;
  /** Where a twin chain's own chain ends, and a magnet heart's left/right edges (link units). */
  anchor?: { x: number; y: number };
  edges?: { l: number; r: number };
};
type Picture = { face: WebGLTexture; metal: Vec3; hang?: Hanging };
type Spot = Picture & { shift: number; flip: boolean };
type Scene = {
  spots: Spot[];
  R: number;
  watch: { tex: WebGLTexture; faceW: number; h: number; middle: number; centre: number } | null;
  chains: { metal: Vec3; mats: Mat4[] }[];
};

/** A metal colour from the rails of a link's own photo: silver, gold, black, or a coloured finish. */
function railMetal(g: CanvasRenderingContext2D, W: number, H: number): Vec3 {
  try {
    let r = 0, gr = 0, b = 0, n = 0;
    for (const [y0, y1] of [[0.02, 0.09], [0.91, 0.98]]) {
      const d = g.getImageData(Math.round(W * 0.2), Math.round(H * y0), Math.round(W * 0.6), Math.max(1, Math.round(H * (y1 - y0)))).data;
      for (let i = 0; i < d.length; i += 12) if (d[i + 3] > 200) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
    }
    if (!n) return SILVER;
    const c: Vec3 = [r / n / 255, gr / n / 255, b / n / 255];
    if (Math.max(...c) < 95 / 255) return BLACK;
    if (Math.max(...c) - Math.min(...c) < 25 / 255) return SILVER;
    // A coloured finish: make the colour a little richer, as metal reflects it
    const grey = (c[0] + c[1] + c[2]) / 3;
    const rich = c.map(v => Math.max(0.04, grey + (v - grey) * 1.6)) as Vec3;
    const top = Math.max(...rich);
    return rich.map(v => Math.min(1, v / top)) as Vec3;
  } catch {
    return SILVER; // the picture couldn't be read (another website's image)
  }
}

export class BraceletRenderer {
  private gl: WebGLRenderingContext;
  private aniso: EXT_texture_filter_anisotropic | null;
  private progs: Record<'link' | 'chain' | 'cutout' | 'shadow', { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; a: Record<string, number> }>;
  private meshes: Record<'link' | 'chain', { P: WebGLBuffer; N: WebGLBuffer; U?: WebGLBuffer; M?: WebGLBuffer; I: WebGLBuffer; count: number }>;
  private quad: WebGLBuffer;
  private stamp: WebGLTexture;
  private images = new Map<string, Promise<HTMLImageElement>>();
  private pictures = new Map<string, Promise<Picture>>();
  private watchFaces = new Map<string, WebGLTexture>();
  private scene: Scene | null = null;
  private build = 0;

  private view = { angle: VIEW.startAngle, tilt: VIEW.tilt, zoom: 1, vel: 0, playing: true };
  private dirty = true;
  private raf = 0;
  private last = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { kind: 'drag' | 'pinch'; moved: number; t: number; lastT: number; d0?: number; z0?: number } | null = null;
  private resizeObserver: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private events: { onPlayingChange?: (playing: boolean) => void; onError?: (message: string) => void } = {}) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    this.progs = {
      link: this.program(LINK_VS, METAL_FS),
      chain: this.program(CHAIN_VS, METAL_FS),
      cutout: this.program(CUTOUT_VS, CUTOUT_FS),
      shadow: this.program(CUTOUT_VS, SHADOW_FS),
    };
    this.meshes = { link: this.upload(linkMesh()), chain: this.upload(chainLinkMesh()) };
    this.quad = this.buffer(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
    this.stamp = this.texture(stampCanvas());

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.view.playing = false;
    this.resizeObserver = new ResizeObserver(() => this.wake());
    this.resizeObserver.observe(canvas);
    this.listen();
  }

  /** Shows a bracelet (call again whenever it changes). */
  async setBracelet(slots: (Charm | undefined)[]): Promise<void> {
    const build = ++this.build;
    const scene = await this.makeScene(slots);
    if (build !== this.build) return; // a newer bracelet arrived meanwhile
    this.scene = scene;
    this.wake();
  }

  get playing() { return this.view.playing; }

  setPlaying(playing: boolean) {
    this.view.playing = playing;
    this.events.onPlayingChange?.(playing);
    this.wake();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = -1;
    this.resizeObserver.disconnect();
    this.cleanup.forEach(f => f());
    this.gl.getExtension('WEBGL_lose_context')?.loseContext(); // frees everything on the graphics card
  }

  /* ---------- Building the scene ---------- */

  private async makeScene(slots: (Charm | undefined)[]): Promise<Scene> {
    const n = slots.length;
    const base = slots.find(c => c?.isPlaceholder)?.filename ?? 'Plain Links/Silver_Plain_Charm.png';
    const pictures = await Promise.all(slots.map(c => {
      if (!c) return this.picture(base);
      if (isWatchPart(c)) return this.picture(attachedLinkFile(c.filename));
      return this.picture(c.filename, c.half, c.img);
    }));
    const spots: Spot[] = pictures.map(p => ({ ...p, shift: 0, flip: false }));

    // The links meet towards the inside, so small V-shaped gaps open at the front, as on the real bracelet
    const R = 0.5 / Math.tan(Math.PI / n) + LINK.hz * 0.7;
    const step = (2 * Math.PI) / n;
    const front = R + LINK.hz + LINK_BULGE + 0.012; // where the hanging pictures sit

    // Magnet hearts side by side: slide each half so their flat edges meet at the border between links
    const border = front * Math.tan(step / 2);
    const charms = slots as Charm[];
    meetingSides(charms).forEach((side, i) => {
      const e = spots[i].hang?.edges;
      if (e) spots[i].shift = side === 'right' ? border - e.r : -border - e.l;
    });

    // Twin chains: the chain runs from the first half to the second, the short way round
    const chains: Scene['chains'] = [];
    for (const { a, b } of pairsOn(charms)) {
      const ahead = (b - a + n) % n;
      const forward = ahead <= n - ahead;
      if (!forward) { spots[a].flip = true; spots[b].flip = true; }
      const between = Math.min(ahead, n - ahead) - 1;
      if (between < 1) continue; // side by side, their own chains already meet
      const ends = [a, b].map(i => {
        const p = spots[i].hang?.anchor;
        return p ? ringPoint(i * step, [spots[i].flip ? -p.x : p.x, -LINK.hy + p.y, front]) : null;
      });
      if (ends[0] && ends[1]) {
        chains.push({ metal: /gold/i.test(charms[a].filename) ? GOLD : SILVER, mats: chainBetween(ends[0], ends[1], between, front) });
      }
    }

    // The watch face, resting across the links it covers
    let watch: Scene['watch'] = null;
    const w = watchLayout(charms);
    if (w) {
      const { pic, faceStart } = w;
      let tex = this.watchFaces.get(pic.src);
      if (!tex) {
        const img = await this.image(pic.src);
        const face = this.canvas2d(1024, 512, g => g.drawImage(img, pic.faceLeft, 0, pic.faceRight - pic.faceLeft, pic.h, 0, 0, 1024, 512));
        tex = this.texture(face.canvas);
        this.watchFaces.set(pic.src, tex);
      }
      const faceW = WATCH_FACE_LINKS + 2 * LUG_OVERLAP;
      const px = faceW / (pic.faceRight - pic.faceLeft);
      watch = { tex, faceW, h: pic.h * px, middle: pic.linkMiddle * px, centre: faceStart + WATCH_FACE_LINKS / 2 - 0.5 };
    }
    return { spots, R, watch, chains };
  }

  /** The face texture, metal colour and hanging part for one charm (cached). */
  private picture(filename: string, half?: 0 | 1, fallbackImg?: string): Promise<Picture> {
    const key = `${filename}#${half ?? ''}`;
    let p = this.pictures.get(key);
    if (!p) {
      p = (async () => {
        const pic = getStripPicture(filename, half);
        if (!pic) {
          // No bracelet picture yet (a charm added since the pictures were last made): use its photo
          const img = await this.image(fallbackImg ?? '');
          const c = this.canvas2d(256, 256, g => g.drawImage(img, 0, 0, 256, 256));
          return { face: this.texture(c.canvas), metal: SILVER };
        }
        const img = await this.image(pic.src);
        const face = this.canvas2d(256, 256, g => g.drawImage(img, pic.x, pic.y, LINK_W, pic.lh, 0, 0, 256, 256));
        const out: Picture = { face: this.texture(face.canvas), metal: railMetal(face.g, 256, 256) };
        const top = pic.y + pic.lh, hangH = pic.h - top;
        if (hangH > 4) {
          const k = pic.full ? 1 : HANGING_SCALE;
          const toLink = (px: number, py: number) => ({ x: ((px - pic.x - LINK_W / 2) / LINK_W) * k, y: (-(py - top) / LINK_W) * k });
          const hang = this.canvas2d(256, 512, g => g.drawImage(img, 0, top, pic.w, hangH, 0, 0, 256, 512));
          out.hang = {
            tex: this.texture(hang.canvas),
            w: pic.w / LINK_W, h: hangH / LINK_W, left: -(pic.x + LINK_W / 2) / LINK_W, k,
            anchor: pic.anchor ? toLink(pic.anchor.x, pic.anchor.y) : undefined,
            edges: pic.hl != null && pic.hr != null ? { l: toLink(pic.hl, 0).x, r: toLink(pic.hr, 0).x } : undefined,
          };
        }
        return out;
      })();
      this.pictures.set(key, p);
    }
    return p;
  }

  private image(src: string): Promise<HTMLImageElement> {
    let p = this.images.get(src);
    if (!p) {
      p = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Couldn't load ${src}`));
        img.src = src;
      });
      this.images.set(src, p);
    }
    return p;
  }

  private canvas2d(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingQuality = 'high';
    paint(g);
    return { canvas, g };
  }

  /* ---------- WebGL plumbing ---------- */

  private program(vs: string, fs: string) {
    const gl = this.gl, p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'Shader error');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'Program error');
    const u: Record<string, WebGLUniformLocation | null> = {}, a: Record<string, number> = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const name = gl.getActiveUniform(p, i)!.name; u[name] = gl.getUniformLocation(p, name); }
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i++) { const name = gl.getActiveAttrib(p, i)!.name; a[name] = gl.getAttribLocation(p, name); }
    return { p, u, a };
  }

  private buffer(data: Float32Array | Uint16Array, target: number = this.gl.ARRAY_BUFFER) {
    const gl = this.gl, b = gl.createBuffer()!;
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return b;
  }

  private upload(m: Mesh) {
    return {
      P: this.buffer(m.P), N: this.buffer(m.N),
      U: m.U && this.buffer(m.U), M: m.M && this.buffer(m.M),
      I: this.buffer(m.I, this.gl.ELEMENT_ARRAY_BUFFER), count: m.I.length,
    };
  }

  private texture(source: TexImageSource) {
    const gl = this.gl, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }

  private attrib(prog: { a: Record<string, number> }, name: string, b: WebGLBuffer | undefined, size: number) {
    const gl = this.gl, loc = prog.a[name];
    if (loc === undefined || loc < 0 || !b) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  /* ---------- Drawing ---------- */

  private wake() {
    this.dirty = true;
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.frame(t)); }
  }

  private frame(now: number) {
    if (this.raf === -1) return; // disposed
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const v = this.view;
    let moving = false;
    if (!this.pointers.size) {
      if (Math.abs(v.vel) > 0.00002) { v.angle += v.vel * dt; v.vel *= Math.pow(0.94, dt / 16); moving = true; }
      else if (v.playing) { v.angle -= dt * VIEW.spinPerMs; moving = true; }
    }
    if (moving || this.dirty) { this.draw(); this.dirty = false; }
    this.raf = moving || this.pointers.size ? requestAnimationFrame(t => this.frame(t)) : 0;
  }

  private draw() {
    const { gl, canvas, view, progs, meshes } = this;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const scene = this.scene;
    if (!scene || !W || !H) return;
    const { spots, R, watch, chains } = scene;
    const n = spots.length, step = (2 * Math.PI) / n;

    // Frame the whole ring (and what hangs from it) whatever the screen shape
    const asp = W / H, fov = 0.52;
    const hangMax = Math.max(0, ...spots.map(s => (s.hang ? s.hang.h * s.hang.k : 0)));
    const halfW = R + 0.55, halfH = R * Math.sin(view.tilt) + LINK.hy + 0.3 + hangMax * 0.75;
    const dist = (Math.max(halfW / (Math.tan(fov / 2) * asp), halfH / Math.tan(fov / 2)) + R * Math.cos(view.tilt) * 0.55) / view.zoom;
    const target: Vec3 = [0, -hangMax * 0.38, 0];
    const eye: Vec3 = [0, target[1] + dist * Math.sin(view.tilt), dist * Math.cos(view.tilt)];
    const vp = M4.mul(M4.persp(fov, asp, 0.1, 100), M4.look(eye, target, [0, 1, 0]));
    gl.enable(gl.DEPTH_TEST);

    // Soft shadow under the bracelet
    const sh = progs.shadow;
    gl.useProgram(sh.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const size = R * 2.5, floorY = -LINK.hy - hangMax * 0.65 - 0.35;
    const lieFlat = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
    gl.uniformMatrix4fv(sh.u.uViewProj, false, vp);
    gl.uniformMatrix4fv(sh.u.uModel, false, M4.chain(M4.t(-size / 2, floorY, size / 2), lieFlat, M4.s(size, size, 1)));
    this.attrib(sh, 'aQ', this.quad, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true); gl.disable(gl.BLEND);

    // The links
    const lp = progs.link, lm = meshes.link;
    gl.useProgram(lp.p);
    gl.uniformMatrix4fv(lp.u.uViewProj, false, vp);
    gl.uniform3fv(lp.u.uCam, eye);
    gl.uniform1f(lp.u.uBend, 1 / R);
    gl.uniform1i(lp.u.uTex, 0);
    gl.uniform1i(lp.u.uBack, 1);
    this.attrib(lp, 'aPos', lm.P, 3); this.attrib(lp, 'aNor', lm.N, 3);
    this.attrib(lp, 'aUv', lm.U, 2); this.attrib(lp, 'aMask', lm.M, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lm.I);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.stamp);
    gl.activeTexture(gl.TEXTURE0);
    spots.forEach((s, i) => {
      gl.uniformMatrix4fv(lp.u.uModel, false, M4.mul(M4.ry(view.angle + i * step), M4.t(0, 0, R)));
      gl.uniform3fv(lp.u.uMetal, s.metal);
      gl.bindTexture(gl.TEXTURE_2D, s.face);
      gl.drawElements(gl.TRIANGLES, lm.count, gl.UNSIGNED_SHORT, 0);
    });

    // Twin chains
    if (chains.length) {
      const cp = progs.chain, cm = meshes.chain, turn = M4.ry(view.angle);
      gl.useProgram(cp.p);
      gl.uniformMatrix4fv(cp.u.uViewProj, false, vp);
      gl.uniform3fv(cp.u.uCam, eye);
      this.attrib(cp, 'aPos', cm.P, 3); this.attrib(cp, 'aNor', cm.N, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cm.I);
      for (const c of chains) {
        gl.uniform3fv(cp.u.uMetal, c.metal);
        for (const m of c.mats) {
          gl.uniformMatrix4fv(cp.u.uModel, false, M4.mul(turn, m));
          gl.drawElements(gl.TRIANGLES, cm.count, gl.UNSIGNED_SHORT, 0);
        }
      }
    }

    // Hanging parts and the watch face: photo cut-outs, a little darker when facing away
    const op = progs.cutout;
    gl.useProgram(op.p);
    gl.uniformMatrix4fv(op.u.uViewProj, false, vp);
    gl.uniform1i(op.u.uTex, 0);
    this.attrib(op, 'aQ', this.quad, 2);
    const shade = (a: number) => 0.72 + 0.32 * Math.max(0, Math.cos(a));
    const front = R + LINK.hz + LINK_BULGE;
    spots.forEach((s, i) => {
      const h = s.hang;
      if (!h) return;
      const a = view.angle + i * step;
      const x0 = s.flip ? -(h.left + h.w) * h.k : h.left * h.k;
      gl.uniformMatrix4fv(op.u.uModel, false, M4.chain(M4.ry(a), M4.t(0, 0, front + 0.012), M4.t(x0 + s.shift, -LINK.hy - h.h * h.k, 0), M4.s(h.w * h.k, h.h * h.k, 1)));
      gl.uniform1f(op.u.uShade, shade(a));
      gl.uniform1f(op.u.uFlipX, s.flip ? 1 : 0);
      gl.bindTexture(gl.TEXTURE_2D, h.tex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
    if (watch) {
      const a = view.angle + watch.centre * step;
      gl.uniformMatrix4fv(op.u.uModel, false, M4.chain(M4.ry(a), M4.t(0, 0, front + 0.05), M4.t(-watch.faceW / 2, -(watch.h - watch.middle), 0), M4.s(watch.faceW, watch.h, 1)));
      gl.uniform1f(op.u.uShade, shade(a));
      gl.uniform1f(op.u.uFlipX, 0);
      gl.bindTexture(gl.TEXTURE_2D, watch.tex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  /* ---------- Touch and mouse: drag to turn, drag up/down to tilt, pinch or scroll to zoom, tap to pause ---------- */

  private listen() {
    const c = this.canvas, v = this.view;
    const pinchDist = () => { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    type Events = HTMLElementEventMap & { webglcontextlost: Event };
    const on = <K extends keyof Events>(type: K, fn: (e: Events[K]) => void, opts?: AddEventListenerOptions) => {
      c.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => c.removeEventListener(type, fn as EventListener, opts));
    };
    on('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      v.vel = 0;
      const now = performance.now();
      this.gesture = this.pointers.size === 1
        ? { kind: 'drag', moved: 0, t: now, lastT: now }
        : { kind: 'pinch', moved: 99, t: now, lastT: now, d0: pinchDist(), z0: v.zoom };
      this.wake();
    });
    on('pointermove', e => {
      const p = this.pointers.get(e.pointerId), g = this.gesture;
      if (!p || !g) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (g.kind === 'pinch' && this.pointers.size === 2) {
        v.zoom = Math.max(VIEW.minZoom, Math.min(VIEW.maxZoom, (g.z0! * pinchDist()) / g.d0!));
      } else if (g.kind === 'drag') {
        const now = performance.now();
        g.moved += Math.abs(dx) + Math.abs(dy);
        v.angle += dx * VIEW.dragPerPx;
        v.tilt = Math.max(0.08, Math.min(0.95, v.tilt + dy * 0.004));
        v.vel = (dx * VIEW.dragPerPx) / Math.max(8, now - g.lastT);
        g.lastT = now;
      }
      this.dirty = true;
    });
    const end = (e: PointerEvent) => {
      if (!this.pointers.delete(e.pointerId)) return;
      const g = this.gesture;
      if (!this.pointers.size) {
        if (g?.kind === 'drag' && g.moved < 6 && performance.now() - g.t < 350) { v.vel = 0; this.setPlaying(!v.playing); }
        this.gesture = null;
      } else if (this.pointers.size === 1) {
        const now = performance.now();
        this.gesture = { kind: 'drag', moved: 99, t: now, lastT: now };
      }
      this.wake();
    };
    on('pointerup', end);
    on('pointercancel', end);
    on('wheel', e => {
      e.preventDefault();
      v.zoom = Math.max(VIEW.minZoom, Math.min(VIEW.maxZoom, v.zoom * Math.exp(-e.deltaY * 0.0015)));
      this.wake();
    }, { passive: false });
    on('webglcontextlost', e => {
      e.preventDefault();
      if (this.raf !== -1) this.events.onError?.('The 3D view was reset by the device.');
    });
  }
}

/**
 * The chain between the two halves of a twin chain: it leaves each half's picture where the
 * picture's own chain ends, drapes down in front of the links between, and is made of small
 * wire links, every other one turned a quarter so they interlock.
 */
function chainBetween(start: Vec3, end: Vec3, between: number, front: number): Mat4[] {
  const droop = 0.12 + 0.08 * Math.max(0, between - 1);
  const mid = V3.mul(V3.add(start, end), 0.5);
  const out = V3.norm([mid[0], 0, mid[2]]);
  const want = front + 0.05;
  const pull: Vec3 = [2 * want * out[0] - mid[0], Math.min(start[1], end[1]) - 2 * droop, 2 * want * out[2] - mid[2]];
  const at = (t: number) => { const u = 1 - t; return V3.add(V3.add(V3.mul(start, u * u), V3.mul(pull, 2 * u * t)), V3.mul(end, t * t)); };
  const steps = 120, pts = [at(0)], len = [0];
  for (let i = 1; i <= steps; i++) { pts.push(at(i / steps)); len.push(len[i - 1] + Math.hypot(...V3.sub(pts[i], pts[i - 1]))); }
  const count = Math.max(2, Math.round(len[steps] / 0.055)), sp = len[steps] / count;
  const scale = (sp / (2 * CHAIN_LINK.a)) * 1.12; // neighbours overlap a little, like real ones
  const mats: Mat4[] = [];
  for (let k = 0; k < count; k++) {
    const target = (k + 0.5) * sp;
    let i = 1;
    while (i < steps && len[i] < target) i++;
    const f = (target - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
    const p = V3.add(pts[i - 1], V3.mul(V3.sub(pts[i], pts[i - 1]), f));
    const tan = V3.norm(V3.sub(pts[i], pts[i - 1]));
    const flat: Vec3 = [p[0], 0, p[2]];
    const outward = V3.norm(V3.sub(flat, V3.mul(tan, V3.dot(flat, tan))));
    const side = V3.cross(tan, outward);
    const [ax, ay] = k % 2 ? [outward, V3.mul(side, -1)] : [side, outward];
    mats.push(new Float32Array([
      tan[0] * scale, tan[1] * scale, tan[2] * scale, 0,
      ax[0] * scale, ax[1] * scale, ax[2] * scale, 0,
      ay[0] * scale, ay[1] * scale, ay[2] * scale, 0,
      p[0], p[1], p[2], 1,
    ]));
  }
  return mats;
}

/** Whether this browser can show the 3D view at all. */
export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
