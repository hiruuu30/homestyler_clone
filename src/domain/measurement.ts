import type { Point, Units } from './types';

function assertPoint(point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('measurement point coordinates must be finite numbers');
  }
}

export function measureDistance(start: Point, end: Point): number {
  assertPoint(start);
  assertPoint(end);
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function formatMeasurement(start: Point, end: Point, units: Units): string {
  if (units !== 'm' && units !== 'ft') throw new TypeError('units must be m or ft');
  return `${measureDistance(start, end).toFixed(2)} ${units}`;
}
