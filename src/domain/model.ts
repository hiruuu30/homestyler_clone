import type {
  DesignProject,
  FurnitureInput,
  FurnitureInstance,
  Level,
  Material,
  PlanUnderlay,
  Point,
  Room,
  Units,
  Wall,
  WallOpening,
  WallOpeningKind,
} from './types';

const DEFAULT_WALL_THICKNESS = 0.12;
const DEFAULT_WALL_HEIGHT = 2.4;
const DEFAULT_MATERIAL_ID = 'material-neutral-floor';
const DEFAULT_LEVEL_ID = 'floor-ground';
const MAX_UNDERLAY_SOURCE_LENGTH = 1_500_000;

function unitScale(from: Units, to: Units): number {
  if ((from !== 'm' && from !== 'ft') || (to !== 'm' && to !== 'ft')) throw new TypeError('units must be m or ft');
  return (from === 'ft' ? 0.3048 : 1) / (to === 'ft' ? 0.3048 : 1);
}

function scaleLength(value: number, factor: number): number {
  const scaled = Number((value * factor).toFixed(9));
  return Object.is(scaled, -0) ? 0 : scaled;
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function point(value: Point, label: string): Point {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} coordinates must be finite numbers`);
  }
  return freeze({ x: value.x, y: value.y });
}

function id(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be greater than zero`);
  }
  return value;
}

function signedPolygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(pointValue: Point, start: Point, end: Point, epsilon: number): boolean {
  return pointValue.x >= Math.min(start.x, end.x) - epsilon
    && pointValue.x <= Math.max(start.x, end.x) + epsilon
    && pointValue.y >= Math.min(start.y, end.y) - epsilon
    && pointValue.y <= Math.max(start.y, end.y) + epsilon;
}

function segmentFraction(pointValue: Point, start: Point, end: Point, tolerance = 1e-8): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return null;
  const fraction = ((pointValue.x - start.x) * dx + (pointValue.y - start.y) * dy) / lengthSquared;
  const distanceToLine = Math.abs(cross(start, end, pointValue)) / Math.sqrt(lengthSquared);
  if (distanceToLine > tolerance || fraction <= tolerance || fraction >= 1 - tolerance) return null;
  return fraction;
}

const SEGMENT_PARAMETER_EPSILON = 1e-8;
const SEGMENT_DISTANCE_EPSILON = 1e-8;

/** Return strict interior parameters for a proper X crossing; endpoint contacts are not X crossings. */
function properSegmentIntersection(
  start: Point,
  end: Point,
  otherStart: Point,
  otherEnd: Point,
): { fraction: number; otherFraction: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const otherDx = otherEnd.x - otherStart.x;
  const otherDy = otherEnd.y - otherStart.y;
  const offsetX = otherStart.x - start.x;
  const offsetY = otherStart.y - start.y;
  const denominator = dx * otherDy - dy * otherDx;
  const parallelTolerance = 1e-12 * Math.hypot(dx, dy) * Math.hypot(otherDx, otherDy);

  if (Math.abs(denominator) <= parallelTolerance) {
    const distance = Math.abs(dx * offsetY - dy * offsetX) / Math.hypot(dx, dy);
    if (distance <= SEGMENT_DISTANCE_EPSILON) {
      const lengthSquared = dx * dx + dy * dy;
      const first = (offsetX * dx + offsetY * dy) / lengthSquared;
      const second = ((otherEnd.x - start.x) * dx + (otherEnd.y - start.y) * dy) / lengthSquared;
      const overlapStart = Math.max(0, Math.min(first, second));
      const overlapEnd = Math.min(1, Math.max(first, second));
      if (overlapEnd - overlapStart > SEGMENT_PARAMETER_EPSILON) {
        throw new RangeError('new wall cannot overlap an existing wall');
      }
    }
    return null;
  }

  const fraction = (offsetX * otherDy - offsetY * otherDx) / denominator;
  const otherFraction = (offsetX * dy - offsetY * dx) / denominator;
  if (fraction <= SEGMENT_PARAMETER_EPSILON || fraction >= 1 - SEGMENT_PARAMETER_EPSILON
    || otherFraction <= SEGMENT_PARAMETER_EPSILON || otherFraction >= 1 - SEGMENT_PARAMETER_EPSILON) return null;
  return { fraction, otherFraction };
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const epsilon = 1e-9;
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const crossesAb = (abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon);
  const crossesCd = (cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon);
  if (crossesAb && crossesCd) return true;
  return (Math.abs(abC) <= epsilon && pointOnSegment(c, a, b, epsilon))
    || (Math.abs(abD) <= epsilon && pointOnSegment(d, a, b, epsilon))
    || (Math.abs(cdA) <= epsilon && pointOnSegment(a, c, d, epsilon))
    || (Math.abs(cdB) <= epsilon && pointOnSegment(b, c, d, epsilon));
}

