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
} from './types';

const DEFAULT_WALL_THICKNESS = 0.12;
const DEFAULT_WALL_HEIGHT = 2.4;
const DEFAULT_MATERIAL_ID = 'material-neutral-floor';
const DEFAULT_LEVEL_ID = 'floor-ground';

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
    furniture: freeze([...(patch.furniture ?? project.furniture)]),
    materials: freeze([...(patch.materials ?? project.materials)]),
    updatedAt: new Date().toISOString(),
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
  thickness = DEFAULT_WALL_THICKNESS,
  height = DEFAULT_WALL_HEIGHT,
  materialId = 'material-neutral-wall',
  levelId = DEFAULT_LEVEL_ID,
): Wall {
  id(wallId, 'wall id');
  const from = point(start, 'wall start');
  const to = point(end, 'wall end');
  if (from.x === to.x && from.y === to.y) {
    throw new RangeError('wall start and end must be different points');
  }
  positive(thickness, 'wall thickness');
  positive(height, 'wall height');
  id(materialId, 'materialId');
  id(levelId, 'levelId');
  return freeze({ id: wallId, start: from, end: to, thickness, height, materialId, levelId });
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
    if (!subject.walls.some((wall) => wall.id === wallId)) throw new RangeError(`unknown wall: ${wallId}`);
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
  const level: Level = freeze({ id: levelId, name: name?.trim() || `Floor ${ordinal}`, elevation: base + 0.3, height: 2.7 });
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
  if (!Number.isFinite(furniture.rotation)) throw new TypeError('furniture rotation must be finite');
  if (!project.levels.some((level) => level.id === furniture.levelId)) throw new RangeError(`unknown level: ${furniture.levelId}`);
  const instance: FurnitureInstance = freeze({
    ...furniture,
    id: furniture.id ?? `furniture-${project.furniture.length + 1}`,
    position: point(furniture.position, 'furniture position'),
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

export type FurnitureChanges = Partial<Pick<FurnitureInstance, 'position' | 'rotation' | 'width' | 'depth' | 'height' | 'color'>>;

export function updateFurniture(project: DesignProject, furnitureId: string, changes: FurnitureChanges): DesignProject {
  id(furnitureId, 'furniture id');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  if (changes.position !== undefined) point(changes.position, 'furniture position');
  if (changes.rotation !== undefined && !Number.isFinite(changes.rotation)) throw new TypeError('rotation must be finite');
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
    position: point({ x: source.position.x + 0.35, y: source.position.y + 0.35 }, 'duplicate position'),
  });
  return copyProject(project, { furniture: [...project.furniture, duplicate] });
}

export function removeFurniture(project: DesignProject, furnitureId: string): DesignProject {
  id(furnitureId, 'furniture id');
  if (!project.furniture.some((item) => item.id === furnitureId)) throw new RangeError(`unknown furniture: ${furnitureId}`);
  return copyProject(project, { furniture: project.furniture.filter((item) => item.id !== furnitureId) });
}

export function removeWall(project: DesignProject, wallId: string): DesignProject {
  id(wallId, 'wall id');
  if (!project.walls.some((wall) => wall.id === wallId)) throw new RangeError(`unknown wall: ${wallId}`);
  return copyProject(project, { walls: project.walls.filter((wall) => wall.id !== wallId) });
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

function defaultLevel(): Level {
  return freeze({ id: DEFAULT_LEVEL_ID, name: 'Ground Floor', elevation: 0, height: DEFAULT_WALL_HEIGHT });
}

export function normalizeProject(value: unknown): DesignProject {
  if (!value || typeof value !== 'object') throw new TypeError('project must be an object');
  const candidate = value as Partial<DesignProject> & Record<string, unknown>;
  if (!Array.isArray(candidate.rooms) || !Array.isArray(candidate.walls) || !Array.isArray(candidate.furniture) || !Array.isArray(candidate.materials)) {
    throw new TypeError('project is missing required collections');
  }
  const rawLevels = Array.isArray(candidate.levels) ? candidate.levels : [];
  const levels: Level[] = rawLevels.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<Level>;
    const levelId = typeof item.id === 'string' && item.id.trim() ? item.id : `floor-${index + 1}`;
    const elevation = Number.isFinite(item.elevation) ? Number(item.elevation) : index * 3;
    const height = Number.isFinite(item.height) && Number(item.height) > 0 ? Number(item.height) : DEFAULT_WALL_HEIGHT;
    return [freeze({ id: levelId, name: typeof item.name === 'string' && item.name.trim() ? item.name : (index === 0 ? 'Ground Floor' : `Floor ${index + 1}`), elevation, height })];
  });
  if (!levels.length) levels.push(defaultLevel());
  const knownLevels = new Set(levels.map((level) => level.id));
  const fallbackLevelId = levels[0].id;
  const activeLevelId = typeof candidate.activeLevelId === 'string' && knownLevels.has(candidate.activeLevelId) ? candidate.activeLevelId : fallbackLevelId;
  const levelFor = (item: { levelId?: string }) => item.levelId && knownLevels.has(item.levelId) ? item.levelId : fallbackLevelId;
  const rooms = candidate.rooms.map((room) => freeze({ ...room, levelId: levelFor(room) })) as Room[];
  const walls = candidate.walls.map((wall) => freeze({ ...wall, levelId: levelFor(wall) })) as Wall[];
  const furniture = candidate.furniture.map((item) => freeze({ ...item, levelId: levelFor(item) })) as FurnitureInstance[];
  const materials = candidate.materials.map((item) => copyMaterial(item as Material));
  const units = candidate.units === 'ft' ? 'ft' : 'm';
  return freeze({
    ...candidate,
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : 'imported-project',
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'Imported Project',
    units: units as Units,
    levels: freeze(levels),
    activeLevelId,
    rooms: freeze(rooms),
    walls: freeze(walls),
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
  const level = defaultLevel();
  const materials: readonly Material[] = [
    copyMaterial({ id: DEFAULT_MATERIAL_ID, name: 'Warm Neutral Floor', category: 'floor', color: '#d9c7aa' }),
    copyMaterial({ id: 'material-neutral-wall', name: 'Soft White Wall', category: 'wall', color: '#f4f1eb' }),
  ];
  const room = createRectRoom('room-starter', 'Starter Room', 4, 3, { x: 0, y: 0 }, DEFAULT_MATERIAL_ID, level.id);
  const walls = [
    createWall('wall-north', { x: 0, y: 3 }, { x: 4, y: 3 }, DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT, 'material-neutral-wall', level.id),
    createWall('wall-east', { x: 4, y: 3 }, { x: 4, y: 0 }, DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT, 'material-neutral-wall', level.id),
    createWall('wall-south', { x: 4, y: 0 }, { x: 0, y: 0 }, DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT, 'material-neutral-wall', level.id),
    createWall('wall-west', { x: 0, y: 0 }, { x: 0, y: 3 }, DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT, 'material-neutral-wall', level.id),
  ];
  return freeze({
    id: projectId,
    name,
    units,
    levels: freeze([level]),
    activeLevelId: level.id,
    rooms: freeze([room]),
    walls: freeze(walls),
    furniture: freeze([]),
    materials: freeze(materials),
    updatedAt: new Date().toISOString(),
  });
}
