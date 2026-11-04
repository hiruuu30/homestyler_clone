import { describe, expect, it } from 'vitest';
import { addLevel, createPolygonRoom, createStarterProject, createWall, roomArea } from './model';
import { reconstructRoomsFromWalls } from './room-reconstruction';

function wallsForRectangle(prefix: string, x: number, y: number, width: number, height: number, levelId = 'floor-ground') {
  return [
    createWall(`${prefix}-bottom`, { x, y }, { x: x + width, y }, undefined, undefined, undefined, levelId),
    createWall(`${prefix}-right`, { x: x + width, y }, { x: x + width, y: y + height }, undefined, undefined, undefined, levelId),
    createWall(`${prefix}-top`, { x: x + width, y: y + height }, { x, y: y + height }, undefined, undefined, undefined, levelId),
    createWall(`${prefix}-left`, { x, y: y + height }, { x, y }, undefined, undefined, undefined, levelId),
  ];
}

describe('room reconstruction from closed walls', () => {
  it('creates one room for a closed loop while ignoring a dangling spur', () => {
    const base = createStarterProject();
    const rectangle = wallsForRectangle('room', 0, 0, 4, 3);
    const spur = createWall('spur', { x: 0, y: 0 }, { x: -2, y: 0 });
    const project = { ...base, walls: [...rectangle, spur], rooms: [] };
    const reconstructed = reconstructRoomsFromWalls(project);

    expect(reconstructed.rooms).toHaveLength(1);
    expect(reconstructed.rooms[0].name).toBe('Room 1');
    expect(reconstructed.rooms[0].points).toHaveLength(4);
    expect(roomArea(reconstructed.rooms[0])).toBe(12);
    expect(reconstructed.rooms[0].floorMaterialId).toBe(base.materials.find((material) => material.category === 'floor')?.id);
    expect(project.rooms).toEqual([]);
    expect(project.walls).toEqual([...rectangle, spur]);
    expect(reconstructRoomsFromWalls(reconstructed)).toBe(reconstructed);
  });

  it('finds separate bounded rooms in a subdivided wall graph', () => {
    const base = createStarterProject();
    const walls = [
      createWall('bottom-left', { x: 0, y: 0 }, { x: 2, y: 0 }),
      createWall('bottom-right', { x: 2, y: 0 }, { x: 4, y: 0 }),
      createWall('top-left', { x: 0, y: 2 }, { x: 2, y: 2 }),
      createWall('top-right', { x: 2, y: 2 }, { x: 4, y: 2 }),
      createWall('left', { x: 0, y: 2 }, { x: 0, y: 0 }),
      createWall('middle', { x: 2, y: 0 }, { x: 2, y: 2 }),
      createWall('right', { x: 4, y: 0 }, { x: 4, y: 2 }),
    ];
    const project = { ...base, walls, rooms: [] };
    const reconstructed = reconstructRoomsFromWalls(project);

    expect(reconstructed.rooms).toHaveLength(2);
    expect(reconstructed.rooms.map(roomArea)).toEqual([4, 4]);
    expect(reconstructed.rooms.every((room) => room.levelId === 'floor-ground')).toBe(true);
    expect(reconstructRoomsFromWalls(reconstructed)).toBe(reconstructed);
  });

  it('does not duplicate an existing room when its boundary has different collinear segmentation', () => {
    const base = createStarterProject();
    const room = createPolygonRoom('existing', 'Already here', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 },
    ]);
    const walls = [
      createWall('bottom-left', { x: 0, y: 0 }, { x: 2, y: 0 }),
      createWall('bottom-right', { x: 2, y: 0 }, { x: 4, y: 0 }),
      createWall('right', { x: 4, y: 0 }, { x: 4, y: 3 }),
      createWall('top', { x: 4, y: 3 }, { x: 0, y: 3 }),
      createWall('left', { x: 0, y: 3 }, { x: 0, y: 0 }),
    ];
    const project = { ...base, walls, rooms: [room] };
    expect(reconstructRoomsFromWalls(project)).toBe(project);
  });

  it('creates rooms independently on each floor and preserves existing room records', () => {
    const base = addLevel(createStarterProject(), 'Upper floor');
    const upperLevelId = base.levels.at(-1)!.id;
    const existing = createPolygonRoom('existing', 'Saved room', [
      { x: 10, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 2 }, { x: 10, y: 2 },
    ]);
    const project = {
      ...base,
      rooms: [existing],
      walls: [
        ...wallsForRectangle('ground', 0, 0, 3, 2),
        ...wallsForRectangle('upper', 0, 0, 4, 2, upperLevelId),
      ],
    };
    const reconstructed = reconstructRoomsFromWalls(project);

    expect(reconstructed.rooms).toHaveLength(3);
    expect(reconstructed.rooms[0]).toBe(existing);
    expect(reconstructed.rooms[1].levelId).toBe('floor-ground');
    expect(reconstructed.rooms[2].levelId).toBe(upperLevelId);
    expect(reconstructed.rooms.map(roomArea)).toEqual([4, 6, 8]);
  });

  it('prefers the smaller loop when nested boundaries cannot be represented as a room hole', () => {
    const base = createStarterProject();
    const project = { ...base, rooms: [], walls: [...wallsForRectangle('outer', 0, 0, 10, 10), ...wallsForRectangle('inner', 2, 2, 2, 2)] };
    const reconstructed = reconstructRoomsFromWalls(project);
    expect(reconstructed.rooms).toHaveLength(1);
    expect(roomArea(reconstructed.rooms[0])).toBe(4);
  });

  it('requires repaired crossings and rejects overlapping wall segments without mutation', () => {
    const base = createStarterProject();
    const crossing = {
      ...base,
      rooms: [],
      walls: [
        createWall('horizontal', { x: 0, y: 0 }, { x: 4, y: 0 }),
        createWall('vertical', { x: 2, y: -2 }, { x: 2, y: 2 }),
      ],
    };
    expect(() => reconstructRoomsFromWalls(crossing)).toThrow(/repair wall crossings/);
    expect(crossing.walls).toHaveLength(2);

    const overlap = {
      ...base,
      rooms: [],
      walls: [
        createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 }),
        createWall('overlap', { x: 2, y: 0 }, { x: 5, y: 0 }),
      ],
    };
    expect(() => reconstructRoomsFromWalls(overlap)).toThrow(/overlapping walls/);
    expect(overlap.rooms).toEqual([]);
  });

  it('does not add a generated room that overlaps a differently shaped saved room', () => {
    const base = createStarterProject();
    const saved = createPolygonRoom('saved', 'Saved', [
      { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 },
    ]);
    const project = { ...base, rooms: [saved], walls: wallsForRectangle('outer', 0, 0, 4, 4) };
    expect(reconstructRoomsFromWalls(project)).toBe(project);
  });
});