function hasSelfIntersection(points: readonly Point[]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (second === firstNext || (first === 0 && secondNext === 0)) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function validateOpening(wall: Wall, opening: Pick<WallOpening, 'center' | 'width' | 'height' | 'sillHeight'>): void {
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  if (!Number.isFinite(opening.center)) throw new TypeError('opening center must be a finite number');
  positive(opening.width, 'opening width');
  positive(opening.height, 'opening height');
  if (!Number.isFinite(opening.sillHeight) || opening.sillHeight < 0) throw new RangeError('sill height must be zero or greater');
  if (opening.center - opening.width / 2 < 0 || opening.center + opening.width / 2 > length) {
    throw new RangeError('opening must fit within the wall length');
  }
  if (opening.sillHeight + opening.height > wall.height + 1e-9) {
    throw new RangeError('opening must fit within the wall height');
  }
}

function assertNoOpeningOverlap(openings: readonly WallOpening[], candidate: WallOpening): void {
  const left = candidate.center - candidate.width / 2;
  const right = candidate.center + candidate.width / 2;
  const top = candidate.sillHeight + candidate.height;
  for (const opening of openings) {
    if (opening.wallId !== candidate.wallId || opening.id === candidate.id) continue;
    const overlapsHorizontally = left < opening.center + opening.width / 2 - 1e-9
      && right > opening.center - opening.width / 2 + 1e-9;
    const overlapsVertically = candidate.sillHeight < opening.sillHeight + opening.height - 1e-9
      && top > opening.sillHeight + 1e-9;
    if (overlapsHorizontally && overlapsVertically) throw new RangeError('wall openings cannot overlap');
  }
}

function copyMaterial(material: Material): Material {
  id(material.id, 'material id');
  id(material.name, 'material name');
  id(material.category, 'material category');
  id(material.color, 'material color');
  if (material.textureUrl !== undefined) id(material.textureUrl, 'textureUrl');
  return freeze({ ...material });
}

function validateUnderlay(underlay: PlanUnderlay): void {
  id(underlay.id, 'underlay id');
  id(underlay.name, 'underlay name');
  id(underlay.levelId, 'underlay levelId');
  if (underlay.name.length > 120) throw new RangeError('underlay name must be 120 characters or fewer');
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(underlay.src)) {
    throw new TypeError('underlay source must be a supported embedded image');
  }
  if (underlay.src.length > MAX_UNDERLAY_SOURCE_LENGTH) throw new RangeError('underlay image is too large for local project storage');
  if (!Number.isFinite(underlay.x) || !Number.isFinite(underlay.y)) throw new TypeError('underlay position must be finite');
  positive(underlay.width, 'underlay width');
  positive(underlay.height, 'underlay height');
  positive(underlay.aspectRatio, 'underlay aspect ratio');
  const expectedHeight = underlay.width / underlay.aspectRatio;
  if (Math.abs(underlay.height - expectedHeight) > Math.max(1e-9, expectedHeight * 1e-6)) {
    throw new RangeError('underlay dimensions must preserve the source image aspect ratio');
  }
  if (!Number.isFinite(underlay.opacity) || underlay.opacity < 0 || underlay.opacity > 1) {
    throw new RangeError('underlay opacity must be between zero and one');
  }
}

function copyProject(project: DesignProject, patch: Partial<DesignProject>): DesignProject {
  return freeze({
    ...project,
    ...patch,
    levels: freeze([...(patch.levels ?? project.levels)]),
    rooms: freeze([...(patch.rooms ?? project.rooms)]),
    walls: freeze([...(patch.walls ?? project.walls)]),
    wallOpenings: freeze([...(patch.wallOpenings ?? project.wallOpenings)]),
    furniture: freeze([...(patch.furniture ?? project.furniture)]),
    underlays: freeze([...(patch.underlays ?? project.underlays)]),
    materials: freeze([...(patch.materials ?? project.materials)]),
    updatedAt: new Date().toISOString(),
  });
}

/** Convert every stored linear measurement while preserving the physical dimensions of the design. */
export function convertProjectUnits(project: DesignProject, units: Units): DesignProject {
  if (units !== 'm' && units !== 'ft') throw new TypeError('units must be m or ft');
  if (project.units === units) return project;
  const factor = unitScale(project.units, units);
  const scalePoint = (value: Point): Point => point({ x: scaleLength(value.x, factor), y: scaleLength(value.y, factor) }, 'scaled point');
  return copyProject(project, {
    units,
    levels: project.levels.map((level) => freeze({
      ...level,
      elevation: scaleLength(level.elevation, factor),
      height: scaleLength(level.height, factor),
    })),
    rooms: project.rooms.map((room) => freeze({ ...room, points: freeze(room.points.map(scalePoint)) })),
    walls: project.walls.map((wall) => freeze({
      ...wall,
      start: scalePoint(wall.start),
      end: scalePoint(wall.end),
      thickness: scaleLength(wall.thickness, factor),
      height: scaleLength(wall.height, factor),
    })),
    wallOpenings: project.wallOpenings.map((opening) => freeze({
      ...opening,
      center: scaleLength(opening.center, factor),
      width: scaleLength(opening.width, factor),
      height: scaleLength(opening.height, factor),
      sillHeight: scaleLength(opening.sillHeight, factor),
    })),
    furniture: project.furniture.map((item) => freeze({
      ...item,
      position: scalePoint(item.position),
      elevation: scaleLength(item.elevation, factor),
      width: scaleLength(item.width, factor),
      depth: scaleLength(item.depth, factor),
      height: scaleLength(item.height, factor),
    })),
    underlays: project.underlays.map((item) => freeze({
      ...item,
      x: scaleLength(item.x, factor),
      y: scaleLength(item.y, factor),
      width: scaleLength(item.width, factor),
      height: scaleLength(item.height, factor),
    })),
  });
}

export function createRectRoom(
  roomId: string,
  name: string,
  width: number,
  depth: number,
  origin: Point = { x: 0, y: 0 },
  floorMaterialId = DEFAULT_MATERIAL_ID,
  levelId = DEFAULT_LEVEL_ID,
  units: Units = 'm',
): Room {
  positive(width, 'room width');
  positive(depth, 'room depth');
  const start = point(origin, 'room origin');
  return createPolygonRoom(roomId, name, [
    start,
    { x: start.x + width, y: start.y },
    { x: start.x + width, y: start.y + depth },
    { x: start.x, y: start.y + depth },
  ], floorMaterialId, levelId, units);
}

/** Create a simple room outline; self-intersections and degenerate edges are rejected. */
export function createPolygonRoom(
  roomId: string,
  name: string,
  vertices: readonly Point[],
  floorMaterialId = DEFAULT_MATERIAL_ID,
  levelId = DEFAULT_LEVEL_ID,
  units: Units = 'm',
): Room {
  id(roomId, 'room id');
  id(name, 'room name');
  id(floorMaterialId, 'floorMaterialId');
  id(levelId, 'levelId');
  const scale = unitScale('m', units);
  const points = vertices.map((vertex, index) => point(vertex, `room point ${index + 1}`));
  if (points.length > 1 && points[0].x === points.at(-1)!.x && points[0].y === points.at(-1)!.y) points.pop();
  if (points.length < 3) throw new RangeError('a room needs at least three distinct vertices');
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (Math.hypot(next.x - current.x, next.y - current.y) <= 1e-9) {
      throw new RangeError('room edges must have non-zero length');
    }
  }
  if (hasSelfIntersection(points)) throw new RangeError('room outline cannot self-intersect');
  if (Math.abs(signedPolygonArea(points)) < 0.01 * scale * scale) {
    throw new RangeError('room area must be at least 0.01 square metres');
  }
  return freeze({
    id: roomId,
    name,
    points: freeze(points),
    floorMaterialId,
    ceilingVisible: true,
    levelId,
  });
}

