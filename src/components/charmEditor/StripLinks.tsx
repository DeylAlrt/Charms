"use client";

import { useLayoutEffect, useState } from 'react';
import type { Charm } from '../charmEditorUtils';
import { LINK_W, getStripPicture } from './stripImages';
import { MAX_LINKS_BETWEEN, loopDistance, pairsOn, runsDirectly } from './twinChains';

const LINK_FILL = 0.935;
const LINK_TOP = 0.08;
/** How big hanging parts are drawn compared with the photo. Lower = smaller dangles. */
export const HANGING_SCALE = 0.65;
/** The shrink for one picture: none for dangles whose chain hangs from both ends of the link. */
const hangScale = (pic: { full?: boolean }) => (pic.full ? 1 : HANGING_SCALE);
/** % of the spot width per strip-picture pixel */
const S = (LINK_FILL * 100) / LINK_W;

const HANGING_Z = 1;
export const CHAIN_Z = 2;
const LINK_Z = 3;

/** `v`% of the spot width, as CSS. */
const pct = (v: number) => `calc(var(--spot, 60px) * ${v / 100})`;

/** Style for a row of spots: tells the pictures how wide a spot is. */
export const spotVar = (geometry: SpotGeometry | null): React.CSSProperties =>
  ({ "--spot": `${geometry?.spotW ?? 60}px` } as React.CSSProperties);

/** Magnet heart halves: the left half (I) and right half (II) meet in the middle when side by side. */
export const isLeftHeartHalf = (filename: string) => /^Magnet Hearts\/.*\(1\)\.png$/.test(filename);
export const isRightHeartHalf = (filename: string) => /^Magnet Hearts\/.*\(2\)\.png$/.test(filename);

/** For each spot, which side its hanging part should meet a neighbour's on (magnet hearts). */
export function meetingSides(bracelet: (Charm | undefined)[]): Map<number, 'left' | 'right'> {
  const sides = new Map<number, 'left' | 'right'>();
  bracelet.forEach((item, i) => {
    const next = bracelet[i + 1];
    if (item && next && isLeftHeartHalf(item.filename) && isRightHeartHalf(next.filename)) {
      sides.set(i, 'right');
      sides.set(i + 1, 'left');
    }
  });
  return sides;
}

/** The link's centre and the line it hangs from, in picture pixels. */
const hangPoint = (pic: { x: number; y: number; lh: number }) => ({ x: pic.x + LINK_W / 2, y: pic.y + pic.lh });

/** How far below its square a charm reaches, in spot widths (0 if it doesn't). */
export function hangBelow(charm: Charm | undefined): number {
  if (!charm) return 0;
  const pic = getStripPicture(charm.filename, charm.half);
  if (!pic) return 0;
  const hangingH = Math.max(0, pic.h - hangPoint(pic).y);
  const bottom = (LINK_TOP * 100 + (pic.lh + hangingH * hangScale(pic)) * S) / 100;
  // Twin chain halves: room for the chain sagging between them too
  return Math.max(0, bottom - 1) + (charm.pairId ? 0.3 : 0);
}

/** Extra room needed under the strip for everything hanging from it. */
export const hangRoom = (bracelet: (Charm | undefined)[]) => Math.max(0, ...bracelet.map(hangBelow));

/**
 * One charm, positioned inside its spot (inside a row styled with spotVar). Charms
 * without a strip picture fall back to the whole photo fitted in the square.
 *  - `mirrored` flips the hanging part (never the link) — for a twin chain
 *    placed the other way round, so its chain still leads to its partner.
 *  - `meet` moves the hanging part sideways so its edge reaches the border
 *    with the neighbour on that side (half the gap between spots is `gapPx`).
 */
export function StripCharmPicture({ charm, mirrored = false, meet, gapPx = 0 }: {
  charm: Charm;
  mirrored?: boolean;
  meet?: 'left' | 'right';
  gapPx?: number;
}) {
  const pic = getStripPicture(charm.filename, charm.half);
  const alt = charm.isPlaceholder ? 'Plain link' : (charm.displayName || charm.filename);

  if (!pic) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={charm.img} alt={alt} draggable={false} className="absolute inset-0 w-full h-full object-contain select-none" style={{ zIndex: LINK_Z }} />
    );
  }

  const point = hangPoint(pic);
  const hangingPct = ((pic.h - point.y) / pic.h) * 100;
  const box: React.CSSProperties = {
    width: pct(pic.w * S),
    height: pct(pic.h * S),
    left: pct(50 - point.x * S),
    top: pct(LINK_TOP * 100 - pic.y * S),
  };
  // No loading shimmer here: these pictures are tiny, and the shimmer's background would cover
  // the neighbouring links (the picture's box is wider than its spot and drawn above them).
  const className = 'absolute max-w-none select-none pointer-events-none';

  // Sideways shift so a magnet heart half's flat edge reaches the spot border
  let shift: string | undefined;
  if (meet && pic.hl != null && pic.hr != null) {
    const edge = meet === 'right' ? pic.hr : pic.hl;
    const edgeFromCenter = hangScale(pic) * (edge - point.x) * S; // % of the spot, after shrinking
    shift = meet === 'right'
      ? `calc(${pct(50 - edgeFromCenter)} + ${gapPx}px)`
      : `calc(${pct(-50 - edgeFromCenter)} - ${gapPx}px)`;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pic.src}
        alt={alt}
        draggable={false}
        className={className}
        style={{ ...box, zIndex: LINK_Z, clipPath: `inset(0 0 ${hangingPct}% 0)` }}
      />
      {hangingPct > 0.5 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pic.src}
          alt=""
          draggable={false}
          className={className}
          style={{
            ...box,
            zIndex: HANGING_Z,
            clipPath: `inset(${100 - hangingPct}% 0 0 0)`,
            transformOrigin: `${(point.x / pic.w) * 100}% ${(point.y / pic.h) * 100}%`,
            transform: `${shift ? `translateX(${shift}) ` : ''}scale(${mirrored ? -hangScale(pic) : hangScale(pic)}, ${hangScale(pic)})`,
          }}
        />
      )}
    </>
  );
}

