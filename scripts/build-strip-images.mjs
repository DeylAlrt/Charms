import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { rowSpans, findLink } from './detectLink.mjs';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public', 'charms');
const OUT = path.join(ROOT, 'public', 'charms-strip');
const MANIFEST = path.join(ROOT, 'src', 'components', 'charmEditor', 'stripImages.json');
/** Small copies of the charm photos for the charm list and cart (the originals are up to 4 MB each). */
const THUMBS = path.join(ROOT, 'public', 'charms-thumb');
const THUMB_SIZE = 192; // a 64px tile on a 3× phone screen

const LINK_W = 200;
const SKIP_FOLDERS = new Set(['Tools', 'Watches', 'Keychains', 'Apple Connector']);
const TWIN_FOLDER = 'Chain Links';

/**
 * Links hidden under their decoration (wings, a big bow) that the automatic
 * search measures wrongly — measured by hand, in source pixels.
 */
const OVERRIDES = {
  'Dangling Links/Dangling_Silver_Links (2).png': { cx: 988, top: 471, bottom: 1057, w: 727 },
  'Dangling Links/Dangling_Silver_Links (4).png': { cx: 1037, top: 271, bottom: 794, w: 594 },
  // Crystal Butterfly Star: the butterfly covers the link's left edge
  'Dangling Links/Dangling_Silver_Links (8).png': { cx: 985, top: 583, bottom: 1083, w: 593 },
};

/**
 * Dangles whose chain hangs from both ends of the link (a loop under it).
 * Their hanging part is drawn full size, since shrinking it toward the middle
 * would pull the chain's ends off the link.
 */
const KEEP_FULL_SIZE = new Set([
  'Dangling Links/Dangling_Silver_Links (1).png', // Sparkle Chain
  'Dangling Links/Dangling_Silver_Links (4).png', // Pearl Bow Chain
]);

/** Opaque bounding box of everything in the given row spans. */
function contentBox(spans) {
  let top = -1, bottom = -1, left = Infinity, right = -Infinity;
  spans.forEach((s, y) => {
    if (!s) return;
    if (top < 0) top = y;
    bottom = y;
    left = Math.min(left, s.l);
    right = Math.max(right, s.r);
  });
  return { top, bottom, left, right };
}

/**
 * Link height in source pixels. Decorations overlapping the link's lower edge
 * (butterfly wings) can end the measured band early, so it's never taken as
 * shorter than a normal link's proportions.
 */
const linkHeight = (link) => Math.max(link.bottom != null ? link.bottom - link.top : 0, link.w * 0.82);

/** Left/right edges of whatever hangs below the link (rows under `belowY`), or null. */
function hangingExtent(spans, belowY) {
  let l = Infinity, r = -Infinity;
  for (let y = Math.ceil(belowY); y < spans.length; y++) {
    const s = spans[y];
    if (!s) continue;
    l = Math.min(l, s.l);
    r = Math.max(r, s.r);
  }
  return l <= r ? { l, r } : null;
}

/**
 * Lowest opaque pixel on column `x`, from row `fromY` down — where a twin
 * chain's chain leaves the picture of its half.
 */
function lowestOpaqueOnColumn(data, width, height, channels, x, fromY) {
  for (let y = height - 1; y >= fromY; y--) {
    if (data[(y * width + x) * channels + 3] > 128) return y;
  }
  return null;
}

/**
 * Crops [x0, x1) × [y0, y1) out of the source (clamped to its edges), scales
 * it so the link is LINK_W wide, and saves it as webp. Returns the output
 * size, the link's top-left in it, and the crop/scale used.
 */
async function writeStrip(file, outFile, link, x0, x1, y0, y1, imgW, imgH) {
  const left = Math.max(0, Math.round(x0));
  const top = Math.max(0, Math.round(y0));
  const right = Math.min(imgW, Math.round(x1));
  const bottom = Math.min(imgH, Math.round(y1));
  const scale = LINK_W / link.w;
  const outW = Math.round((right - left) * scale);
  const outH = Math.round((bottom - top) * scale);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(file)
    .extract({ left, top, width: right - left, height: bottom - top })
    .resize(outW, outH)
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(outFile);

  return {
    w: outW,
    h: outH,
    x: Math.round((link.cx - link.w / 2 - left) * scale),
    y: Math.round((link.top - top) * scale),
    lh: Math.round(linkHeight(link) * scale),
    scale,
    left,
    top,
  };
}