export function createWall(
  wallId: string,
  start: Point,
  end: Point,
  thickness: number | undefined = undefined,
  height: number | undefined = undefined,
  materialId = 'material-neutral-wall',
  levelId = DEFAULT_LEVEL_ID,
  units: Units = 'm',
): Wall {
  id(wallId, 'wall id');
  const from = point(start, 'wall start');
  const to = point(end, 'wall end');
  if (from.x === to.x && from.y === to.y) {
    throw new RangeError('wall start and end must be different points');
  }
  const factor = unitScale('m', units);
  const wallThickness = thickness ?? DEFAULT_WALL_THICKNESS * factor;
  const wallHeight = height ?? DEFAULT_WALL_HEIGHT * factor;
  positive(wallThickness, 'wall thickness');
  positive(wallHeight, 'wall height');
  id(materialId, 'materialId');
  id(levelId, 'levelId');
  return freeze({ id: wallId, start: from, end: to, thickness: wallThickness, height: wallHeight, materialId, levelId });
}

/** Add a wall and connect its endpoints to same-floor wall and room edges. */
export function addWall(project: DesignProject, input: Wall): DesignProject {
  id(input.id, 'wall id');
  if (project.walls.some((wall) => wall.id === input.id)) throw new RangeError(`wall ID already exists: ${input.id}`);
  const wall = createWall(input.id, input.start, input.end, input.thickness, input.height, input.materialId, input.levelId, project.units);
  const crossings = project.walls.flatMap((candidate) => {
    if (candidate.levelId !== wall.levelId) return [];
    const intersection = properSegmentIntersection(wall.start, wall.end, candidate.start, candidate.end);
    return intersection ? [{ wallId: candidate.id, ...intersection }] : [];
  });
  if (crossings.length > 1) throw new RangeError('adding a wall through multiple wall crossings is not supported yet');
  let next = copyProject(project, { walls: [...project.walls, wall] });
  if (crossings.length === 1) {
    const crossing = crossings[0];
    next = splitWall(next, crossing.wallId, crossing.otherFraction);
    next = splitWall(next, wall.id, crossing.fraction);
  }
  for (const endpoint of [wall.start, wall.end]) {
    while (true) {
      const host = next.walls.find((candidate) => candidate.id !== wall.id
        && candidate.levelId === wall.levelId
        && segmentFraction(endpoint, candidate.start, candidate.end) !== null);
      if (!host) break;
      const fraction = segmentFraction(endpoint, host.start, host.end);
      if (fraction === null) break;
      next = splitWall(next, host.id, fraction);
    }
  }
  const rooms = next.rooms.map((room) => {
    if (room.levelId !== wall.levelId) return room;
    const targets = [wall.start, wall.end].filter((endpoint) => !room.points.some((vertex) => vertex.x === endpoint.x && vertex.y === endpoint.y));
    const expanded: Point[] = [];
    let inserted = false;
    for (let index = 0; index < room.points.length; index += 1) {
      const from = room.points[index];
      const to = room.points[(index + 1) % room.points.length];
      expanded.push(from);
      const insertions = targets
        .map((endpoint) => ({ point: endpoint, fraction: segmentFraction(endpoint, from, to) }))
        .filter((item): item is { point: Point; fraction: number } => item.fraction !== null)
        .sort((left, right) => left.fraction - right.fraction);
      insertions.forEach((item) => { expanded.push(item.point); inserted = true; });
    }
    if (!inserted) return room;
    const validated = createPolygonRoom(room.id, room.name, expanded, room.floorMaterialId, room.levelId, project.units);
    return freeze({ ...room, points: validated.points });
  });
  return copyProject(next, { rooms });
}

export function addWallOpening(project: DesignProject, wallId: string, kind: WallOpeningKind): DesignProject {
  id(wallId, 'wall id');
  if (kind !== 'door' && kind !== 'window') throw new TypeError('opening kind must be door or window');
  const wall = project.walls.find((item) => item.id === wallId);
  if (!wall) throw new RangeError(`unknown wall: ${wallId}`);
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  const factor = unitScale('m', project.units);
  const width = kind === 'door' ? Math.min(0.9 * factor, length * 0.7) : Math.min(1.2 * factor, length * 0.7);
  const height = kind === 'door' ? Math.min(2.05 * factor, wall.height) : Math.min(1.2 * factor, Math.max(0.1 * factor, wall.height - 0.6 * factor));
  const sillHeight = kind === 'door' ? 0 : Math.min(0.9 * factor, wall.height - height);
  if (width < 0.2 * factor) throw new RangeError('wall is too short for a door or window');
  const usedIds = new Set(project.wallOpenings.map((opening) => opening.id));
  let suffix = 1;
  while (usedIds.has(`opening-${suffix}`)) suffix += 1;
  const opening: WallOpening = freeze({
    id: `opening-${suffix}`,
    wallId,
    kind,
    center: length / 2,
    width,
    height,
    sillHeight,
  });
  validateOpening(wall, opening);
  assertNoOpeningOverlap(project.wallOpenings, opening);
  return copyProject(project, { wallOpenings: [...project.wallOpenings, opening] });
}

export type WallOpeningChanges = Partial<Pick<WallOpening, 'center' | 'width' | 'height' | 'sillHeight'>>;

export function updateWallOpening(project: DesignProject, openingId: string, changes: WallOpeningChanges): DesignProject {
  id(openingId, 'opening id');
  const current = project.wallOpenings.find((opening) => opening.id === openingId);
  if (!current) throw new RangeError(`unknown opening: ${openingId}`);
  const wall = project.walls.find((item) => item.id === current.wallId);
  if (!wall) throw new RangeError(`opening host wall is missing: ${current.wallId}`);
  const updated = freeze({ ...current, ...changes });
  validateOpening(wall, updated);
  assertNoOpeningOverlap(project.wallOpenings, updated);
  return copyProject(project, {
    wallOpenings: project.wallOpenings.map((opening) => opening.id === openingId ? updated : opening),
  });
}

