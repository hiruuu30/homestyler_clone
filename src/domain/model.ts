import type {
  DesignProject,
  FurnitureInput,
  FurnitureInstance,
  Level,
  Material,
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

function copyProject(project: DesignProject, patch: Partial<DesignProject>): DesignProject {
  return freeze({
    ...project,
    ...patch,
    levels: freeze([...(patch.levels ?? project.levels)]),
    rooms: freeze([...(patch.rooms ?? project.rooms)]),
    walls: freeze([...(patch.walls ?? project.walls)]),
    wallOpenings: freeze([...(patch.wallOpenings ?? project.wallOpenings)]),
    furniture: freeze([...(patch.furniture ?? project.furniture)]),
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
): Room {
  id(roomId, 'room id');
  id(name, 'room name');
  positive(width, 'room width');
  positive(depth, 'room depth');
  id(floorMaterialId, 'floorMaterialId');
  id(levelId, 'levelId');
  const start = point(origin, 'room origin');
  return freeze({
    id: roomId,
    name,
    points: freeze([
      start,
      point({ x: start.x + width, y: start.y }, 'room point'),
      point({ x: start.x + width, y: start.y + depth }, 'room point'),
      point({ x: start.x, y: start.y + depth }, 'room point'),
    ]),
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
  });
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
  const updatedWall = { ...wall, start, end };
  project.wallOpenings.filter((opening) => opening.wallId === wallId).forEach((opening) => validateOpening(updatedWall, opening));
  return copyProject(project, {
    walls: project.walls.map((item) => item.id === wallId ? freeze(updatedWall) : item),
  });
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
    materials: freeze(materials),
    updatedAt: new Date().toISOString(),
  });
}
