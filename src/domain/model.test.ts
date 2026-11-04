import { describe, expect, it } from 'vitest';
import {
  addLevel,
  addFurniture,
  arrayFurniture,
  assignRoomMaterial,
  createRectRoom,
  createStarterProject,
  createWall,
  duplicateFurniture,
  moveFurniture,
  normalizeProject,
  removeLevel,
  removeFurniture,
  removeWall,
  roomArea,
  rotateFurniture,
  setFurnitureHidden,
  splitWall,
  updateFurniture,
  updateWallEndpoints,
  updateWallHeight,
  updateWallThickness,
} from './model';

const furniture = {
  id: 'chair-1',
  assetId: 'asset-chair',
  name: 'Generic Chair',
  position: { x: 1, y: 1 },
  elevation: 0,
  rotation: 0,
  width: 0.6,
  depth: 0.6,
  height: 0.9,
  color: '#506070',
  levelId: 'floor-ground',
  roomId: 'room-starter',
} as const;

describe('domain model', () => {
  it('creates a rectangular room and four standalone walls', () => {
    const room = createRectRoom('room-1', 'Living Room', 4, 3);
    expect(room.points).toHaveLength(4);
    expect(room.points[2]).toEqual({ x: 4, y: 3 });

    const walls = [
      createWall('north', room.points[3], room.points[2]),
      createWall('east', room.points[2], room.points[1]),
      createWall('south', room.points[1], room.points[0]),
      createWall('west', room.points[0], room.points[3]),
    ];
    expect(walls).toHaveLength(4);
    expect(walls.every((wall) => wall.thickness > 0)).toBe(true);
  });

  it('calculates rectangle area', () => {
    expect(roomArea(createRectRoom('room-1', 'Room', 4, 3))).toBe(12);
  });

  it('seeds a two-room comparison plan with generic geometry and no catalog furniture', () => {
    const project = createStarterProject();

    expect(project.rooms.map((room) => room.name)).toEqual(['Lobby', 'Living Room']);
    expect(project.walls).toHaveLength(7);
    expect(project.furniture).toEqual([]);
    expect(project.rooms.reduce((sum, room) => sum + roomArea(room), 0)).toBeCloseTo(10.4);
  });

  it('rejects a degenerate standalone wall', () => {
    expect(() => createWall('bad', { x: 1, y: 1 }, { x: 1, y: 1 })).toThrow(/different points/);
  });

  it('updates wall thickness without mutating the original wall', () => {
    const wall = createWall('wall-1', { x: 0, y: 0 }, { x: 3, y: 0 });
    const updated = updateWallThickness(wall, 0.2);
    expect(updated.thickness).toBe(0.2);
    expect(wall.thickness).toBe(0.12);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('updates wall endpoints immutably while preserving its other properties', () => {
    const project = createStarterProject();
    const original = project.walls.find((wall) => wall.id === 'wall-north')!;
    const start = { x: original.start.x - 0.5, y: original.start.y + 0.2 };
    const end = { x: original.end.x + 0.75, y: original.end.y + 0.2 };
    const updated = updateWallEndpoints(project, original.id, { start, end });
    const wall = updated.walls.find((item) => item.id === original.id)!;

    expect(wall.start).toEqual(start);
    expect(wall.end).toEqual(end);
    expect(wall).toMatchObject({ thickness: original.thickness, height: original.height, materialId: original.materialId, levelId: original.levelId });
    expect(project.walls.find((item) => item.id === original.id)).toEqual(original);
    expect(Object.isFrozen(wall.start)).toBe(true);
  });

  it('rejects invalid or coincident wall endpoints and unknown wall IDs', () => {
    const project = createStarterProject();
    const wall = project.walls.find((item) => item.id === 'wall-north')!;

    expect(() => updateWallEndpoints(project, wall.id, { start: { x: Number.NaN, y: 0 } })).toThrow(/finite numbers/);
    expect(() => updateWallEndpoints(project, wall.id, { end: wall.start })).toThrow(/different points/);
    expect(() => updateWallEndpoints(project, 'missing-wall', { end: { x: 1, y: 1 } })).toThrow(/unknown wall/);
  });

  it('assigns a room material without mutating the original room', () => {
    const room = createRectRoom('room-1', 'Room', 2, 2);
    const updated = assignRoomMaterial(room, 'tile-blue');
    expect(updated.floorMaterialId).toBe('tile-blue');
    expect(room.floorMaterialId).toBe('material-neutral-floor');
  });

  it('places and incrementally rotates furniture in a project', () => {
    const project = createStarterProject();
    const withFurniture = addFurniture(project, furniture);
    const rotated = rotateFurniture(withFurniture, 'chair-1', 45);
    expect(withFurniture.furniture).toHaveLength(1);
    expect(withFurniture.furniture[0]).toMatchObject({ rotationX: 0, rotationZ: 0 });
    expect(rotated.furniture[0]).toMatchObject({ id: 'chair-1', position: { x: 1, y: 1 }, rotation: 45 });
    expect(project.furniture).toHaveLength(0);
  });

  it('moves one furniture instance immutably while preserving its other properties', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const moved = moveFurniture(project, 'chair-1', { x: 2.25, y: 1.75 });

    expect(moved.furniture[0]).toMatchObject({
      id: 'chair-1', position: { x: 2.25, y: 1.75 }, rotation: 0, width: 0.6, roomId: 'room-starter',
    });
    expect(project.furniture[0].position).toEqual({ x: 1, y: 1 });
    expect(moved.rooms).toEqual(project.rooms);
    expect(Object.isFrozen(moved)).toBe(true);
  });

  it('rejects a move to an unknown furniture ID', () => {
    expect(() => moveFurniture(createStarterProject(), 'missing', { x: 1, y: 1 })).toThrow(/unknown furniture/);
  });

  it('rejects non-finite furniture move coordinates', () => {
    const project = addFurniture(createStarterProject(), furniture);
    expect(() => moveFurniture(project, 'chair-1', { x: Number.NaN, y: 1 })).toThrow(/finite numbers/);
  });

  it('updates dimensions, position and rotation without changing the original instance', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const updated = updateFurniture(project, 'chair-1', {
      position: { x: -0.5, y: 2 }, width: 1.2, rotation: 90,
    });

    expect(updated.furniture[0]).toMatchObject({ position: { x: -0.5, y: 2 }, width: 1.2, rotation: 90 });
    expect(project.furniture[0]).toMatchObject({ position: { x: 1, y: 1 }, width: 0.6, rotation: 0 });
  });

  it('updates furniture elevation immutably and rejects non-finite elevation values', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const updated = updateFurniture(project, 'chair-1', { elevation: 0.45 });

    expect(updated.furniture[0].elevation).toBe(0.45);
    expect(project.furniture[0].elevation).toBe(0);
    expect(() => updateFurniture(project, 'chair-1', { elevation: Number.NaN })).toThrow(/finite/);
  });

  it('updates axial furniture rotations immutably and rejects non-finite angles', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const updated = updateFurniture(project, 'chair-1', { rotationX: 12, rotationZ: -8 });

    expect(updated.furniture[0]).toMatchObject({ rotationX: 12, rotationZ: -8 });
    expect(project.furniture[0]).toMatchObject({ rotationX: 0, rotationZ: 0 });
    expect(() => updateFurniture(project, 'chair-1', { rotationX: Number.NaN })).toThrow(/finite/);
    expect(() => updateFurniture(project, 'chair-1', { rotationZ: Number.POSITIVE_INFINITY })).toThrow(/finite/);
  });

  it('hides and restores furniture without deleting the instance', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const hidden = setFurnitureHidden(project, 'chair-1', true);
    const restored = setFurnitureHidden(hidden, 'chair-1', false);

    expect(hidden.furniture[0]).toMatchObject({ id: 'chair-1', hidden: true });
    expect(restored.furniture[0]).toMatchObject({ id: 'chair-1', hidden: false });
    expect(project.furniture[0].hidden).toBe(false);
    expect(() => setFurnitureHidden(project, 'missing', true)).toThrow(/unknown furniture/);
  });

  it('migrates saved furniture without an elevation field to floor level', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const { elevation: _elevation, rotationX: _rotationX, rotationZ: _rotationZ, hidden: _hidden, ...legacyFurniture } = project.furniture[0];
    const migrated = normalizeProject({ ...project, furniture: [legacyFurniture] });

    expect(migrated.furniture[0]).toMatchObject({ elevation: 0, rotationX: 0, rotationZ: 0, hidden: false });
  });

  it('duplicates furniture with a fresh ID and a small placement offset', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const duplicated = duplicateFurniture(project, 'chair-1');

    expect(duplicated.furniture).toHaveLength(2);
    expect(duplicated.furniture[1]).toMatchObject({
      assetId: 'asset-chair', name: 'Generic Chair', id: expect.not.stringMatching('chair-1'),
      position: { x: 1.35, y: 1.35 }, roomId: 'room-starter',
    });
    expect(project.furniture).toHaveLength(1);
  });

  it('creates an evenly spaced furniture array in one immutable project update', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const result = arrayFurniture(project, 'chair-1', 3, { x: 0.8, y: -0.25 });

    expect(result.furniture).toHaveLength(4);
    expect(result.furniture.slice(1).map((item) => item.position)).toEqual([
      { x: 1.8, y: 0.75 },
      { x: 2.6, y: 0.5 },
      { x: 3.4000000000000004, y: 0.25 },
    ]);
    expect(result.furniture.slice(1).map((item) => item.id)).toEqual(['furniture-1', 'furniture-2', 'furniture-3']);
    expect(result.furniture[3]).toMatchObject({ width: 0.6, depth: 0.6, height: 0.9, roomId: 'room-starter' });
    expect(project.furniture).toHaveLength(1);
  });

  it('rejects invalid furniture array counts, offsets, and IDs', () => {
    const project = addFurniture(createStarterProject(), furniture);
    expect(() => arrayFurniture(project, 'chair-1', 0, { x: 1, y: 0 })).toThrow(/integer from 1 to 100/);
    expect(() => arrayFurniture(project, 'chair-1', 1.5, { x: 1, y: 0 })).toThrow(/integer from 1 to 100/);
    expect(() => arrayFurniture(project, 'chair-1', 101, { x: 1, y: 0 })).toThrow(/integer from 1 to 100/);
    expect(() => arrayFurniture(project, 'chair-1', 2, { x: 0, y: 0 })).toThrow(/must move/);
    expect(() => arrayFurniture(project, 'missing', 2, { x: 1, y: 0 })).toThrow(/unknown furniture/);
  });

  it('removes only the selected furniture or wall', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const withoutFurniture = removeFurniture(project, 'chair-1');
    const withoutWall = removeWall(project, 'wall-north');

    expect(withoutFurniture.furniture).toHaveLength(0);
    expect(withoutFurniture.walls).toHaveLength(project.walls.length);
    expect(withoutWall.walls.some((wall) => wall.id === 'wall-north')).toBe(false);
    expect(withoutWall.rooms).toHaveLength(project.rooms.length);
    expect(project.furniture).toHaveLength(1);
    expect(project.walls).toHaveLength(7);
  });

  it('splits a wall into contiguous segments while preserving properties and the original project', () => {
    const project = createStarterProject();
    const original = project.walls.find((wall) => wall.id === 'wall-north')!;
    const split = splitWall(project, original.id);
    const first = split.walls.find((wall) => wall.id === original.id)!;
    const second = split.walls.find((wall) => wall.id !== original.id && wall.start.x === 5.2 && wall.start.y === -0.5)!;

    expect(split.walls).toHaveLength(project.walls.length + 1);
    expect(first.end).toEqual(second.start);
    expect(first.end).toEqual({ x: 5.2, y: -0.5 });
    expect(first.height).toBe(original.height);
    expect(second.thickness).toBe(original.thickness);
    expect(first.start).toEqual(original.start);
    expect(second.end).toEqual(original.end);
    expect(project.walls).toHaveLength(7);
    expect(() => splitWall(project, original.id, 0)).toThrow(/between zero and one/);
    expect(() => splitWall(project, 'missing-wall')).toThrow(/unknown wall/);
  });

  it('adds a new level and makes it active at the next clear elevation', () => {
    const project = createStarterProject();
    const second = addLevel(project);

    expect(second.levels).toHaveLength(2);
    expect(second.activeLevelId).toBe('floor-2');
    expect(second.levels[1]).toMatchObject({ id: 'floor-2', name: 'Floor 2', height: 2.7 });
    expect(second.levels[1].elevation).toBeCloseTo(2.7);
    expect(project.levels).toHaveLength(1);
    expect(project.rooms[0].levelId).toBe(project.levels[0].id);
  });

  it('removes a level and its contents while preserving at least one floor', () => {
    const project = createStarterProject();
    const second = addLevel(project);
    const room = createRectRoom('room-upper', 'Upper Room', 2, 2, { x: 0, y: 0 }, undefined, second.activeLevelId);
    const withRoom = { ...second, rooms: [...second.rooms, room] };
    const withoutSecond = removeLevel(withRoom, second.activeLevelId);

    expect(withoutSecond.levels).toHaveLength(1);
    expect(withoutSecond.activeLevelId).toBe(project.activeLevelId);
    expect(withoutSecond.rooms.some((item) => item.id === room.id)).toBe(false);
    expect(() => removeLevel(withoutSecond, withoutSecond.activeLevelId)).toThrow(/at least one floor/);
  });

  it('migrates legacy projects without levels onto a default ground floor', () => {
    const legacy = createStarterProject();
    const { levels: _levels, activeLevelId: _activeLevelId, ...withoutLevels } = legacy;
    const migrated = normalizeProject(withoutLevels);

    expect(migrated.levels).toHaveLength(1);
    expect(migrated.activeLevelId).toBe(migrated.levels[0].id);
    expect(migrated.rooms[0].levelId).toBe(migrated.levels[0].id);
    expect(migrated.walls.every((wall) => wall.levelId === migrated.levels[0].id)).toBe(true);
  });

  it('edits wall height immutably and validates the new height', () => {
    const project = createStarterProject();
    const changed = updateWallHeight(project, 'wall-north', 3.1);

    expect(changed.walls.find((wall) => wall.id === 'wall-north')?.height).toBe(3.1);
    expect(project.walls.find((wall) => wall.id === 'wall-north')?.height).toBe(2.4);
    expect(() => updateWallHeight(project, 'wall-north', 0)).toThrow(/greater than zero/);
  });
});