export type SpotGeometry = { spotW: number; pitch: number; left: number; top: number };

/**
 * Measures the spots of a row: their width, the distance between two
 * neighbouring spots, and where the first one sits — kept up to date as the
 * row resizes. `rowRef`'s first children must be the spots.
 */
export function useSpotGeometry(rowRef: React.RefObject<HTMLElement | null>, deps: unknown[]): SpotGeometry | null {
  const [geometry, setGeometry] = useState<SpotGeometry | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const first = row.children[0] as HTMLElement | undefined;
      const second = row.children[1] as HTMLElement | undefined;
      if (!first) return;
      const pitch = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
      setGeometry({ spotW: first.offsetWidth, pitch, left: first.offsetLeft, top: first.offsetTop });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return geometry;
}

/**
 * Which twin chain halves to draw flipped: the photo has half 0 on the left
 * with its chain leaving to the right, so a pair placed the other way round
 * (or one whose chain runs round the clasp) is mirrored to keep the chain
 * between them.
 */
export function mirroredSpots(bracelet: Charm[], positionOf: (i: number) => number = i => i): Set<number> {
  const flipped = new Set<number>();
  for (const { a, b } of pairsOn(bracelet)) {
    const pa = positionOf(a);
    const pb = positionOf(b);
    const towardsB = runsDirectly(pa, pb, bracelet.length) ? Math.sign(pb - pa) : -Math.sign(pb - pa);
    if (towardsB < 0) { flipped.add(a); flipped.add(b); }
  }
  return flipped;
}

/** Where a twin chain half's chain leaves its (shrunk, maybe flipped) hanging part, in pixels within the row. */
function anchorPoint(charm: Charm, position: number, mirrored: boolean, g: SpotGeometry) {
  const pic = getStripPicture(charm.filename, charm.half);
  if (!pic?.anchor) return null;
  const px = (g.spotW * S) / 100; // row pixels per picture pixel
  const point = hangPoint(pic);
  const dx = (pic.anchor.x - point.x) * hangScale(pic) * (mirrored ? -1 : 1);
  return {
    x: g.left + position * g.pitch + g.spotW / 2 + dx * px,
    y: g.top + g.spotW * LINK_TOP + (pic.lh + (pic.anchor.y - point.y) * hangScale(pic)) * px,
  };
}


export const CHAIN_LOOK = {
  /** Length of one chain link, end to end. Bigger = chunkier links. */
  linkLength: 0.06,
  /** Width of a flat (oval) link, as a share of its length. */
  linkRoundness: 0.6,
  /** Thickness of the wire the links are made of. */
  wireThickness: 0.012,
  /** How far the chain droops below its lower end, plus a bit more for each link it spans. */
  droop: 0.12,
  droopPerLink: 0.08,
  /** Moves the middle (lowest part) of the chain sideways; the ends stay on the charms.
   *  A share of the chain's width: 0 = centred, positive = right, negative = left. */
  middleShift: 0.12,
  /** Nudges each end of the chain, to close a gap where it meets the photo's chain.
   *  x: positive = right, negative = left. y: positive = down, negative = up. */
  leftEnd: { x: 0.1, y: 0 },
  rightEnd: { x: 0.05, y: -0.015 },
  /** Colours for silver twin chains: the metal, its darker edge, and its shine. */
  silver: { metal: '#e4e7eb', edge: '#a9b0b9', shine: '#ffffff' },
  /** Colours for gold twin chains. */
  gold: { metal: '#e2c46f', edge: '#a8883a', shine: '#fff4cf' },
  /** Colour while a half is dragged too far away (the move will be refused). */
  tooFar: { metal: '#f2a3ae', edge: '#d1293d', shine: '#ffe3e7' },
};

type Point = { x: number; y: number };
type Curve = [Point, Point, Point]; // a gentle curve: start, pull point, end

/** Point and direction at `t` (0…1) along a curve. */
function along([p0, p1, p2]: Curve, t: number) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    dx: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    dy: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

