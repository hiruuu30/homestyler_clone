import type { DesignProject, Point, Room, Wall } from './types';
import { createPolygonRoom } from './model';

type Segment = Readonly<{ a: string; b: string }>;
type HalfEdge = Readonly<{ edge: number; from: string; to: string; angle: number }>;

const PARAMETER_EPSILON = 1e-8;
const DISTANCE_EPSILON = 1e-8;

function pointKey(point: Point): string {
  return JSON.stringify([point.x, point.y]);
}

function pointOnSegmentInterior(point: Point, start: Point, end: Point): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return false;
  const fraction = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const cross = Math.abs(dx * (point.y - start.y) - dy * (point.x - start.x));
  return cross / Math.sqrt(lengthSquared) <= DISTANCE_EPSILON
    && fraction > PARAMETER_EPSILON && fraction < 1 - PARAMETER_EPSILON;
}

function assertPlanarWallGraph(walls: readonly Wall[]): void {
  for (let first = 0; first < walls.length; first += 1) {
    const left = walls[first];
    const dx = left.end.x - left.start.x;
    const dy = left.end.y - left.start.y;
    const leftLength = Math.hypot(dx, dy);
    if (leftLength <= DISTANCE_EPSILON) throw new RangeError('zero-length walls must be repaired before room reconstruction');
    for (let second = first + 1; second < walls.length; second += 1) {
      const right = walls[second];
      const rx = right.end.x - right.start.x;
      const ry = right.end.y - right.start.y;
      const rightLength = Math.hypot(rx, ry);
      if (rightLength <= DISTANCE_EPSILON) throw new RangeError('zero-length walls must be repaired before room reconstruction');
      const qx = right.start.x - left.start.x;
      const qy = right.start.y - left.start.y;
      const denominator = dx * ry - dy * rx;
      const parallelTolerance = 1e-12 * leftLength * rightLength;
      if (Math.abs(denominator) <= parallelTolerance) {
        const lineDistance = Math.abs(dx * qy - dy * qx) / leftLength;
        if (lineDistance <= DISTANCE_EPSILON) {
          const leftSquared = dx * dx + dy * dy;
          const firstProjection = (qx * dx + qy * dy) / leftSquared;
          const secondProjection = ((right.end.x - left.start.x) * dx + (right.end.y - left.start.y) * dy) / leftSquared;
          const overlapStart = Math.max(0, Math.min(firstProjection, secondProjection));
          const overlapEnd = Math.min(1, Math.max(firstProjection, secondProjection));
          if (overlapEnd - overlapStart > PARAMETER_EPSILON) {
            throw new RangeError('overlapping walls must be resolved before room reconstruction');
          }
        }
        continue;
      }
      const fraction = (qx * ry - qy * rx) / denominator;
      const otherFraction = (qx * dy - qy * dx) / denominator;
      if (fraction > PARAMETER_EPSILON && fraction < 1 - PARAMETER_EPSILON
        && otherFraction > PARAMETER_EPSILON && otherFraction < 1 - PARAMETER_EPSILON) {
        throw new RangeError('repair wall crossings before reconstructing rooms');
      }
      if ([left.start, left.end].some((point) => pointOnSegmentInterior(point, right.start, right.end))
        || [right.start, right.end].some((point) => pointOnSegmentInterior(point, left.start, left.end))) {
        throw new RangeError('repair wall junctions before reconstructing rooms');
      }
    }
  }
}

function canonicalPolygonKey(points: readonly Point[]): string {
  const simplified = points.filter((current, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const collinear = Math.abs(incomingX * outgoingY - incomingY * outgoingX)
      <= 1e-9 * Math.hypot(incomingX, incomingY) * Math.hypot(outgoingX, outgoingY);
    return !collinear || incomingX * outgoingX + incomingY * outgoingY <= 0;
  });
  const rounded = simplified.map((point) => `${point.x.toFixed(9)},${point.y.toFixed(9)}`);
  const rotations = (values: readonly string[]) => values.map((_, start) => [
    ...values.slice(start), ...values.slice(0, start),
  ].join(';'));
  return [...rotations(rounded), ...rotations([...rounded].reverse())].sort()[0] ?? '';
}

