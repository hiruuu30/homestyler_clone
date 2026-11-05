import type { DesignProject, Point, Units } from './types';

export function snapPlanPoint(
  project: Pick<DesignProject, 'rooms' | 'walls'>,
  candidate: Point,
  tolerance = 0.2,
): Point {
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    throw new TypeError('snap point coordinates must be finite numbers');
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError('snap tolerance must be a finite non-negative number');
  }

  let nearest: Point | undefined;
  let nearestDistance = tolerance;
  const endpoints = [
    ...project.rooms.flatMap((room) => room.points),
    ...project.walls.flatMap((wall) => [wall.start, wall.end]),
  ];
  for (const point of endpoints) {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance <= nearestDistance && (nearest === undefined || distance < nearestDistance)) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  if (nearest !== undefined) return { x: nearest.x, y: nearest.y };

  const segments = [
    ...project.walls.map((wall) => [wall.start, wall.end] as const),
    ...project.rooms.flatMap((room) => room.points.map((point, index) => [point, room.points[(index + 1) % room.points.length]] as const)),
  ];
  for (const [start, end] of segments) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0) continue;
    const fraction = ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSquared;
    if (fraction <= 0 || fraction >= 1) continue;
    const projected = { x: start.x + fraction * dx, y: start.y + fraction * dy };
    const distance = Math.hypot(projected.x - candidate.x, projected.y - candidate.y);
    if (distance <= nearestDistance && (nearest === undefined || distance < nearestDistance)) {
      nearest = projected;
      nearestDistance = distance;
    }
  }

  return nearest === undefined ? candidate : { x: nearest.x, y: nearest.y };
}

/** Snap furniture centers to a subtle 10 cm grid only when already within the caller's tolerance. */
export function snapFurniturePosition(position: Point, tolerance: number, units: Units = 'm'): Point {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new TypeError('furniture snap coordinates must be finite numbers');
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('furniture snap tolerance must be a finite non-negative number');
  if (units !== 'm' && units !== 'ft') throw new TypeError('units must be m or ft');
  const grid = units === 'ft' ? 0.1 / 0.3048 : 0.1;
  const snapAxis = (value: number) => {
    const target = Math.round(value / grid) * grid;
    return Math.abs(target - value) <= tolerance ? Number(target.toFixed(9)) : value;
  };
  return { x: snapAxis(position.x), y: snapAxis(position.y) };
}
