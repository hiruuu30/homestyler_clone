import { describe, expect, it } from 'vitest';
import {
  addFurniture,
  addLevel,
  addWallOpening,
  createStarterProject,
  normalizeProject,
  updateRoomCeilingFinishMapping,
  updateRoomFloorFinishMapping,
} from './model';
import { clearLevelContents, IDENTITY_FINISH } from './clear-level';

function furniture(id: string, levelId: string) {
  return {
    id,
    assetId: `asset-${id}`,
    name: id,
    position: { x: 1, y: 1 },
    elevation: 0,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    width: 1,
    depth: 1,
    height: 1,
    color: '#345678',
    hidden: false,
    levelId,
  } as const;
}

describe('clearLevelContents', () => {
  it('clears only furniture on the requested floor and preserves geometry, holes, openings, and other floors', () => {
    const base = createStarterProject();
    const withOpening = addWallOpening(base, 'wall-north', 'door');
    const withHole = normalizeProject({
      ...withOpening,
      rooms: withOpening.rooms.map((room) => room.id === 'room-starter' ? ({
        ...room,
        holes: [[{ x: 4.6, y: 0.2 }, { x: 5, y: 0.2 }, { x: 5, y: 0.6 }, { x: 4.6, y: 0.6 }]],
      }) : room),
    });
    const project = addFurniture(addFurniture(withHole, furniture('ground-chair', 'floor-ground')), furniture('ground-table', 'floor-ground'));
    const multiFloor = addLevel(project, 'Upper Floor');
    const populated = addFurniture(multiFloor, furniture('upper-chair', multiFloor.levels[1].id));
    const cleared = clearLevelContents(populated, 'floor-ground', 'furniture');

    expect(cleared.furniture.map((item) => item.id)).toEqual(['upper-chair']);
    expect(cleared.levels).toEqual(populated.levels);
    expect(cleared.rooms).toEqual(populated.rooms);
    expect(cleared.walls).toEqual(populated.walls);
    expect(cleared.wallOpenings).toEqual(populated.wallOpenings);
    expect(cleared.rooms[0].holes).toEqual(populated.rooms[0].holes);
    expect(cleared.materials).toBe(populated.materials);
  });

  it('resets finishes and materials on one floor while preserving furniture colors and other floors', () => {
    const base = createStarterProject();
    const decorated = updateRoomCeilingFinishMapping(
      updateRoomFloorFinishMapping(base, 'room-starter', { pattern: 'wood', colorOverlay: true, offsetX: 0.4 }),
      'room-starter',
      { pattern: 'tile', rotation: 30 },
    );
    const withFurniture = addFurniture(decorated, furniture('sofa', 'floor-ground'));
    const multiFloor = addLevel(withFurniture, 'Upper Floor');
    const upper = addFurniture(multiFloor, furniture('upper', multiFloor.levels[1].id));
    const cleared = clearLevelContents(upper, 'floor-ground', 'finishes');

    expect(cleared.furniture).toEqual(upper.furniture);
    expect(cleared.furniture.find((item) => item.id === 'sofa')?.color).toBe('#345678');
    expect(cleared.rooms[0].floorMaterialId).toBe('material-neutral-floor');
    expect(cleared.rooms[0].floorFinish).toEqual(IDENTITY_FINISH);
    expect(cleared.rooms[0].ceilingFinish).toEqual(IDENTITY_FINISH);
    expect(cleared.rooms[0].ceilingMaterialId).toBeUndefined();
    expect(cleared.walls.every((wall) => wall.materialId === 'material-neutral-wall')).toBe(true);
    expect(cleared.rooms.filter((room) => room.levelId !== 'floor-ground')).toEqual([]);
    const reloaded = normalizeProject(JSON.parse(JSON.stringify(cleared)));
    expect(reloaded.rooms[0]).toEqual(cleared.rooms[0]);
    expect(reloaded.walls).toEqual(cleared.walls);
    expect(reloaded.materials).toEqual(cleared.materials);
  });

  it('combines furniture and finish clearing, rejects invalid levels and modes, and is idempotent', () => {
    const project = addFurniture(createStarterProject(), furniture('chair', 'floor-ground'));
    const cleared = clearLevelContents(project, 'floor-ground', 'furniture-and-finishes');
    expect(cleared.furniture).toHaveLength(0);
    expect(clearLevelContents(cleared, 'floor-ground', 'furniture-and-finishes')).toBe(cleared);
    expect(() => clearLevelContents(project, 'missing-floor', 'furniture')).toThrow(/unknown level/);
    expect(() => clearLevelContents(project, 'floor-ground', 'not-a-mode' as never)).toThrow(/mode/);
  });

  it('does not mutate input projects and keeps metric and imperial values unchanged', () => {
    for (const units of ['m', 'ft'] as const) {
      const project = updateRoomFloorFinishMapping(createStarterProject(`project-${units}`, 'Test', units), 'room-starter', {
        pattern: 'tile', offsetX: 0.25, offsetY: -0.5, scaleX: 1.5, scaleY: 0.75,
      });
      const before = JSON.stringify(project);
      const coordinates = project.rooms[0].points.map((point) => ({ ...point }));
      clearLevelContents(project, 'floor-ground', 'finishes');
      expect(JSON.stringify(project)).toBe(before);
      expect(project.units).toBe(units);
      expect(project.rooms[0].points).toEqual(coordinates);
    }
  });
});

