import type { DesignProject, Point } from './types';

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

  return nearest === undefined ? candidate : { x: nearest.x, y: nearest.y };
}
