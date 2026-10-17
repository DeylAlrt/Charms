/**
 * Finds the link (the flat rectangular part every charm shares) in a charm
 * photo, so all links can be drawn at the same size on the bracelet.
 *
 * Walks down the picture looking for the first band of rows whose opaque
 * width stays steady and whose shape is link-like (a bit wider than tall).
 * Dangles and chains below it are narrower or change width row to row, and
 * small bits above it (a star tip) are too narrow to count.
 */

const ALPHA_MIN = 128;

/** Opaque left/right edge of every row within columns [x0, x1). */
export function rowSpans(data, width, height, channels, x0 = 0, x1 = width) {
  const spans = new Array(height);
  for (let y = 0; y < height; y++) {
    let l = -1;
    let r = -1;
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      if (data[(row + x) * channels + 3] > ALPHA_MIN) {
        if (l < 0) l = x;
        r = x;
      }
    }
    spans[y] = l < 0 ? null : { l, r, w: r - l + 1 };
  }
  return spans;
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** The steady-width band starting at row `start`: its width and last row. */
function bandFrom(spans, start) {
  const widths = spans.map(s => (s ? s.w : 0));
  const probe = widths.slice(start, start + Math.max(8, Math.round(widths[start] * 0.5))).filter(Boolean);
  const ref = median(probe);
  // Extend down while the width stays within 12% of the band's width,
  // tolerating a few stray rows (shadows, a ring crossing the edge).
  const tolerance = ref * 0.12;
  const maxMisses = Math.max(3, Math.round(ref * 0.03));
  let end = start;
  let misses = 0;
  for (let y = start; y < widths.length; y++) {
    if (Math.abs(widths[y] - ref) <= tolerance) {
      end = y;
      misses = 0;
    } else if (++misses > maxMisses) {
      break;
    }
  }
  return { ref, end };
}

/**
 * Returns { cx, top, bottom, w } of the link (in source pixels), or null if no
 * link-shaped band was found. `minWidth` filters out small bits like a star
 * tip above the link.
 */
export function findLink(spans, minWidth) {
  for (let y = 0; y < spans.length; y++) {
    if (!spans[y]) continue;
    const { ref, end } = bandFrom(spans, y);
    const ratio = (end - y) / ref;
    if (ref >= minWidth && ratio >= 0.55 && ratio <= 1.05) {
      const band = spans.slice(y, end + 1).filter(Boolean);
      // The link's top edge can be a bit narrower (its rim) or covered by a
      // decoration (a bow), which ends the steady band early: climb back up
      // while the rows above are still about as wide as the link.
      let top = y;
      while (top > 0 && spans[top - 1] && spans[top - 1].w >= ref * 0.8 && spans[top - 1].w <= ref * 1.15) top--;
      return { cx: median(band.map(s => (s.l + s.r) / 2)), top, bottom: end, w: ref };
    }
    y = Math.max(y, end);
  }
  return null;
}
