import type { DesignProject, FurnitureInstance, Point, Room, Wall } from './types';

const EPSILON = 1e-9;

type Polygon = readonly Point[];

export function furnitureFootprint(item: FurnitureInstance, position: Point = item.position): readonly Point[] {
  const angle = item.rotation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  return [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ].map((corner) => ({
    x: position.x + corner.x * cosine - corner.y * sine,
    y: position.y + corner.x * sine + corner.y * cosine,
  }));
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  return Math.abs(cross(start, end, point)) <= EPSILON
    && point.x >= Math.min(start.x, end.x) - EPSILON
    && point.x <= Math.max(start.x, end.x) + EPSILON
    && point.y >= Math.min(start.y, end.y) - EPSILON
    && point.y <= Math.max(start.y, end.y) + EPSILON;
}

function pointInPolygon(point: Point, polygon: Polygon, strict = false): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (pointOnSegment(point, start, end)) return !strict;
    const crossesRay = (start.y > point.y) !== (end.y > point.y)
      && point.x < (end.x - start.x) * (point.y - start.y) / (end.y - start.y) + start.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = cross(a, b, c);
  return Math.abs(value) <= EPSILON ? 0 : value > 0 ? 1 : -1;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return (abC === 0 && pointOnSegment(c, a, b))
    || (abD === 0 && pointOnSegment(d, a, b))
    || (cdA === 0 && pointOnSegment(a, c, d))
    || (cdB === 0 && pointOnSegment(b, c, d));
}

function boundariesIntersect(left: Polygon, right: Polygon): boolean {
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (segmentsIntersect(left[leftIndex], left[(leftIndex + 1) % left.length], right[rightIndex], right[(rightIndex + 1) % right.length])) return true;
    }
  }
  return false;
}

function polygonContainsPolygon(outer: Polygon, inner: Polygon): boolean {
  return inner.every((point) => pointInPolygon(point, outer, true)) && !boundariesIntersect(outer, inner);
}

function polygonIntersects(left: Polygon, right: Polygon): boolean {
  return boundariesIntersect(left, right)
    || left.some((point) => pointInPolygon(point, right, true))
    || right.some((point) => pointInPolygon(point, left, true));
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

function footprintTouchesWall(footprint: Polygon, wall: Wall): boolean {
  if (pointInPolygon(wall.start, footprint, true) || pointInPolygon(wall.end, footprint, true)) return true;
  for (let index = 0; index < footprint.length; index += 1) {
    const start = footprint[index];
    const end = footprint[(index + 1) % footprint.length];
    if (segmentsIntersect(start, end, wall.start, wall.end)) return true;
    if (distanceToSegment(start, wall.start, wall.end) <= wall.thickness / 2 + EPSILON) return true;
    if (distanceToSegment(wall.start, start, end) <= wall.thickness / 2 + EPSILON
      || distanceToSegment(wall.end, start, end) <= wall.thickness / 2 + EPSILON) return true;
  }
  return false;
}

function footprintFitsRoom(footprint: Polygon, room: Room): boolean {
  if (!polygonContainsPolygon(room.points, footprint)) return false;
  for (const hole of room.holes ?? []) {
    if (polygonIntersects(footprint, hole)) return false;
    if (footprint.some((point) => pointInPolygon(point, hole, true))
      || hole.some((point) => pointInPolygon(point, footprint, true))) return false;
  }
  return true;
}

function validatePlacement(project: DesignProject, item: FurnitureInstance): void {
  if (!Number.isFinite(item.position.x) || !Number.isFinite(item.position.y)) throw new TypeError('furniture position must contain finite coordinates');
  if (!Number.isFinite(item.rotation) || !Number.isFinite(item.width) || !Number.isFinite(item.depth) || item.width <= 0 || item.depth <= 0) {
    throw new RangeError('furniture footprint must have finite rotation and positive dimensions');
  }
  if (!project.levels.some((level) => level.id === item.levelId)) throw new RangeError('furniture must remain on an existing floor');

  const footprint = furnitureFootprint(item);
  const sameLevelRooms = project.rooms.filter((room) => room.levelId === item.levelId);
  const assignedRoom = item.roomId === undefined
    ? undefined
    : project.rooms.find((room) => room.id === item.roomId);
  if (item.roomId !== undefined && (!assignedRoom || assignedRoom.levelId !== item.levelId)) {
    throw new RangeError('furniture must remain on its assigned floor and room');
  }
  const containingRooms = (assignedRoom ? [assignedRoom] : sameLevelRooms)
    .filter((room) => footprintFitsRoom(footprint, room));
  if (containingRooms.length === 0) throw new RangeError('furniture must remain fully inside its assigned room on this floor');
  if (item.roomId === undefined && containingRooms.length > 1) throw new RangeError('furniture placement is ambiguous across overlapping rooms');

  if (project.walls.some((wall) => wall.levelId === item.levelId && footprintTouchesWall(footprint, wall))) {
    throw new RangeError('furniture cannot overlap a wall');
  }
  const conflicts = project.furniture.some((other) => other.id !== item.id && !other.hidden && other.levelId === item.levelId
    && polygonIntersects(footprint, furnitureFootprint(other)));
  if (conflicts) throw new RangeError('furniture cannot overlap another visible object');
}

/** Validate a proposed move without changing the project or creating history. */
export function assertFurniturePlacement(project: DesignProject, item: FurnitureInstance): void {
  validatePlacement(project, item);
}

export function canPlaceFurniture(project: DesignProject, furnitureId: string, position: Point): boolean {
  const item = project.furniture.find((candidate) => candidate.id === furnitureId);
  if (!item) return false;
  try {
    validatePlacement(project, { ...item, position });
    return true;
  } catch {
    return false;
  }
}
