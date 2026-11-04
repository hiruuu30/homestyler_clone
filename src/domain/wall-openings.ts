import type { WallOpening } from './types';

export type WallSolidSegment = Readonly<{
  start: number;
  end: number;
  bottom: number;
  top: number;
}>;

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