/** Where to put each chain link along a curve: its centre and angle, evenly spaced. */
function chainLinks(curve: Curve, linkLength: number) {
  // Measure the curve in small steps, then drop a link every `linkLength`
  const steps = 80;
  const lengths = [0];
  let prev = along(curve, 0);
  for (let i = 1; i <= steps; i++) {
    const p = along(curve, i / steps);
    lengths.push(lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lengths[steps];
  const count = Math.max(1, Math.round(total / linkLength));
  const spacing = total / count;
  return Array.from({ length: count }, (_, k) => {
    const target = (k + 0.5) * spacing;
    const i = Math.max(1, lengths.findIndex(l => l >= target));
    const t = (i - 1 + (target - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1])) / steps;
    const p = along(curve, t);
    return { x: p.x, y: p.y, angle: (Math.atan2(p.dy, p.dx) * 180) / Math.PI, length: spacing };
  });
}

/**
 * The chains between twin chain halves, drawn over the hanging parts and
 * under the links. `positionOf` gives where each spot's charm is currently
 * drawn (it differs while dragging). A chain stretched too far turns red;
 * halves side by side get none. Its look is set in CHAIN_LOOK above.
 */
export function TwinChainLayer({ bracelet, geometry, positionOf = i => i }: {
  bracelet: Charm[];
  geometry: SpotGeometry | null;
  positionOf?: (i: number) => number;
}) {
  const pairs = pairsOn(bracelet);
  if (!geometry || pairs.length === 0) return null;
  const flipped = mirroredSpots(bracelet, positionOf);
  const g = geometry;
  const rowRight = g.left + (bracelet.length - 1) * g.pitch + g.spotW;
  const unit = g.spotW; // CHAIN_LOOK sizes are in spot widths

  const chains = pairs.flatMap(({ pairId, a, b }) => {
    const pa = positionOf(a);
    const pb = positionOf(b);
    const start = anchorPoint(bracelet[a], pa, flipped.has(a), g);
    const end = anchorPoint(bracelet[b], pb, flipped.has(b), g);
    if (!start || !end) return [];
    const distance = loopDistance(pa, pb, bracelet.length);
    // Side by side, the halves' own chain pieces already meet: nothing to draw
    if (distance <= 1) return [];
    const colors = distance > MAX_LINKS_BETWEEN + 1
      ? CHAIN_LOOK.tooFar
      : /gold/i.test(bracelet[a].filename) ? CHAIN_LOOK.gold : CHAIN_LOOK.silver;
    const droop = unit * (CHAIN_LOOK.droop + CHAIN_LOOK.droopPerLink * (distance - 1));

    if (runsDirectly(pa, pb, bracelet.length)) {
      // Nudge whichever end is on the left/right of the screen (CHAIN_LOOK.leftEnd / rightEnd)
      const nudge = (p: Point, isLeft: boolean): Point => {
        const n = isLeft ? CHAIN_LOOK.leftEnd : CHAIN_LOOK.rightEnd;
        return { x: p.x + n.x * unit, y: p.y + n.y * unit };
      };
      const startIsLeft = start.x <= end.x;
      Object.assign(start, nudge(start, startIsLeft));
      Object.assign(end, nudge(end, !startIsLeft));
      // The pull point sits twice the droop below, so the curve's lowest point is about `droop` down
      const pull = {
        x: (start.x + end.x) / 2 + Math.abs(end.x - start.x) * CHAIN_LOOK.middleShift,
        y: Math.max(start.y, end.y) + droop * 2,
      };
      return [{ key: pairId, curve: [start, pull, end] as Curve, colors }];
    }
    // Round the clasp: each half's chain runs off its end of the strip
    const offEnd = (p: Point, towardsRight: boolean): Curve => {
      const edgeX = towardsRight ? rowRight + unit * 0.3 : g.left - unit * 0.3;
      return [p, { x: (p.x + edgeX) / 2, y: p.y + droop * 2 }, { x: edgeX, y: p.y + droop }];
    };
    return [
      { key: `${pairId}-a`, curve: offEnd(start, pa > pb), colors },
      { key: `${pairId}-b`, curve: offEnd(end, pb > pa), colors },
    ];
  });

  const wire = unit * CHAIN_LOOK.wireThickness;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: CHAIN_Z }} aria-hidden>
      {chains.map(({ key, curve, colors }) => (
        <g key={key} fill="none" strokeLinecap="round">
          {chainLinks(curve, unit * CHAIN_LOOK.linkLength).map((link, k) => {
            const rx = link.length * 0.55; // links overlap a little, like real ones
            const ry = k % 2 === 0 ? rx * CHAIN_LOOK.linkRoundness : wire * 0.6; // flat oval, or side-on
            return (
              <g key={k} transform={`translate(${link.x} ${link.y}) rotate(${link.angle})`}>
                <ellipse rx={rx} ry={ry} stroke={colors.edge} strokeWidth={wire * 1.6} />
                <ellipse rx={rx} ry={ry} stroke={colors.metal} strokeWidth={wire} />
                <ellipse rx={rx} ry={ry} stroke={colors.shine} strokeWidth={wire * 0.35} strokeDasharray={`${rx * 0.8} ${rx * 4}`} />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