function pointStrictlyInside(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx * (point.y - start.y) - dy * (point.x - start.x)) <= DISTANCE_EPSILON
      && point.x >= Math.min(start.x, end.x) - DISTANCE_EPSILON
      && point.x <= Math.max(start.x, end.x) + DISTANCE_EPSILON
      && point.y >= Math.min(start.y, end.y) - DISTANCE_EPSILON
      && point.y <= Math.max(start.y, end.y) + DISTANCE_EPSILON) return false;
    const crossesRay = (start.y > point.y) !== (end.y > point.y)
      && point.x < (end.x - start.x) * (point.y - start.y) / (end.y - start.y) + start.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function properEdgesCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denominator = abX * cdY - abY * cdX;
  const tolerance = 1e-12 * Math.hypot(abX, abY) * Math.hypot(cdX, cdY);
  if (Math.abs(denominator) <= tolerance) return false;
  const offsetX = c.x - a.x;
  const offsetY = c.y - a.y;
  const first = (offsetX * cdY - offsetY * cdX) / denominator;
  const second = (offsetX * abY - offsetY * abX) / denominator;
  return first > PARAMETER_EPSILON && first < 1 - PARAMETER_EPSILON
    && second > PARAMETER_EPSILON && second < 1 - PARAMETER_EPSILON;
}

function polygonsOverlapArea(left: readonly Point[], right: readonly Point[]): boolean {
  if (left.some((point) => pointStrictlyInside(point, right))
    || right.some((point) => pointStrictlyInside(point, left))) return true;
  for (let first = 0; first < left.length; first += 1) {
    const a = left[first];
    const b = left[(first + 1) % left.length];
    for (let second = 0; second < right.length; second += 1) {
      if (properEdgesCross(a, b, right[second], right[(second + 1) % right.length])) return true;
    }
  }
  return false;
}

function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function pruneDanglingEdges(edges: readonly Segment[]): Set<number> {
  const active = new Set(edges.map((_, index) => index));
  let changed = true;
  while (changed) {
    const degree = new Map<string, number>();
    active.forEach((edgeIndex) => {
      const edge = edges[edgeIndex];
      degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
      degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
    });
    const dangling = [...active].filter((edgeIndex) => {
      const edge = edges[edgeIndex];
      return (degree.get(edge.a) ?? 0) < 2 || (degree.get(edge.b) ?? 0) < 2;
    });
    changed = dangling.length > 0;
    dangling.forEach((edgeIndex) => active.delete(edgeIndex));
  }
  return active;
}