const manifest = {};
const thumbs = [];
const missed = [];

for (const folder of fs.readdirSync(SRC).sort()) {
  const dir = path.join(SRC, folder);
  if (SKIP_FOLDERS.has(folder) || !fs.statSync(dir).isDirectory()) continue;

  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.png$/i.test(name)) continue;
    const key = `${folder}/${name}`;
    const file = path.join(dir, name);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const base = path.join(OUT, folder, name.replace(/\.png$/i, ''));

    // Thumbnail for the charm list and cart, made for every picture
    const thumbFile = path.join(THUMBS, folder, name.replace(/\.png$/i, '.webp'));
    fs.mkdirSync(path.dirname(thumbFile), { recursive: true });
    await sharp(file)
      // Tiny originals are scaled up to fill the tile (as the full photo was shown before)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(thumbFile);
    thumbs.push(key);
    const pad = (link) => link.w * 0.04; // a little air around the picture

    if (folder !== TWIN_FOLDER) {
      const spans = rowSpans(data, width, height, channels);
      const link = OVERRIDES[key] ?? findLink(spans, width * 0.1);
      if (!link) { missed.push(key); continue; }
      // A link touching the top edge is cut off (a zoomed-in photo), so its size is unknown
      if (link.top <= 0) { missed.push(`${key} (link cut off at the top, ${width}×${height} pixels)`); continue; }
      // Keep everything that hangs or sticks out
      const box = contentBox(spans);
      // Tiny zoomed-in photos of a dangle cut part of the link off, so it would come out the wrong size
      if (width < 300 && (box.bottom - link.top) / link.w > 1.2) { missed.push(`${key} (too small: ${width}×${height} pixels)`); continue; }
      const out = await writeStrip(file, `${base}.webp`, link,
        box.left - pad(link), box.right + 1 + pad(link),
        Math.min(box.top, link.top) - pad(link), box.bottom + 1 + pad(link), width, height);
      manifest[key] = { w: out.w, h: out.h, x: out.x, y: out.y, lh: out.lh };
      if (KEEP_FULL_SIZE.has(key)) manifest[key].full = true;
      // Dangles: how far the hanging part reaches left and right (magnet heart halves meet at these edges)
      const hanging = hangingExtent(spans, link.top + linkHeight(link) + link.w * 0.05);
      if (hanging) {
        manifest[key].hl = Math.round((hanging.l - out.left) * out.scale);
        manifest[key].hr = Math.round((hanging.r - out.left) * out.scale);
      }
      continue;
    }

    // Twin chain: one photo holds both halves, left and right. Each half is
    // cropped around its own link and the charm hanging from it; the builder
    // draws the chain between them, starting where it leaves each crop.
    const halves = [];
    for (const [x0, x1, side] of [[0, width / 2, 'a'], [width / 2, width, 'b']]) {
      const spans = rowSpans(data, width, height, channels, x0, x1);
      const link = findLink(spans, (x1 - x0) * 0.1);
      if (!link) break;
      const box = contentBox(spans);
      const cropL = Math.max(x0, link.cx - link.w * 0.85);
      const cropR = Math.min(x1, link.cx + link.w * 0.85);
      const out = await writeStrip(file, `${base}__${side}.webp`, link,
        cropL, cropR, Math.min(box.top, link.top) - pad(link), box.bottom + 1 + pad(link), width, height);
      // The chain leaves through the edge facing the other half
      const edgeX = Math.round(side === 'a' ? cropR - 2 : cropL + 1);
      const exitY = lowestOpaqueOnColumn(data, width, height, channels, edgeX, link.top);
      const anchor = exitY === null
        ? { x: Math.round(out.w / 2), y: out.h }
        : { x: Math.round((edgeX - out.left) * out.scale), y: Math.round((exitY - out.top) * out.scale) };
      halves.push({ w: out.w, h: out.h, x: out.x, y: out.y, lh: out.lh, anchor });
    }
    if (halves.length === 2) manifest[key] = { halves };
    else missed.push(key);
  }
}

