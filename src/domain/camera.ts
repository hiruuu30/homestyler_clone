import type { DesignProject, Point } from './types';

export type ProjectCameraFrame = {
  targetX: number;
  targetY: number;
  targetZ: number;
  radius: number;
};

/** Return a conservative perspective-camera frame for the active project. */
export function frameProjectCamera(project: DesignProject, aspect: number, fieldOfViewDegrees = 42): ProjectCameraFrame {
  const points: Point[] = [
    ...project.rooms.flatMap((room) => room.points),
    ...project.walls.flatMap((wall) => [wall.start, wall.end]),
  ];
  project.furniture.forEach((item) => {
    const angle = item.rotation * (Math.PI / 180);
    const halfWidth = item.width / 2;
    const halfDepth = item.depth / 2;
    const extentX = Math.abs(Math.cos(angle)) * halfWidth + Math.abs(Math.sin(angle)) * halfDepth;
    const extentY = Math.abs(Math.sin(angle)) * halfWidth + Math.abs(Math.cos(angle)) * halfDepth;
    points.push(
      { x: item.position.x - extentX, y: item.position.y - extentY },
      { x: item.position.x + extentX, y: item.position.y + extentY },
    );
  });

  if (!points.length) points.push({ x: -5, y: -4 }, { x: 5, y: 4 });
  const wallPadding = Math.max(0, ...project.walls.map((wall) => wall.thickness / 2));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - wallPadding;
  const maxX = Math.max(...xs) + wallPadding;
  const minY = Math.min(...ys) - wallPadding;
  const maxY = Math.max(...ys) + wallPadding;
  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxY - minY);
  const floorElevation = project.levels.find((level) => level.id === project.activeLevelId)?.elevation ?? 0;
  const maxHeight = Math.max(2.4, ...project.walls.map((wall) => wall.height), ...project.furniture.map((item) => item.height));
  const halfDiagonal = Math.hypot(width / 2, depth / 2, maxHeight / 2);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeFov = Number.isFinite(fieldOfViewDegrees) ? Math.min(150, Math.max(10, fieldOfViewDegrees)) : 42;
  const verticalHalfAngle = (safeFov * Math.PI) / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * safeAspect);
  const limitingHalfAngle = Math.min(verticalHalfAngle, horizontalHalfAngle);

  return {
    targetX: (minX + maxX) / 2,
    targetY: floorElevation + maxHeight * 0.42,
    targetZ: -(minY + maxY) / 2,
    radius: Math.max(5, (halfDiagonal / Math.sin(limitingHalfAngle)) * 1.1),
  };
}