function boundedFaces(levelWalls: readonly Wall[]): Point[][] {
  assertPlanarWallGraph(levelWalls);
  const points = new Map<string, Point>();
  const edges: Segment[] = levelWalls.map((wall) => {
    const a = pointKey(wall.start);
    const b = pointKey(wall.end);
    points.set(a, wall.start);
    points.set(b, wall.end);
    if (a === b) throw new RangeError('zero-length walls must be repaired before room reconstruction');
    return { a, b };
  });
  const active = pruneDanglingEdges(edges);
  const adjacency = new Map<string, HalfEdge[]>();
  active.forEach((edgeIndex) => {
    const edge = edges[edgeIndex];
    const from = points.get(edge.a)!;
    const to = points.get(edge.b)!;
    const forward: HalfEdge = { edge: edgeIndex, from: edge.a, to: edge.b, angle: Math.atan2(to.y - from.y, to.x - from.x) };
    const reverse: HalfEdge = { edge: edgeIndex, from: edge.b, to: edge.a, angle: Math.atan2(from.y - to.y, from.x - to.x) };
    adjacency.set(edge.a, [...(adjacency.get(edge.a) ?? []), forward]);
    adjacency.set(edge.b, [...(adjacency.get(edge.b) ?? []), reverse]);
  });
  adjacency.forEach((halfEdges, key) => adjacency.set(key, halfEdges.sort((left, right) => left.angle - right.angle || left.edge - right.edge)));

  const halfEdgeKey = (halfEdge: HalfEdge) => `${halfEdge.edge}:${halfEdge.from}`;
  const visited = new Set<string>();
  const faces: Point[][] = [];
  for (const outgoing of adjacency.values()) {
    for (const start of outgoing) {
      const startKey = halfEdgeKey(start);
      if (visited.has(startKey)) continue;
      const cycle: string[] = [];
      let current = start;
      let closed = false;
      for (let steps = 0; steps <= active.size * 2; steps += 1) {
        const currentKey = halfEdgeKey(current);
        if (visited.has(currentKey)) {
          closed = currentKey === startKey;
          break;
        }
        visited.add(currentKey);
        cycle.push(current.from);
        const choices = adjacency.get(current.to) ?? [];
        const reverseIndex = choices.findIndex((candidate) => candidate.edge === current.edge && candidate.to === current.from);
        if (reverseIndex < 0 || choices.length === 0) break;
        current = choices[(reverseIndex - 1 + choices.length) % choices.length];
        if (halfEdgeKey(current) === startKey) {
          closed = true;
          break;
        }
      }
      if (!closed || cycle.length < 3 || new Set(cycle).size !== cycle.length) continue;
      const face = cycle.map((key) => points.get(key)!).filter(Boolean);
      if (face.length !== cycle.length || signedArea(face) <= 0) continue;
      faces.push(face);
    }
  }
  return faces;
}

/** Add rooms for bounded faces in a planar wall graph without replacing existing rooms. */
export function reconstructRoomsFromWalls(project: DesignProject): DesignProject {
  const usedIds = new Set(project.rooms.map((room) => room.id));
  const usedNames = new Set(project.rooms.map((room) => room.name.toLowerCase()));
  const knownKeys = new Map<string, Set<string>>();
  project.rooms.forEach((room) => {
    const keys = knownKeys.get(room.levelId) ?? new Set<string>();
    keys.add(canonicalPolygonKey(room.points));
    knownKeys.set(room.levelId, keys);
  });
  const floorMaterialId = project.materials.find((material) => material.category === 'floor')?.id
    ?? project.materials[0]?.id
    ?? 'material-neutral-floor';
  const generated: Room[] = [];
  let idIndex = 1;
  let nameIndex = 1;
  const allocateId = () => {
    while (usedIds.has(`room-reconstructed-${idIndex}`)) idIndex += 1;
    const result = `room-reconstructed-${idIndex++}`;
    usedIds.add(result);
    return result;
  };
  const allocateName = () => {
    while (usedNames.has(`room ${nameIndex}`)) nameIndex += 1;
    const result = `Room ${nameIndex++}`;
    usedNames.add(result.toLowerCase());
    return result;
  };

  for (const level of project.levels) {
    const levelRooms = project.rooms.filter((room) => room.levelId === level.id);
    const previouslyKnown = knownKeys.get(level.id) ?? new Set<string>();
    const levelGenerated: Room[] = [];
    const faces = boundedFaces(project.walls.filter((wall) => wall.levelId === level.id))
      .sort((left, right) => Math.abs(signedArea(left)) - Math.abs(signedArea(right)));
    for (const face of faces) {
      const key = canonicalPolygonKey(face);
      if (previouslyKnown.has(key)) continue;
      if ([...levelRooms, ...levelGenerated].some((room) => polygonsOverlapArea(face, room.points))) continue;
      try {
        const room = createPolygonRoom(allocateId(), allocateName(), face, floorMaterialId, level.id, project.units);
        levelGenerated.push(room);
        previouslyKnown.add(key);
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    }
    generated.push(...levelGenerated);
  }
  if (generated.length === 0) return project;
  return Object.freeze({
    ...project,
    rooms: Object.freeze([...project.rooms, ...generated]),
    updatedAt: new Date().toISOString(),
  });
}