// Watches: the photos are upright (face in the middle, an attached link above
// and below), so they're trimmed and turned on their side to lie along the
// bracelet. The builder stretches each one across the 6 link spaces a watch
// takes, so only its size (for the height) is recorded.
const WATCH_FOLDER = 'Watches';
const WATCH_LENGTH = 1200; // pixels along the bracelet
const watches = {};
for (const name of fs.readdirSync(path.join(SRC, WATCH_FOLDER)).sort()) {
  if (!/\.png$/i.test(name)) continue;
  const key = `${WATCH_FOLDER}/${name}`;
  const file = path.join(SRC, WATCH_FOLDER, name);
  const turned = await sharp(file).trim({ threshold: 10 }).rotate(90).png().toBuffer();
  // Cut off the links at both ends of the photo, keeping just the watch face
  // (with its lugs): the builder draws real links under it instead. Columns
  // through a link are about a link tall; the face's columns are much taller.
  const { data: px, info } = await sharp(turned).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const columnHeight = (x) => {
    let top = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) {
      if (px[(y * info.width + x) * info.channels + 3] > 128) { if (top < 0) top = y; bottom = y; }
    }
    return top < 0 ? 0 : bottom - top + 1;
  };
  const heights = Array.from({ length: info.width }, (_, x) => columnHeight(x));
  const edge = heights.slice(0, Math.round(info.width * 0.06)).filter(Boolean).sort((a, b) => a - b);
  const linkHeight = edge[Math.floor(edge.length / 2)] || 0;
  let faceLeft = heights.findIndex(h => h > linkHeight * 1.35);
  let faceRight = info.width - 1 - [...heights].reverse().findIndex(h => h > linkHeight * 1.35);
  if (faceLeft < 0 || faceRight <= faceLeft) { faceLeft = 0; faceRight = info.width - 1; }
  // Widen to the whole face: a rounded face narrows towards its sides, so keep
  // going outwards while the columns are still taller than the watch's own links
  while (faceLeft > 0 && heights[faceLeft - 1] > linkHeight * 1.08) faceLeft--;
  while (faceRight < info.width - 1 && heights[faceRight + 1] > linkHeight * 1.08) faceRight++;
  // Where the watch's own links sit vertically (middle of the end columns)
  const edgeMiddle = (x) => {
    let top = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) {
      if (px[(y * info.width + x) * info.channels + 3] > 128) { if (top < 0) top = y; bottom = y; }
    }
    return (top + bottom) / 2;
  };
  const sample = [0.02, 0.04, 0.96, 0.98].map(f => edgeMiddle(Math.round(info.width * f)));
  const linkMiddle = sample.reduce((a, b) => a + b, 0) / sample.length;

  // The whole photo, turned, with where its links and face are recorded (scaled to WATCH_LENGTH)
  const scale = WATCH_LENGTH / info.width;
  const h = Math.round(info.height * scale);
  const out = path.join(OUT, WATCH_FOLDER, name.replace(/\.png$/i, '.webp'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(turned).resize(WATCH_LENGTH, h).webp({ quality: 85, alphaQuality: 90 }).toFile(out);
  watches[key] = {
    w: WATCH_LENGTH,
    h,
    linkHeight: Math.round(linkHeight * scale), // height of the watch's own links
    linkMiddle: Math.round(linkMiddle * scale), // their vertical middle
    faceLeft: Math.round(faceLeft * scale),     // where the face (and lugs) starts and ends
    faceRight: Math.round(faceRight * scale),
  };

  // Thumbnail for the watch list (upright, like the photo)
  const thumbFile = path.join(THUMBS, WATCH_FOLDER, name.replace(/\.png$/i, '.webp'));
  fs.mkdirSync(path.dirname(thumbFile), { recursive: true });
  await sharp(file).trim({ threshold: 10 })
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90 }).toFile(thumbFile);
  thumbs.push(key);
}

fs.writeFileSync(MANIFEST, JSON.stringify({ linkWidth: LINK_W, images: manifest, watches, thumbs }, null, 1) + '\n');
console.log(`Made ${Object.keys(manifest).length} bracelet pictures → public/charms-strip/ and ${thumbs.length} thumbnails → public/charms-thumb/`);
if (missed.length) {
  console.log(`\nCouldn't find the link in ${missed.length} picture(s) — they'll show the old way:`);
  for (const key of missed) console.log(`  ${key}`);
}