export function removeWallOpening(project: DesignProject, openingId: string): DesignProject {
  id(openingId, 'opening id');
  if (!project.wallOpenings.some((opening) => opening.id === openingId)) throw new RangeError(`unknown opening: ${openingId}`);
  return copyProject(project, { wallOpenings: project.wallOpenings.filter((opening) => opening.id !== openingId) });
}

export function updateWallThickness(wall: Wall, thickness: number): Wall;
export function updateWallThickness(project: DesignProject, wallId: string, thickness: number): DesignProject;
export function updateWallThickness(
  subject: Wall | DesignProject,
  wallIdOrThickness: string | number,
  maybeThickness?: number,
): Wall | DesignProject {
  if ('walls' in subject) {
    const wallId = id(wallIdOrThickness as string, 'wall id');
    const nextThickness = positive(maybeThickness as number, 'wall thickness');
    if (!subject.walls.some((wall) => wall.id === wallId)) throw new RangeError(`unknown wall: ${wallId}`);
    return copyProject(subject, {
      walls: subject.walls.map((wall) => wall.id === wallId ? freeze({ ...wall, thickness: nextThickness }) : wall),
    });
  }
  const nextThickness = positive(wallIdOrThickness as number, 'wall thickness');
  return freeze({ ...subject, thickness: nextThickness });
}

export function updateWallHeight(wall: Wall, height: number): Wall;
export function updateWallHeight(project: DesignProject, wallId: string, height: number): DesignProject;
export function updateWallHeight(
  subject: Wall | DesignProject,
  wallIdOrHeight: string | number,
  maybeHeight?: number,
): Wall | DesignProject {
  if ('walls' in subject) {
    const wallId = id(wallIdOrHeight as string, 'wall id');
    const nextHeight = positive(maybeHeight as number, 'wall height');
    const wall = subject.walls.find((item) => item.id === wallId);
    if (!wall) throw new RangeError(`unknown wall: ${wallId}`);
    subject.wallOpenings.filter((opening) => opening.wallId === wallId).forEach((opening) => {
      validateOpening({ ...wall, height: nextHeight }, opening);
    });
    return copyProject(subject, {
      walls: subject.walls.map((wall) => wall.id === wallId ? freeze({ ...wall, height: nextHeight }) : wall),
    });
  }
  const nextHeight = positive(wallIdOrHeight as number, 'wall height');
  return freeze({ ...subject, height: nextHeight });
}

export function addLevel(project: DesignProject, name?: string): DesignProject {
  const usedIds = new Set(project.levels.map((level) => level.id));
  let ordinal = project.levels.length + 1;
  let levelId = `floor-${ordinal}`;
  while (usedIds.has(levelId)) {
    ordinal += 1;
    levelId = `floor-${ordinal}`;
  }
  const base = project.levels.reduce((highest, level) => Math.max(highest, level.elevation + level.height), 0);
  const factor = unitScale('m', project.units);
  const level: Level = freeze({ id: levelId, name: name?.trim() || `Floor ${ordinal}`, elevation: base + 0.3 * factor, height: 2.7 * factor });
  return copyProject(project, { levels: [...project.levels, level], activeLevelId: level.id });
}

export function removeLevel(project: DesignProject, levelId: string): DesignProject {
  id(levelId, 'level id');
  if (!project.levels.some((level) => level.id === levelId)) throw new RangeError(`unknown level: ${levelId}`);
  if (project.levels.length <= 1) throw new RangeError('a project must keep at least one floor');
  const levels = project.levels.filter((level) => level.id !== levelId);
  const activeLevelId = project.activeLevelId === levelId ? levels[0].id : project.activeLevelId;
  return copyProject(project, {
    levels,
    activeLevelId,
    rooms: project.rooms.filter((room) => room.levelId !== levelId),
    walls: project.walls.filter((wall) => wall.levelId !== levelId),
    wallOpenings: project.wallOpenings.filter((opening) => project.walls.some((wall) => wall.id === opening.wallId && wall.levelId !== levelId)),
    furniture: project.furniture.filter((item) => item.levelId !== levelId),
    underlays: project.underlays.filter((item) => item.levelId !== levelId),
  });
}

export type PlanUnderlayInput = Omit<PlanUnderlay, 'id'> & { id?: string };
export type PlanUnderlayChanges = Partial<Pick<PlanUnderlay, 'name' | 'x' | 'y' | 'width' | 'height' | 'opacity'>>;

export function createPlanUnderlay(project: DesignProject, input: PlanUnderlayInput): DesignProject {
  const usedIds = new Set(project.underlays.map((item) => item.id));
  let suffix = project.underlays.length + 1;
  let underlayId = input.id ?? `underlay-${suffix}`;
  while (usedIds.has(underlayId)) underlayId = `underlay-${++suffix}`;
  const underlay = freeze({ ...input, id: id(underlayId, 'underlay id'), levelId: id(input.levelId, 'underlay levelId') });
  validateUnderlay(underlay);
  if (!project.levels.some((level) => level.id === underlay.levelId)) throw new RangeError(`unknown underlay level: ${underlay.levelId}`);
  return copyProject(project, { underlays: [...project.underlays, underlay] });
}

export function updatePlanUnderlay(project: DesignProject, underlayId: string, changes: PlanUnderlayChanges): DesignProject {
  id(underlayId, 'underlay id');
  const current = project.underlays.find((item) => item.id === underlayId);
  if (!current) throw new RangeError(`unknown underlay: ${underlayId}`);
  const updated = freeze({ ...current, ...changes });
  validateUnderlay(updated);
  return copyProject(project, { underlays: project.underlays.map((item) => item.id === underlayId ? updated : item) });
}