describe('bulk-clear neutral material edge cases', () => {
  it('does not treat custom colored canonical IDs as neutral or overwrite material records', () => {
    const project = {
      ...createStarterProject(),
      materials: [
        { id: 'material-neutral-floor', name: 'Red floor', category: 'floor' as const, color: '#ff0000' },
        { id: 'material-neutral-wall', name: 'Blue wall', category: 'wall' as const, color: '#0000ff' },
      ],
    };
    const cleared = clearLevelContents(project, 'floor-ground', 'finishes');
    expect(cleared.materials.slice(0, 2)).toEqual(project.materials);
    expect(cleared.rooms[0].floorMaterialId).toBe('material-neutral-floor-2');
    expect(cleared.materials.find((item) => item.id === cleared.rooms[0].floorMaterialId)?.color).toBe('#d9c7aa');
    expect(cleared.walls[0].materialId).toBe('material-neutral-wall-2');
    expect(cleared.materials.find((item) => item.id === cleared.walls[0].materialId)?.color).toBe('#f4f1eb');
    expect(clearLevelContents(cleared, 'floor-ground', 'finishes')).toBe(cleared);
  });

  it('does not create unused materials on an empty floor or while clearing furniture alone', () => {
    const base = addLevel(createStarterProject(), 'Empty upper floor');
    const project = { ...base, materials: [] };
    const upperId = project.levels[1].id;
    expect(clearLevelContents(project, upperId, 'finishes')).toBe(project);
    expect(clearLevelContents(project, upperId, 'furniture-and-finishes')).toBe(project);
    const populated = { ...project, furniture: [furniture('upper-chair', upperId)] };
    expect(clearLevelContents(populated, upperId, 'furniture-and-finishes').materials).toBe(populated.materials);
    const roomsOnly = { ...project, walls: [] };
    const cleared = clearLevelContents(roomsOnly, 'floor-ground', 'finishes');
    expect(cleared.materials).toHaveLength(1);
    expect(cleared.materials[0].category).toBe('floor');
  });

  it('preserves assigned finishes on other-floor rooms and walls', () => {
    const base = addLevel(createStarterProject(), 'Upper');
    const upperId = base.levels[1].id;
    const upperRoom = { ...base.rooms[0], id: 'upper-room', levelId: upperId, ceilingMaterialId: base.materials[1].id, floorFinish: { ...IDENTITY_FINISH, pattern: 'tile' as const, rotation: 43 }, ceilingFinish: { ...IDENTITY_FINISH, pattern: 'wood' as const, offsetX: 0.6 } };
    const upperWall = { ...base.walls[0], id: 'upper-wall', levelId: upperId, materialId: base.materials[0].id };
    const project = { ...base, rooms: [...base.rooms, upperRoom], walls: [...base.walls, upperWall] };
    const cleared = clearLevelContents(project, 'floor-ground', 'finishes');
    expect(cleared.rooms.find((room) => room.id === upperRoom.id)).toBe(upperRoom);
    expect(cleared.walls.find((wall) => wall.id === upperWall.id)).toBe(upperWall);
  });

  it('does not freeze caller-owned arrays as a side effect', () => {
    const project = JSON.parse(JSON.stringify(createStarterProject()));
    project.furniture = [furniture('chair', 'floor-ground')];
    clearLevelContents(project, 'floor-ground', 'furniture-and-finishes');
    for (const key of ['rooms', 'walls', 'furniture', 'materials']) expect(Object.isFrozen(project[key])).toBe(false);
  });
});
