/**
 * The 3D shapes: one charm link and one small chain link. Everything is measured in
 * link widths (a real Italian charm link is about 9 mm wide).
 */

/** ✏️ The link's shape, matched to a real link: half-width, half-height, half-depth, and how
 *  rounded its edges are (sides, top and bottom rails, front and back). */
export const LINK = { hx: 0.5, hy: 0.465, hz: 0.155, rad: [0.035, 0.1, 0.075] as const, seg: 7 };
/** ✏️ How far the middle of each link's face bows outward. */
export const LINK_BULGE = 0.035;

export type Mesh = { P: Float32Array; N: Float32Array; U?: Float32Array; M?: Float32Array; I: Uint16Array };

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * A box with rounded edges (a different roundness in each direction, so the top and bottom
 * rails can be rolled while the sides stay crisp). Each point also says how much of the charm
 * photo shows there (the front, wrapping over the rails) and how much is the stamped back plate.
 */
export function linkMesh(): Mesh {
  const { hx, hy, hz, rad, seg } = LINK;
  const h = [hx, hy, hz];
  const coords = (hh: number, r: number) => {
    const inner = hh - r, band: number[] = [];
    for (let i = seg; i >= 1; i--) band.push(-(inner + r * Math.tan((i / seg) * Math.PI / 4)));
    return [...band, -inner, inner, ...band.map(v => -v).reverse()];
  };
  const C = h.map((hh, k) => coords(hh, rad[k]));
  const P: number[] = [], N: number[] = [], U: number[] = [], M: number[] = [], I: number[] = [];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const ua = (axis + 1) % 3, va = (axis + 2) % 3;
    const cu = C[ua], cv = C[va], base = P.length / 3;
    for (let j = 0; j < cv.length; j++) for (let i = 0; i < cu.length; i++) {
      const p = [0, 0, 0];
      p[axis] = sign * h[axis]; p[ua] = cu[i]; p[va] = cv[j];
      const inner = p.map((v, k) => Math.max(-(h[k] - rad[k]), Math.min(h[k] - rad[k], v)));
      let u = p.map((v, k) => (v - inner[k]) / rad[k]);
      const l = Math.hypot(...u); u = u.map(x => x / l);
      const q = inner.map((v, k) => v + u[k] * rad[k]);
      let n = u.map((x, k) => x / rad[k]);
      const nl = Math.hypot(...n); n = n.map(x => x / nl);
      P.push(...q); N.push(...n);
      U.push((q[0] / hx + 1) / 2, (1 - q[1] / hy) / 2);
      M.push(smooth(0.12, 0.42, n[2]), smooth(0.55, 0.85, -n[2]));
    }
    for (let j = 0; j < cv.length - 1; j++) for (let i = 0; i < cu.length - 1; i++) {
      const a = base + j * cu.length + i, b = a + 1, c = a + cu.length, e = c + 1;
      I.push(a, b, e, a, e, c);
    }
  }
  return { P: new Float32Array(P), N: new Float32Array(N), U: new Float32Array(U), M: new Float32Array(M), I: new Uint16Array(I) };
}

/** ✏️ One small oval chain link (for twin chains): its half-length, half-width and wire thickness. */
export const CHAIN_LINK = { a: 0.034, b: 0.021, r: 0.0085 };

export function chainLinkMesh(nu = 20, nv = 8): Mesh {
  const { a, b, r } = CHAIN_LINK;
  const P: number[] = [], N: number[] = [], I: number[] = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = (i / nu) * 2 * Math.PI, v = (j / nv) * 2 * Math.PI;
    let nx = b * Math.cos(u), ny = a * Math.sin(u);
    const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    const n = [Math.cos(v) * nx, Math.cos(v) * ny, Math.sin(v)];
    P.push(a * Math.cos(u) + r * n[0], b * Math.sin(u) + r * n[1], r * n[2]);
    N.push(...n);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const p = i * (nv + 1) + j, q = p + nv + 1;
    I.push(p, q, q + 1, p, q + 1, p + 1);
  }
  return { P: new Float32Array(P), N: new Float32Array(N), I: new Uint16Array(I) };
}

/** The stamp on the inside of every link: a recessed frame and STAINLESS STEEL lettering. */
export function stampCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#9a9a9a'; g.lineWidth = 10; g.strokeRect(34, 70, 444, 372);
  g.fillStyle = '#7d7d7d'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 66px "Arial Narrow", Arial, Helvetica, sans-serif';
  g.fillText('STAINLESS', 256, 220);
  g.fillText('STEEL', 256, 300);
  return c;
}