export function removePlanUnderlay(project: DesignProject, underlayId: string): DesignProject {
  id(underlayId, 'underlay id');
  if (!project.underlays.some((item) => item.id === underlayId)) throw new RangeError(`unknown underlay: ${underlayId}`);
  return copyProject(project, { underlays: project.underlays.filter((item) => item.id !== underlayId) });
}

export function assignRoomMaterial(room: Room, materialId: string): Room;
export function assignRoomMaterial(project: DesignProject, roomId: string, materialId: string): DesignProject;
export function assignRoomMaterial(
  subject: Room | DesignProject,
  roomIdOrMaterialId: string,
  maybeMaterialId?: string,
): Room | DesignProject {
  if ('rooms' in subject) {
    const roomId = id(roomIdOrMaterialId, 'room id');
    const materialId = id(maybeMaterialId as string, 'material id');
    if (!subject.rooms.some((room) => room.id === roomId)) throw new RangeError(`unknown room: ${roomId}`);
    return copyProject(subject, {
      rooms: subject.rooms.map((room) => room.id === roomId ? freeze({ ...room, floorMaterialId: materialId }) : room),
    });
  }
  const materialId = id(roomIdOrMaterialId, 'material id');
  return freeze({ ...subject, floorMaterialId: materialId });
}

export function addFurniture(project: DesignProject, furniture: FurnitureInput): DesignProject {
  id(furniture.assetId, 'assetId');
  id(furniture.name, 'furniture name');
  id(furniture.color, 'furniture color');
  id(furniture.levelId, 'levelId');
  if (furniture.roomId !== undefined) id(furniture.roomId, 'roomId');
  positive(furniture.width, 'furniture width');
  positive(furniture.depth, 'furniture depth');
  positive(furniture.height, 'furniture height');
  if (!Number.isFinite(furniture.elevation)) throw new TypeError('furniture elevation must be finite');
  if (!Number.isFinite(furniture.rotation)) throw new TypeError('furniture rotation must be finite');
  if (furniture.rotationX !== undefined && !Number.isFinite(furniture.rotationX)) throw new TypeError('furniture X rotation must be finite');
  if (furniture.rotationZ !== undefined && !Number.isFinite(furniture.rotationZ)) throw new TypeError('furniture Z rotation must be finite');
  if (!project.levels.some((level) => level.id === furniture.levelId)) throw new RangeError(`unknown level: ${furniture.levelId}`);
  const instance: FurnitureInstance = freeze({
    ...furniture,
    id: furniture.id ?? `furniture-${project.furniture.length + 1}`,
    position: point(furniture.position, 'furniture position'),
    rotationX: furniture.rotationX ?? 0,
    rotationZ: furniture.rotationZ ?? 0,
    hidden: furniture.hidden ?? false,
  });
  id(instance.id, 'furniture id');
  if (project.furniture.some((item) => item.id === instance.id)) throw new RangeError(`duplicate furniture id: ${instance.id}`);
  if (instance.roomId !== undefined && !project.rooms.some((room) => room.id === instance.roomId)) {
    throw new RangeError(`unknown room: ${instance.roomId}`);
  }
  return copyProject(project, { furniture: [...project.furniture, instance] });
}

