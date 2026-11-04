import { describe, expect, it } from 'vitest';
import {
  addLevel,
  addFurniture,
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
  updateFurniture,
  updateWallHeight,
  updateWallThickness,
} from './model';

const furniture = {
  id: 'chair-1',
  assetId: 'asset-chair',
  name: 'Generic Chair',
  position: { x: 1, y: 1 },
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
