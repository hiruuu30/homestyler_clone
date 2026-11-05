import type { WallOpening } from './types';

export type WallSolidSegment = Readonly<{
  start: number;
  end: number;
  bottom: number;
  top: number;
}>;

export type OpeningInterval = Readonly<{ start: number; end: number }>;

/** Resize one end of an opening while keeping its opposite end fixed. */
export function resizeOpeningFromEdge(
  opening: Readonly<{ center: number; width: number }>,
  wallLength: number,
  side: 'left' | 'right',
  delta: number,
  minimumWidth: number,
  blockers: readonly OpeningInterval[] = [],
): Readonly<{ center: number; width: number }> {
  if (!Number.isFinite(wallLength) || wallLength <= 0) throw new RangeError('wall length must be positive and finite');
  if (!Number.isFinite(opening.center) || !Number.isFinite(opening.width) || opening.width <= 0
    || opening.center - opening.width / 2 < 0 || opening.center + opening.width / 2 > wallLength) {
    throw new RangeError('opening must have valid bounds within the wall');
  }
  if (!Number.isFinite(delta)) throw new TypeError('resize delta must be finite');
  if (!Number.isFinite(minimumWidth) || minimumWidth <= 0 || minimumWidth > opening.width) {
    throw new RangeError('minimum width must be positive and no wider than the opening');
  }
  if (side !== 'left' && side !== 'right') throw new TypeError('resize side must be left or right');

  const fixedEdge = side === 'left'
    ? opening.center + opening.width / 2
    : opening.center - opening.width / 2;
  const currentEdge = side === 'left'
    ? opening.center - opening.width / 2
    : opening.center + opening.width / 2;
  let lower = side === 'left' ? 0 : fixedEdge + minimumWidth;
  let upper = side === 'left' ? fixedEdge - minimumWidth : wallLength;

  for (const blocker of blockers) {
    if (!Number.isFinite(blocker.start) || !Number.isFinite(blocker.end) || blocker.end <= blocker.start) {
      throw new RangeError('blocking opening interval must have finite positive bounds');
    }
    if (side === 'left' && blocker.end <= fixedEdge + 1e-9 && blocker.end > lower) lower = blocker.end;
    if (side === 'right' && blocker.start >= fixedEdge - 1e-9 && blocker.start < upper) upper = blocker.start;
  }

  if (lower > upper) throw new RangeError('no clear wall span is available for resizing this opening');
  const edge = Math.max(lower, Math.min(upper, currentEdge + delta));
  return Object.freeze({ center: (edge + fixedEdge) / 2, width: Math.abs(edge - fixedEdge) });
}

/** Decompose one wall face into non-overlapping solid rectangles around hosted openings. */
export function wallSolidSegments(length: number, height: number, openings: readonly WallOpening[]): WallSolidSegment[] {
  if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('wall dimensions must be positive finite numbers');
  }
  const boundaries = new Set<number>([0, length]);
  for (const opening of openings) {
    boundaries.add(Math.max(0, opening.center - opening.width / 2));
    boundaries.add(Math.min(length, opening.center + opening.width / 2));
  }
  const xValues = [...boundaries].sort((a, b) => a - b);
  const segments: WallSolidSegment[] = [];
  for (let index = 0; index < xValues.length - 1; index += 1) {
    const start = xValues[index];
    const end = xValues[index + 1];
    const midpoint = (start + end) / 2;
    const voids = openings
      .filter((opening) => midpoint > opening.center - opening.width / 2 && midpoint < opening.center + opening.width / 2)
      .map((opening) => ({ bottom: opening.sillHeight, top: Math.min(height, opening.sillHeight + opening.height) }))
      .sort((a, b) => a.bottom - b.bottom);
    let bottom = 0;
    for (const voidRegion of voids) {
      if (voidRegion.bottom > bottom) segments.push({ start, end, bottom, top: voidRegion.bottom });
      bottom = Math.max(bottom, voidRegion.top);
    }
    if (bottom < height) segments.push({ start, end, bottom, top: height });
  }
  return segments;
}