export function rotateFurniture(furniture: FurnitureInstance, degrees: number): FurnitureInstance;
export function rotateFurniture(project: DesignProject, furnitureId: string, degrees: number): DesignProject;
export function rotateFurniture(
  subject: FurnitureInstance | DesignProject,
  furnitureIdOrDegrees: string | number,
  maybeDegrees?: number,
): FurnitureInstance | DesignProject {
  if ('furniture' in subject) {
    const furnitureId = id(furnitureIdOrDegrees as string, 'furniture id');
    const degrees = maybeDegrees as number;
    if (!Number.isFinite(degrees)) throw new TypeError('rotation degrees must be finite');
    if (!subject.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
    return copyProject(subject, {
      furniture: subject.furniture.map((item) => item.id === furnitureId ? freeze({ ...item, rotation: item.rotation + degrees }) : item),
    });
  }
  const degrees = furnitureIdOrDegrees as number;
  if (!Number.isFinite(degrees)) throw new TypeError('rotation degrees must be finite');
  return freeze({ ...subject, rotation: subject.rotation + degrees });
}

export function moveFurniture(project: DesignProject, furnitureId: string, position: Point): DesignProject {
  id(furnitureId, 'furniture id');
  const nextPosition = point(position, 'furniture position');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  return copyProject(project, {
    furniture: project.furniture.map((item) => item.id === furnitureId ? freeze({ ...item, position: nextPosition }) : item),
  });
}

export type FurnitureChanges = Partial<Pick<FurnitureInstance, 'position' | 'elevation' | 'rotation' | 'rotationX' | 'rotationZ' | 'width' | 'depth' | 'height' | 'color'>>;

export function updateFurniture(project: DesignProject, furnitureId: string, changes: FurnitureChanges): DesignProject {
  id(furnitureId, 'furniture id');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  if (changes.position !== undefined) point(changes.position, 'furniture position');
  if (changes.elevation !== undefined && !Number.isFinite(changes.elevation)) throw new TypeError('elevation must be finite');
  if (changes.rotation !== undefined && !Number.isFinite(changes.rotation)) throw new TypeError('rotation must be finite');
  if (changes.rotationX !== undefined && !Number.isFinite(changes.rotationX)) throw new TypeError('X rotation must be finite');
  if (changes.rotationZ !== undefined && !Number.isFinite(changes.rotationZ)) throw new TypeError('Z rotation must be finite');
  if (changes.width !== undefined) positive(changes.width, 'furniture width');
  if (changes.depth !== undefined) positive(changes.depth, 'furniture depth');
  if (changes.height !== undefined) positive(changes.height, 'furniture height');
  if (changes.color !== undefined) id(changes.color, 'furniture color');
  const normalized = changes.position === undefined ? changes : { ...changes, position: point(changes.position, 'furniture position') };
  return copyProject(project, {
    furniture: project.furniture.map((item) => item.id === furnitureId ? freeze({ ...item, ...normalized }) : item),
  });
}

export function duplicateFurniture(project: DesignProject, furnitureId: string): DesignProject {
  id(furnitureId, 'furniture id');
  const source = project.furniture.find((item) => item.id === furnitureId);
  if (!source) throw new RangeError(`unknown furniture: ${furnitureId}`);
  const ids = new Set(project.furniture.map((item) => item.id));
  let suffix = project.furniture.length + 1;
  let duplicateId = `furniture-${suffix}`;
  while (ids.has(duplicateId)) duplicateId = `furniture-${++suffix}`;
  const duplicate: FurnitureInstance = freeze({
    ...source,
    id: duplicateId,
    position: point({
      x: source.position.x + 0.35 * unitScale('m', project.units),
      y: source.position.y + 0.35 * unitScale('m', project.units),
    }, 'duplicate position'),
  });
  return copyProject(project, { furniture: [...project.furniture, duplicate] });
}

export function arrayFurniture(project: DesignProject, furnitureId: string, copies: number, offset: Point): DesignProject {
  id(furnitureId, 'furniture id');
  if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new RangeError('array copies must be an integer from 1 to 100');
  const delta = point(offset, 'array offset');
  if (delta.x === 0 && delta.y === 0) throw new RangeError('array offset must move each copy');
  const source = project.furniture.find((item) => item.id === furnitureId);
  if (!source) throw new RangeError(`unknown furniture: ${furnitureId}`);
  const usedIds = new Set(project.furniture.map((item) => item.id));
  let suffix = 1;
  const created = Array.from({ length: copies }, (_, index) => {
    let nextId = `furniture-${suffix}`;
    while (usedIds.has(nextId)) nextId = `furniture-${++suffix}`;
    usedIds.add(nextId);
    suffix += 1;
    return freeze({
      ...source,
      id: nextId,
      name: `${source.name} ${index + 2}`,
      position: point({ x: source.position.x + delta.x * (index + 1), y: source.position.y + delta.y * (index + 1) }, 'array position'),
    });
  });
  return copyProject(project, { furniture: [...project.furniture, ...created] });
}

export function removeFurniture(project: DesignProject, furnitureId: string): DesignProject {
  id(furnitureId, 'furniture id');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  return copyProject(project, { furniture: project.furniture.filter((item) => item.id !== furnitureId) });
}

export function removeWall(project: DesignProject, wallId: string): DesignProject {
  id(wallId, 'wall id');
  if (!project.walls.some((wall) => wall.id === wallId)) throw new RangeError(`unknown wall: ${wallId}`);
  return copyProject(project, {
    walls: project.walls.filter((wall) => wall.id !== wallId),
    wallOpenings: project.wallOpenings.filter((opening) => opening.wallId !== wallId),
  });
}

export type WallEndpointChanges = Partial<Pick<Wall, 'start' | 'end'>>;

export function updateWallEndpoints(project: DesignProject, wallId: string, changes: WallEndpointChanges): DesignProject {
  id(wallId, 'wall id');
  const wall = project.walls.find((item) => item.id === wallId);
  if (!wall) throw new RangeError(`unknown wall: ${wallId}`);
  const start = changes.start === undefined ? wall.start : point(changes.start, 'wall start');
  const end = changes.end === undefined ? wall.end : point(changes.end, 'wall end');
  if (start.x === end.x && start.y === end.y) throw new RangeError('wall endpoints must be different points');
  const samePoint = (left: Point, right: Point) => left.x === right.x && left.y === right.y;
  const nodeKey = (levelId: string, value: Point) => JSON.stringify([levelId, value.x || 0, value.y || 0]);
  const movedNodes = new Map<string, Point>();
  const movedTargets: { levelId: string; point: Point }[] = [];
  if (!samePoint(start, wall.start)) {
    movedNodes.set(nodeKey(wall.levelId, wall.start), start);
    movedTargets.push({ levelId: wall.levelId, point: start });
  }
  if (!samePoint(end, wall.end)) {
    movedNodes.set(nodeKey(wall.levelId, wall.end), end);
    movedTargets.push({ levelId: wall.levelId, point: end });
  }
  if (movedNodes.size === 0) return project;
  const walls: Wall[] = project.walls.map((item) => {
    const nextStart = movedNodes.get(nodeKey(item.levelId, item.start)) ?? item.start;
    const nextEnd = movedNodes.get(nodeKey(item.levelId, item.end)) ?? item.end;
    if (samePoint(nextStart, item.start) && samePoint(nextEnd, item.end)) return item;
    if (nextStart.x === nextEnd.x && nextStart.y === nextEnd.y) throw new RangeError(`endpoint edit would collapse wall: ${item.id}`);
    const updated = freeze({ ...item, start: point(nextStart, 'wall start'), end: point(nextEnd, 'wall end') });
    project.wallOpenings.filter((opening) => opening.wallId === item.id).forEach((opening) => validateOpening(updated, opening));
    return updated;
  });
  let wallOpenings = [...project.wallOpenings];
  const usedWallIds = new Set(walls.map((item) => item.id));
  let wallSuffix = 1;
  const nextWallId = () => {
    let candidate = `wall-${wallSuffix}`;
    while (usedWallIds.has(candidate)) candidate = `wall-${++wallSuffix}`;
    usedWallIds.add(candidate);
    return candidate;
  };
  const uniqueTargets = [...new Map(movedTargets.map((item) => [nodeKey(item.levelId, item.point), item])).values()];
  uniqueTargets.forEach(({ levelId, point: junction }) => {
    for (let index = 0; index < walls.length; index += 1) {
      const host = walls[index];
      if (host.levelId !== levelId || samePoint(junction, host.start) || samePoint(junction, host.end)) continue;
      if (segmentFraction(junction, host.start, host.end) === null) continue;
      const splitPoint = point(junction, 'wall junction');
      const splitLength = Math.hypot(splitPoint.x - host.start.x, splitPoint.y - host.start.y);
      const secondId = nextWallId();
      const first = freeze({ ...host, end: splitPoint });
      const second = freeze({ ...host, id: secondId, start: splitPoint });
      const splitOpenings = wallOpenings.map((opening) => {
        if (opening.wallId !== host.id) return opening;
        const openingStart = opening.center - opening.width / 2;
        const openingEnd = opening.center + opening.width / 2;
        if (openingStart < splitLength && openingEnd > splitLength) {
          throw new RangeError('cannot split a wall through an opening; move the opening first');
        }
        return openingStart >= splitLength
          ? freeze({ ...opening, wallId: secondId, center: opening.center - splitLength })
          : opening;
      });
      splitOpenings.filter((opening) => opening.wallId === host.id).forEach((opening) => validateOpening(first, opening));
      splitOpenings.filter((opening) => opening.wallId === secondId).forEach((opening) => validateOpening(second, opening));
      walls.splice(index, 1, first, second);
      wallOpenings = splitOpenings;
    }
  });
  const rooms = project.rooms.map((room) => {
    const points = room.points.map((vertex) => movedNodes.get(nodeKey(room.levelId, vertex)) ?? vertex);
    const moved = points.some((vertex, index) => !samePoint(vertex, room.points[index]));
    const targets = uniqueTargets.filter((item) => item.levelId === room.levelId && !points.some((vertex) => samePoint(vertex, item.point)));
    const expanded: Point[] = [];
    let inserted = false;
    for (let index = 0; index < points.length; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      expanded.push(from);
      const insertions = targets
        .map((item) => ({ point: item.point, fraction: segmentFraction(item.point, from, to) }))
        .filter((item): item is { point: Point; fraction: number } => item.fraction !== null)
        .sort((left, right) => left.fraction - right.fraction);
      insertions.forEach((item) => { expanded.push(item.point); inserted = true; });
    }
    if (!moved && !inserted) return room;
    const validated = createPolygonRoom(room.id, room.name, expanded, room.floorMaterialId, room.levelId, project.units);
    return freeze({ ...room, points: validated.points });
  });
  return copyProject(project, { walls, wallOpenings, rooms });
}

export function setFurnitureHidden(project: DesignProject, furnitureId: string, hidden: boolean): DesignProject {
  id(furnitureId, 'furniture id');
  if (typeof hidden !== 'boolean') throw new TypeError('hidden must be a boolean');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  return copyProject(project, {
    furniture: project.furniture.map((item) => item.id === furnitureId ? freeze({ ...item, hidden }) : item),
  });
}

export function splitWall(project: DesignProject, wallId: string, ratio = 0.5): DesignProject {
  id(wallId, 'wall id');
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) throw new RangeError('split ratio must be between zero and one');
  const wall = project.walls.find((item) => item.id === wallId);
  if (!wall) throw new RangeError(`unknown wall: ${wallId}`);
  const splitPoint = point({
    x: wall.start.x + (wall.end.x - wall.start.x) * ratio,
    y: wall.start.y + (wall.end.y - wall.start.y) * ratio,
  }, 'wall split point');
  const usedIds = new Set(project.walls.map((item) => item.id));
  let suffix = 1;
  let secondWallId = `wall-${suffix}`;
  while (usedIds.has(secondWallId)) secondWallId = `wall-${++suffix}`;
  const first = freeze({ ...wall, end: splitPoint });
  const second = freeze({ ...wall, id: secondWallId, start: splitPoint });
  const splitLength = Math.hypot(splitPoint.x - wall.start.x, splitPoint.y - wall.start.y);
  const wallOpenings = project.wallOpenings.map((opening) => {
    if (opening.wallId !== wallId) return opening;
    const openingStart = opening.center - opening.width / 2;
    const openingEnd = opening.center + opening.width / 2;
    if (openingStart < splitLength && openingEnd > splitLength) {
      throw new RangeError('cannot split a wall through an opening; move the opening first');
    }
    return openingStart >= splitLength
      ? freeze({ ...opening, wallId: secondWallId, center: opening.center - splitLength })
      : opening;
  });
  const walls = project.walls.flatMap((item) => item.id === wallId ? [first, second] : [item]);
  return copyProject(project, { walls, wallOpenings });
}

