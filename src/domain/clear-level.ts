import type { DesignProject, FloorFinishMapping, Material, Room } from './types';

export type ClearLevelMode = 'furniture' | 'finishes' | 'furniture-and-finishes';

export const IDENTITY_FINISH: FloorFinishMapping = Object.freeze({
  pattern: 'none', colorOverlay: false, rotation: 0, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1,
});

const NEUTRAL_MATERIALS = {
  floor: { id: 'material-neutral-floor', name: 'Warm Neutral Floor', category: 'floor', color: '#d9c7aa' },
  wall: { id: 'material-neutral-wall', name: 'Soft White Wall', category: 'wall', color: '#f4f1eb' },
} as const;

function neutralMaterial(materials: readonly Material[], category: 'floor' | 'wall'): { materials: readonly Material[]; materialId: string } {
  const neutral = NEUTRAL_MATERIALS[category];
  const existing = materials.find((material) => material.category === category && material.color.toLowerCase() === neutral.color);
  if (existing) return { materials, materialId: existing.id };
  const used = new Set(materials.map((material) => material.id));
  let materialId: string = neutral.id;
  let suffix = 2;
  while (used.has(materialId)) materialId = `${neutral.id}-${suffix++}`;
  return { materials: [...materials, Object.freeze({ ...neutral, id: materialId })], materialId };
}

function sameFinish(left: FloorFinishMapping | undefined): boolean {
  const value = left ?? IDENTITY_FINISH;
  return value.pattern === 'none' && value.colorOverlay === false && value.rotation === 0
    && value.offsetX === 0 && value.offsetY === 0 && value.scaleX === 1 && value.scaleY === 1;
}

function clearRoomFinishes(room: Room, floorMaterialId: string): Room {
  if (room.floorMaterialId === floorMaterialId && sameFinish(room.floorFinish)
    && sameFinish(room.ceilingFinish) && room.ceilingMaterialId === undefined) return room;
  const { ceilingMaterialId: _removedCeilingMaterialId, ...withoutCeilingMaterial } = room;
  return Object.freeze({ ...withoutCeilingMaterial, floorMaterialId, floorFinish: IDENTITY_FINISH, ceilingFinish: IDENTITY_FINISH });
}

/** Independent, active-floor bulk clearing; geometry and other floors are preserved. */
export function clearLevelContents(project: DesignProject, levelId: string, mode: ClearLevelMode): DesignProject {
  if (!project.levels.some((level) => level.id === levelId)) throw new RangeError(`unknown level: ${levelId}`);
  if (mode !== 'furniture' && mode !== 'finishes' && mode !== 'furniture-and-finishes') {
    throw new TypeError('clear level mode must be furniture, finishes, or furniture-and-finishes');
  }
  const clearFurniture = mode === 'furniture' || mode === 'furniture-and-finishes';
  const clearFinishes = mode === 'finishes' || mode === 'furniture-and-finishes';
  const furniture = clearFurniture ? project.furniture.filter((item) => item.levelId !== levelId) : project.furniture;
  let materials = project.materials;
  let floorMaterialId: string | undefined;
  let wallMaterialId: string | undefined;
  if (clearFinishes && project.rooms.some((room) => room.levelId === levelId)) {
    const neutral = neutralMaterial(materials, 'floor');
    materials = neutral.materials;
    floorMaterialId = neutral.materialId;
  }
  if (clearFinishes && project.walls.some((wall) => wall.levelId === levelId)) {
    const neutral = neutralMaterial(materials, 'wall');
    materials = neutral.materials;
    wallMaterialId = neutral.materialId;
  }
  const rooms = floorMaterialId ? project.rooms.map((room) => room.levelId === levelId ? clearRoomFinishes(room, floorMaterialId) : room) : project.rooms;
  const walls = wallMaterialId ? project.walls.map((wall) => wall.levelId === levelId && wall.materialId !== wallMaterialId
    ? Object.freeze({ ...wall, materialId: wallMaterialId }) : wall) : project.walls;
  const changed = furniture.length !== project.furniture.length || materials !== project.materials
    || rooms.some((room, index) => room !== project.rooms[index]) || walls.some((wall, index) => wall !== project.walls[index]);
  if (!changed) return project;
  return Object.freeze({
    ...project,
    rooms: rooms === project.rooms ? rooms : Object.freeze(rooms),
    walls: walls === project.walls ? walls : Object.freeze(walls),
    furniture: furniture === project.furniture ? furniture : Object.freeze(furniture),
    materials: materials === project.materials ? materials : Object.freeze(materials),
    updatedAt: new Date().toISOString(),
  });
}