export function roomArea(room: Room): number {
  if (room.points.length < 3) throw new RangeError('a room needs at least three points');
  let sum = 0;
  for (let index = 0; index < room.points.length; index += 1) {
    const current = room.points[index];
    const next = room.points[(index + 1) % room.points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  const area = Math.abs(sum) / 2;
  if (!Number.isFinite(area) || area <= 0) throw new RangeError('room points must enclose a positive area');
  return area;
}

function defaultLevel(units: Units = 'm'): Level {
  return freeze({ id: DEFAULT_LEVEL_ID, name: 'Ground Floor', elevation: 0, height: DEFAULT_WALL_HEIGHT * unitScale('m', units) });
}

export function normalizeProject(value: unknown): DesignProject {
  if (!value || typeof value !== 'object') throw new TypeError('project must be an object');
  const candidate = value as Partial<DesignProject> & Record<string, unknown>;
  if (!Array.isArray(candidate.rooms) || !Array.isArray(candidate.walls) || !Array.isArray(candidate.furniture) || !Array.isArray(candidate.materials)) {
    throw new TypeError('project is missing required collections');
  }
  if (candidate.wallOpenings !== undefined && !Array.isArray(candidate.wallOpenings)) throw new TypeError('wallOpenings must be an array');
  if (candidate.underlays !== undefined && !Array.isArray(candidate.underlays)) throw new TypeError('underlays must be an array');
  const units: Units = candidate.units === 'ft' ? 'ft' : 'm';
  const rawLevels = Array.isArray(candidate.levels) ? candidate.levels : [];
  const levels: Level[] = rawLevels.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<Level>;
    const levelId = typeof item.id === 'string' && item.id.trim() ? item.id : `floor-${index + 1}`;
    const elevation = Number.isFinite(item.elevation) ? Number(item.elevation) : index * 3 * unitScale('m', units);
    const height = Number.isFinite(item.height) && Number(item.height) > 0 ? Number(item.height) : DEFAULT_WALL_HEIGHT * unitScale('m', units);
    return [freeze({ id: levelId, name: typeof item.name === 'string' && item.name.trim() ? item.name : (index === 0 ? 'Ground Floor' : `Floor ${index + 1}`), elevation, height })];
  });
  if (!levels.length) levels.push(defaultLevel(units));
  const knownLevels = new Set(levels.map((level) => level.id));
  const fallbackLevelId = levels[0].id;
  const activeLevelId = typeof candidate.activeLevelId === 'string' && knownLevels.has(candidate.activeLevelId) ? candidate.activeLevelId : fallbackLevelId;
  const levelFor = (item: { levelId?: string }) => item.levelId && knownLevels.has(item.levelId) ? item.levelId : fallbackLevelId;
  const rooms = candidate.rooms.map((room) => freeze({ ...room, levelId: levelFor(room) })) as Room[];
  const walls = candidate.walls.map((wall) => freeze({ ...wall, levelId: levelFor(wall) })) as Wall[];
  const wallOpenings: WallOpening[] = (candidate.wallOpenings ?? []).map((value) => {
    if (!value || typeof value !== 'object') throw new TypeError('wall opening must be an object');
    const raw = value as Partial<WallOpening>;
    const opening: WallOpening = freeze({
      id: id(raw.id as string, 'opening id'),
      wallId: id(raw.wallId as string, 'opening wallId'),
      kind: raw.kind as WallOpeningKind,
      center: raw.center as number,
      width: raw.width as number,
      height: raw.height as number,
      sillHeight: raw.sillHeight as number,
    });
    if (opening.kind !== 'door' && opening.kind !== 'window') throw new TypeError('opening kind must be door or window');
    const host = walls.find((wall) => wall.id === opening.wallId);
    if (!host) throw new RangeError(`opening host wall is missing: ${opening.wallId}`);
    validateOpening(host, opening);
    return opening;
  });
  const openingIds = new Set<string>();
  wallOpenings.forEach((opening, index) => {
    if (openingIds.has(opening.id)) throw new RangeError(`duplicate opening id: ${opening.id}`);
    openingIds.add(opening.id);
    assertNoOpeningOverlap(wallOpenings.slice(0, index), opening);
  });
  const furniture = candidate.furniture.map((item) => {
    const raw = item as Partial<FurnitureInstance>;
    const elevation = Number.isFinite(raw.elevation) ? Number(raw.elevation) : 0;
    const rotationX = Number.isFinite(raw.rotationX) ? Number(raw.rotationX) : 0;
    const rotationZ = Number.isFinite(raw.rotationZ) ? Number(raw.rotationZ) : 0;
    return freeze({ ...item, elevation, rotationX, rotationZ, hidden: raw.hidden === true, levelId: levelFor(item) });
  }) as FurnitureInstance[];
  const underlays = (candidate.underlays ?? []).map((value) => {
    if (!value || typeof value !== 'object') throw new TypeError('plan underlay must be an object');
    const raw = value as Partial<PlanUnderlay>;
    const underlay = freeze({
      id: raw.id as string,
      name: raw.name as string,
      src: raw.src as string,
      levelId: levelFor(raw),
      x: raw.x as number,
      y: raw.y as number,
      width: raw.width as number,
      height: raw.height as number,
      aspectRatio: raw.aspectRatio as number,
      opacity: raw.opacity as number,
    });
    validateUnderlay(underlay);
    return underlay;
  }) as PlanUnderlay[];
  const materials = candidate.materials.map((item) => copyMaterial(item as Material));
  return freeze({
    ...candidate,
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : 'imported-project',
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'Imported Project',
    units: units as Units,
    levels: freeze(levels),
    activeLevelId,
    rooms: freeze(rooms),
    walls: freeze(walls),
    wallOpenings: freeze(wallOpenings),
    furniture: freeze(furniture),
    underlays: freeze(underlays),
    materials: freeze(materials),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  });
}

export function createStarterProject(
  projectId = 'starter-project',
  name = 'Starter Project',
  units: Units = 'm',
): DesignProject {
  id(projectId, 'project id');
  id(name, 'project name');
  if (units !== 'm' && units !== 'ft') throw new TypeError('units must be m or ft');
  const factor = unitScale('m', units);
  const level = defaultLevel(units);
  const materials: readonly Material[] = [
    copyMaterial({ id: DEFAULT_MATERIAL_ID, name: 'Warm Neutral Floor', category: 'floor', color: '#d9c7aa' }),
    copyMaterial({ id: 'material-neutral-wall', name: 'Soft White Wall', category: 'wall', color: '#f4f1eb' }),
  ];
  const rooms = [
    createRectRoom('room-starter', 'Lobby', 2 * factor, 2.6 * factor, { x: 4.2 * factor, y: -0.5 * factor }, DEFAULT_MATERIAL_ID, level.id),
    createRectRoom('room-living', 'Living Room', 2 * factor, 2.6 * factor, { x: 2.2 * factor, y: 0.8 * factor }, DEFAULT_MATERIAL_ID, level.id),
  ];
  const walls = [
    createWall('wall-north', { x: 4.2 * factor, y: -0.5 * factor }, { x: 6.2 * factor, y: -0.5 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-east', { x: 6.2 * factor, y: -0.5 * factor }, { x: 6.2 * factor, y: 2.1 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-south', { x: 6.2 * factor, y: 2.1 * factor }, { x: 4.2 * factor, y: 2.1 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-partition', { x: 4.2 * factor, y: 3.4 * factor }, { x: 4.2 * factor, y: -0.5 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-living-south', { x: 4.2 * factor, y: 3.4 * factor }, { x: 2.2 * factor, y: 3.4 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-living-west', { x: 2.2 * factor, y: 3.4 * factor }, { x: 2.2 * factor, y: 0.8 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
    createWall('wall-living-north', { x: 2.2 * factor, y: 0.8 * factor }, { x: 4.2 * factor, y: 0.8 * factor }, undefined, undefined, 'material-neutral-wall', level.id, units),
  ];
  return freeze({
    id: projectId,
    name,
    units,
    levels: freeze([level]),
    activeLevelId: level.id,
    rooms: freeze(rooms),
    walls: freeze(walls),
    wallOpenings: freeze([]),
    furniture: freeze([]),
    underlays: freeze([]),
    materials: freeze(materials),
    updatedAt: new Date().toISOString(),
  });
}
