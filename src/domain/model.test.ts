import { describe, expect, it } from 'vitest';
import {
  addLevel,
  addFurniture,
  addWall,
  addWallOpening,
  arrayFurniture,
  assignRoomCeilingMaterial,
  assignRoomMaterial,
  assignWallMaterial,
  createPlanUnderlay,
  createRectRoom,
  createPolygonRoom,
  createStarterProject,
  createWall,
  convertProjectUnits,
  duplicateFurniture,
  findJoinableWall,
  joinCollinearWalls,
  moveFurniture,
  normalizeProject,
  removeLevel,
  removePlanUnderlay,
  removeFurniture,
  removeWall,
  removeWallOpening,
  repairWallTopology,
  roomArea,
  rotateFurniture,
  setFurnitureHidden,
  splitWall,
  updateFurniture,
  updatePlanUnderlay,
  updateWallOpening,
  updateWallEndpoints,
  updateWallHeight,
  updateWallThickness,
} from './model';
import { wallSolidSegments } from './wall-openings';
import { assertFurniturePlacement } from './furniture-placement';

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

  it('creates a concave polygon room and removes a repeated closing vertex', () => {
    const vertices = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1.5 },
      { x: 2, y: 1.5 }, { x: 2, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 },
    ];
    const room = createPolygonRoom('room-l', 'L-shaped room', vertices);

    expect(room.points).toHaveLength(6);
    expect(roomArea(room)).toBe(9);
    expect(Object.isFrozen(room.points)).toBe(true);
    expect(Object.isFrozen(room.points[0])).toBe(true);
  });

  it('rejects self-intersections, zero-length edges, and areas below the minimum', () => {
    expect(() => createPolygonRoom('crossing', 'Crossing', [
      { x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 },
    ])).toThrow(/self-intersect/);
    expect(() => createPolygonRoom('duplicate', 'Duplicate', [
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 },
    ])).toThrow(/non-zero length/);
    expect(() => createPolygonRoom('tiny', 'Tiny', [
      { x: 0, y: 0 }, { x: 0.05, y: 0 }, { x: 0, y: 0.05 },
    ])).toThrow(/at least 0.01/);
  });

  it('validates and stores imperial polygon geometry without changing its coordinates', () => {
    const room = createPolygonRoom('room-ft', 'Feet room', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 },
    ], undefined, undefined, 'ft');
    expect(room.points[2]).toEqual({ x: 4, y: 3 });
    expect(roomArea(room)).toBe(12);
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

  it('converts every project length between metres and feet without changing physical geometry', () => {
    let project = createStarterProject();
    project = createPlanUnderlay(project, {
      id: 'underlay-1', name: 'plan.jpg', src: 'data:image/jpeg;base64,/9j/2Q==', levelId: 'floor-ground',
      x: 1, y: 2, width: 5, height: 2.5, aspectRatio: 2, opacity: 0.45,
    });
    project = addWallOpening(project, 'wall-north', 'window');
    project = addFurniture(project, furniture);
    project = addLevel(project, 'Upper Floor');
    const roomAreaM2 = roomArea(project.rooms[0]);
    const wallLengthM = Math.hypot(
      project.walls[0].end.x - project.walls[0].start.x,
      project.walls[0].end.y - project.walls[0].start.y,
    );

    const imperial = convertProjectUnits(project, 'ft');
    const convertedRoom = imperial.rooms[0];
    expect(imperial.units).toBe('ft');
    expect(convertedRoom.points[0].x).toBeCloseTo(project.rooms[0].points[0].x / 0.3048, 8);
    expect(roomArea(convertedRoom) * 0.3048 ** 2).toBeCloseTo(roomAreaM2, 8);
    expect(imperial.walls[0].thickness * 0.3048).toBeCloseTo(project.walls[0].thickness, 8);
    expect(Math.hypot(
      imperial.walls[0].end.x - imperial.walls[0].start.x,
      imperial.walls[0].end.y - imperial.walls[0].start.y,
    ) * 0.3048).toBeCloseTo(wallLengthM, 8);
    expect(imperial.wallOpenings[0].width * 0.3048).toBeCloseTo(project.wallOpenings[0].width, 8);
    expect(imperial.furniture[0]).toMatchObject({
      width: expect.closeTo(project.furniture[0].width / 0.3048, 8),
      position: {
        x: expect.closeTo(project.furniture[0].position.x / 0.3048, 8),
        y: expect.closeTo(project.furniture[0].position.y / 0.3048, 8),
      },
    });
    expect(imperial.levels[1].height * 0.3048).toBeCloseTo(project.levels[1].height, 8);
    expect(imperial.underlays[0]).toMatchObject({
      x: expect.closeTo(project.underlays[0].x / 0.3048, 8),
      y: expect.closeTo(project.underlays[0].y / 0.3048, 8),
      width: expect.closeTo(project.underlays[0].width / 0.3048, 8),
      height: expect.closeTo(project.underlays[0].height / 0.3048, 8),
      aspectRatio: 2,
      src: project.underlays[0].src,
    });
    expect(project.units).toBe('m');
    expect(Object.isFrozen(imperial.walls[0].start)).toBe(true);

    const metricAgain = convertProjectUnits(imperial, 'm');
    expect(metricAgain.rooms[0].points).toEqual(project.rooms[0].points);
    expect(metricAgain.walls[0].thickness).toBe(project.walls[0].thickness);
    expect(metricAgain.underlays[0]).toEqual(project.underlays[0]);
    expect(convertProjectUnits(project, 'm')).toBe(project);
  });

  it('creates, updates, removes, validates, and migrates local plan underlays', () => {
    const project = createStarterProject();
    const withImage = createPlanUnderlay(project, {
      name: 'survey.png', src: 'data:image/png;base64,iVBORw0KGgo=', levelId: 'floor-ground',
      x: -2, y: 1, width: 6, height: 3, aspectRatio: 2, opacity: 0.45,
    });
    expect(withImage.underlays[0]).toMatchObject({ id: 'underlay-1', name: 'survey.png', x: -2, width: 6, opacity: 0.45 });
    expect(Object.isFrozen(withImage.underlays[0])).toBe(true);

    const changed = updatePlanUnderlay(withImage, 'underlay-1', { x: 3, width: 8, height: 4, opacity: 0.7 });
    expect(changed.underlays[0]).toMatchObject({ x: 3, width: 8, height: 4, opacity: 0.7 });
    expect(removePlanUnderlay(changed, 'underlay-1').underlays).toEqual([]);
    expect(() => updatePlanUnderlay(withImage, 'underlay-1', { opacity: 1.1 })).toThrow(/between zero and one/);
    expect(() => createPlanUnderlay(project, {
      name: 'bad', src: 'https://example.invalid/plan.jpg', levelId: 'floor-ground',
      x: 0, y: 0, width: 1, height: 1, aspectRatio: 1, opacity: 0.5,
    })).toThrow(/embedded image/);
    expect(() => createPlanUnderlay(project, {
      name: 'stretched', src: 'data:image/jpeg;base64,/9j/2Q==', levelId: 'floor-ground',
      x: 0, y: 0, width: 4, height: 3, aspectRatio: 2, opacity: 0.5,
    })).toThrow(/aspect ratio/);
    expect(() => createPlanUnderlay(project, {
      name: 'oversize', src: `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`, levelId: 'floor-ground',
      x: 0, y: 0, width: 1, height: 1, aspectRatio: 1, opacity: 0.5,
    })).toThrow(/too large/);
    expect(normalizeProject({ ...project, underlays: undefined }).underlays).toEqual([]);

    const secondFloor = addLevel(project, 'Upper Floor');
    const upstairs = createPlanUnderlay(secondFloor, {
      name: 'upper.png', src: 'data:image/png;base64,iVBORw0KGgo=', levelId: secondFloor.activeLevelId,
      x: 0, y: 0, width: 3, height: 3, aspectRatio: 1, opacity: 0.5,
    });
    expect(removeLevel(upstairs, secondFloor.activeLevelId).underlays).toEqual([]);
    expect(project.underlays).toEqual([]);
  });

  it('creates imperial starter geometry and new objects at metric-equivalent dimensions', () => {
    const imperial = createStarterProject('imperial-starter', 'Imperial starter', 'ft');
    expect(roomArea(imperial.rooms[0]) * 0.3048 ** 2).toBeCloseTo(5.2, 8);
    expect(imperial.walls[0].height * 0.3048).toBeCloseTo(2.4, 8);
    const upper = addLevel(imperial, 'Upper Floor');
    expect(upper.levels[1].height * 0.3048).toBeCloseTo(2.7, 8);
    expect(addWallOpening(imperial, 'wall-north', 'door').wallOpenings[0].width * 0.3048).toBeCloseTo(0.9, 8);
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

  it('normalizes X crossings created by endpoint edits and rejects opening cuts atomically', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 1, y: -2 }, { x: 3, y: -1 });
    const project = { ...base, walls: [host, branch], rooms: [] };
    const moved = updateWallEndpoints(project, 'branch', { end: { x: 3, y: 2 } });

    expect(moved.walls).toHaveLength(4);
    expect(moved.walls.find((wall) => wall.id === 'host')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(moved.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 0 } });
    expect(moved.walls.find((wall) => wall.id === 'branch')).toMatchObject({ start: { x: 1, y: -2 }, end: { x: 2, y: 0 } });
    expect(moved.walls.find((wall) => wall.id === 'wall-2')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 3, y: 2 } });
    expect(project.walls[1].end).toEqual({ x: 3, y: -1 });

    const withOpening = addWallOpening(project, 'host', 'window');
    expect(() => updateWallEndpoints(withOpening, 'branch', { end: { x: 3, y: 2 } }))
      .toThrow(/cannot split a wall through an opening/);
    expect(withOpening.walls).toHaveLength(2);
    expect(withOpening.wallOpenings[0].wallId).toBe('host');
  });

  it('moves a shared endpoint across same-floor walls and room outlines but not another floor', () => {
    const project = createStarterProject();
    const upper = addLevel(project, 'Upper Floor');
    const upperWall = createWall('upper-wall', { x: 6.2, y: -0.5 }, { x: 7, y: -0.5 }, undefined, undefined, undefined, upper.activeLevelId);
    const withUpperWall = { ...upper, walls: [...upper.walls, upperWall] };
    const moved = updateWallEndpoints(withUpperWall, 'wall-north', { end: { x: 6.75, y: -0.5 } });

    expect(moved.walls.find((wall) => wall.id === 'wall-north')?.end).toEqual({ x: 6.75, y: -0.5 });
    expect(moved.walls.find((wall) => wall.id === 'wall-east')?.start).toEqual({ x: 6.75, y: -0.5 });
    expect(moved.rooms.find((room) => room.id === 'room-starter')?.points).toContainEqual({ x: 6.75, y: -0.5 });
    expect(moved.walls.find((wall) => wall.id === 'upper-wall')?.start).toEqual(upperWall.start);
    expect(project.walls.find((wall) => wall.id === 'wall-east')?.start).toEqual({ x: 6.2, y: -0.5 });
    expect(project.rooms.find((room) => room.id === 'room-starter')?.points).toContainEqual({ x: 6.2, y: -0.5 });
  });

  it('splits a moved wall when a stationary host endpoint lands in its interior', () => {
    const base = createStarterProject();
    const stub = createWall('stub', { x: 2, y: 0 }, { x: 2, y: 2 });
    const diagonal = createWall('diagonal', { x: 0, y: -1 }, { x: 4, y: -1 });
    const project = { ...base, walls: [stub, diagonal], rooms: [] };
    const moved = updateWallEndpoints(project, 'diagonal', { end: { x: 4, y: 1 } });

    expect(moved.walls).toHaveLength(3);
    expect(moved.walls.find((wall) => wall.id === 'diagonal')).toMatchObject({ start: { x: 0, y: -1 }, end: { x: 2, y: 0 } });
    expect(moved.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 1 } });
    expect(moved.walls.find((wall) => wall.id === 'stub')?.start).toEqual({ x: 2, y: 0 });
  });

  it('splits a wall and inserts a room vertex when an edited endpoint lands on an edge', () => {
    const base = createStarterProject();
    const boundary = createWall('boundary', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 1 });
    const room = createPolygonRoom('t-room', 'T-junction room', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ]);
    const project = { ...base, walls: [boundary, branch], rooms: [room] };
    const joined = updateWallEndpoints(project, 'branch', { end: { x: 2, y: 0 } });

    expect(joined.walls).toHaveLength(3);
    expect(joined.walls.find((wall) => wall.id === 'boundary')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(joined.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 0 } });
    expect(joined.walls.find((wall) => wall.id === 'branch')?.end).toEqual({ x: 2, y: 0 });
    expect(joined.rooms[0].points).toContainEqual({ x: 2, y: 0 });
    expect(roomArea(joined.rooms[0])).toBe(8);
    expect(project.walls).toHaveLength(2);
    expect(project.rooms[0].points).toHaveLength(4);
  });

  it('reassigns openings when an endpoint split leaves them on one wall and rejects a through-opening cut', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 1 });
    const project = { ...base, walls: [host, branch], rooms: [] };
    const withWindow = addWallOpening(project, 'host', 'window');
    const opening = withWindow.wallOpenings[0];
    const rightSide = updateWallOpening(withWindow, opening.id, { center: 3.2, width: 0.5 });
    const split = updateWallEndpoints(rightSide, 'branch', { end: { x: 2, y: 0 } });

    expect(split.wallOpenings[0]).toMatchObject({ wallId: 'wall-1', width: 0.5 });
    expect(split.wallOpenings[0].center).toBeCloseTo(1.2);
    const throughOpening = addWallOpening(project, 'host', 'window');
    expect(() => updateWallEndpoints(throughOpening, 'branch', { end: { x: 2, y: 0 } })).toThrow(/cannot split a wall through an opening/);
    expect(project.walls).toHaveLength(2);
  });

  it('connects newly added wall endpoints to host segments and room edges', () => {
    const base = createStarterProject();
    const boundary = createWall('boundary', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 0 });
    const room = createPolygonRoom('t-room', 'T-junction room', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ]);
    const project = { ...base, walls: [boundary], rooms: [room] };
    const added = addWall(project, branch);

    expect(added.walls).toHaveLength(3);
    expect(added.walls.find((wall) => wall.id === 'boundary')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(added.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 0 } });
    expect(added.walls.find((wall) => wall.id === 'branch')?.start).toEqual({ x: 2, y: 2 });
    expect(added.rooms[0].points).toContainEqual({ x: 2, y: 0 });
    expect(roomArea(added.rooms[0])).toBe(8);
    expect(() => addWall(project, boundary)).toThrow(/already exists/);
  });

  it('splits both walls at a same-level X crossing and preserves wall properties immutably', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 4 }, 0.2, 3.1, 'brick', 'floor-ground');
    const project = { ...base, walls: [host], rooms: [] };
    const added = addWall(project, createWall('crossing', { x: 0, y: 4 }, { x: 4, y: 0 }, 0.18, 2.8, 'glass', 'floor-ground'));

    expect(added.walls).toHaveLength(4);
    expect(added.walls.find((wall) => wall.id === 'host')).toMatchObject({ start: host.start, end: { x: 2, y: 2 }, thickness: 0.2, height: 3.1, materialId: 'brick' });
    expect(added.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 2 }, end: host.end, thickness: 0.2, height: 3.1, materialId: 'brick' });
    expect(added.walls.find((wall) => wall.id === 'crossing')).toMatchObject({ start: { x: 0, y: 4 }, end: { x: 2, y: 2 }, thickness: 0.18, height: 2.8, materialId: 'glass' });
    expect(added.walls.find((wall) => wall.id === 'wall-2')).toMatchObject({ start: { x: 2, y: 2 }, end: { x: 4, y: 0 }, thickness: 0.18, height: 2.8, materialId: 'glass' });
    expect(project.walls).toEqual([host]);

    const obliqueHost = createWall('oblique-host', { x: 0, y: 0 }, { x: 7, y: 5 });
    const obliqueProject = { ...base, walls: [obliqueHost], rooms: [] };
    const oblique = addWall(obliqueProject, createWall('oblique-crossing', { x: 0, y: 6 }, { x: 5, y: 0 }));
    const junction = oblique.walls.find((wall) => wall.id === 'oblique-host')!.end;
    expect(oblique.walls.find((wall) => wall.id === 'wall-1')!.start).toEqual(junction);
    expect(oblique.walls.find((wall) => wall.id === 'oblique-crossing')!.end).toEqual(junction);
    expect(oblique.walls.find((wall) => wall.id === 'wall-2')!.start).toEqual(junction);
  });

  it('splits a newly added wall when an existing wall endpoint lands in its interior', () => {
    const base = createStarterProject();
    const stub = createWall('stub', { x: 2, y: 0 }, { x: 2, y: 2 });
    const project = { ...base, walls: [stub], rooms: [] };
    const added = addWall(project, createWall('boundary', { x: 0, y: 0 }, { x: 4, y: 0 }));

    expect(added.walls).toHaveLength(3);
    expect(added.walls.find((wall) => wall.id === 'boundary')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(added.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 0 } });
    expect(added.walls.find((wall) => wall.id === 'stub')?.start).toEqual({ x: 2, y: 0 });
    expect(project.walls).toEqual([stub]);
  });

  it('keeps cross-floor and parallel disjoint walls independent, rejects overlap, and normalizes multiple crossings', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const project = { ...base, walls: [host], rooms: [] };
    const upstairs = addWall(project, createWall('upstairs', { x: 2, y: -2 }, { x: 2, y: 2 }, undefined, undefined, undefined, 'floor-upper'));
    expect(upstairs.walls).toHaveLength(2);
    const parallel = addWall(project, createWall('parallel', { x: 0, y: 1 }, { x: 4, y: 1 }));
    expect(parallel.walls).toHaveLength(2);
    expect(() => addWall(project, createWall('overlap', { x: 2, y: 0 }, { x: 5, y: 0 }))).toThrow(/cannot overlap/);
    const twoHosts = { ...project, walls: [host, createWall('host-2', { x: 0, y: 2 }, { x: 4, y: 2 })] };
    const throughBoth = addWall(twoHosts, createWall('through-both', { x: 2, y: -1 }, { x: 2, y: 3 }));
    expect(throughBoth.walls).toHaveLength(7);
    expect(throughBoth.walls.find((wall) => wall.id === 'host')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'wall-1')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 4, y: 0 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'host-2')).toMatchObject({ start: { x: 0, y: 2 }, end: { x: 2, y: 2 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'wall-2')).toMatchObject({ start: { x: 2, y: 2 }, end: { x: 4, y: 2 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'through-both')).toMatchObject({ start: { x: 2, y: -1 }, end: { x: 2, y: 0 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'wall-4')).toMatchObject({ start: { x: 2, y: 0 }, end: { x: 2, y: 2 } });
    expect(throughBoth.walls.find((wall) => wall.id === 'wall-3')).toMatchObject({ start: { x: 2, y: 2 }, end: { x: 2, y: 3 } });
    expect(twoHosts.walls).toHaveLength(2);
    expect(project.walls).toEqual([host]);
    const openingOnSecondHost = addWallOpening(twoHosts, 'host-2', 'window');
    expect(() => addWall(openingOnSecondHost, createWall('through-both', { x: 2, y: -1 }, { x: 2, y: 3 })))
      .toThrow(/cannot split a wall through an opening/);
    expect(openingOnSecondHost.walls).toHaveLength(2);
    expect(openingOnSecondHost.wallOpenings[0].wallId).toBe('host-2');
  });

  it('reassigns openings on one side of an X crossing and atomically rejects a crossing through an opening', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const project = { ...base, walls: [host], rooms: [] };
    const withWindow = updateWallOpening(addWallOpening(project, 'host', 'window'), 'opening-1', { center: 3.2, width: 0.5 });
    const added = addWall(withWindow, createWall('crossing', { x: 2, y: -2 }, { x: 2, y: 2 }));
    expect(added.wallOpenings[0]).toMatchObject({ wallId: 'wall-1', width: 0.5 });
    expect(added.wallOpenings[0].center).toBeCloseTo(1.2);

    const throughOpening = addWallOpening(project, 'host', 'window');
    expect(() => addWall(throughOpening, createWall('crossing', { x: 2, y: -2 }, { x: 2, y: 2 }))).toThrow(/cannot split a wall through an opening/);
    expect(throughOpening.walls).toEqual([host]);
    expect(throughOpening.wallOpenings[0].wallId).toBe('host');
  });

  it('rejects a newly drawn wall endpoint that would split a hosted opening in two', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const project = { ...base, walls: [host], rooms: [] };
    const withWindow = addWallOpening(project, 'host', 'window');
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 0 });

    expect(() => addWall(withWindow, branch)).toThrow(/cannot split a wall through an opening/);
    expect(withWindow.walls).toHaveLength(1);
  });

  it('repairs saved X crossings, splits room-edge crossings, and is idempotent', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 2, y: -2 }, { x: 2, y: 3 });
    const room = createPolygonRoom('room-legacy', 'Legacy room', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ]);
    const legacy = { ...base, walls: [host, branch], rooms: [room] };

    const repaired = repairWallTopology(legacy);
    expect(repaired.walls).toHaveLength(5);
    expect(repaired.walls.find((wall) => wall.id === 'host')?.end).toEqual({ x: 2, y: 0 });
    expect(repaired.walls.find((wall) => wall.id === 'branch')?.end).toEqual({ x: 2, y: 0 });
    expect(repaired.rooms[0].points).toContainEqual({ x: 2, y: 0 });
    expect(repaired.rooms[0].points).toContainEqual({ x: 2, y: 2 });
    expect(roomArea(repaired.rooms[0])).toBe(8);
    expect(legacy.walls).toEqual([host, branch]);
    expect(legacy.rooms[0].points).toHaveLength(4);
    expect(repairWallTopology(repaired)).toBe(repaired);
  });

  it('reassigns openings during legacy T-junction repair and rejects through-opening cuts atomically', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 0 });
    const legacy = { ...base, walls: [host, branch], rooms: [] };
    const safeOpening = updateWallOpening(addWallOpening(legacy, 'host', 'window'), 'opening-1', { center: 3.2, width: 0.5 });

    const repaired = repairWallTopology(safeOpening);
    expect(repaired.walls).toHaveLength(3);
    expect(repaired.wallOpenings[0]).toMatchObject({ wallId: 'wall-1', width: 0.5 });
    expect(repaired.wallOpenings[0].center).toBeCloseTo(1.2);
    expect(repairWallTopology(repaired)).toBe(repaired);

    const throughOpening = addWallOpening(legacy, 'host', 'window');
    expect(() => repairWallTopology(throughOpening)).toThrow(/cannot split a wall through an opening/);
    expect(throughOpening.walls).toEqual([host, branch]);
    expect(throughOpening.wallOpenings[0].wallId).toBe('host');
  });

  it('leaves cross-floor contacts alone and rejects ambiguous collinear overlaps without mutation', () => {
    const base = createStarterProject();
    const host = createWall('host', { x: 0, y: 0 }, { x: 4, y: 0 });
    const upstairs = createWall('upstairs', { x: 2, y: -2 }, { x: 2, y: 2 }, undefined, undefined, undefined, 'floor-upper');
    const separateFloors = { ...base, walls: [host, upstairs], rooms: [] };
    expect(repairWallTopology(separateFloors)).toBe(separateFloors);

    const overlap = createWall('overlap', { x: 2, y: 0 }, { x: 5, y: 0 });
    const legacyOverlap = { ...base, walls: [host, overlap], rooms: [] };
    expect(() => repairWallTopology(legacyOverlap)).toThrow(/cannot overlap/);
    expect(legacyOverlap.walls).toEqual([host, overlap]);
  });

  it('joins compatible reversed collinear walls, rebases openings, and removes a straight room vertex', () => {
    const base = createStarterProject();
    const left = createWall('left', { x: 0, y: 0 }, { x: 2, y: 0 }, 0.2, 2.8, 'brick');
    const right = createWall('right', { x: 4, y: 0 }, { x: 2, y: 0 }, 0.2, 2.8, 'brick');
    const room = createPolygonRoom('room-joined', 'Joined room', [
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ]);
    let project: ReturnType<typeof createStarterProject> = { ...base, walls: [left, right], rooms: [room] };
    project = addWallOpening(project, 'left', 'window');
    project = addWallOpening(project, 'right', 'window');

    expect(findJoinableWall(project, 'left')).toBe('right');
    const joined = joinCollinearWalls(project, 'left', 'right');
    expect(joined.walls).toHaveLength(1);
    expect(joined.walls[0]).toMatchObject({ id: 'left', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thickness: 0.2, height: 2.8, materialId: 'brick' });
    expect(joined.wallOpenings).toHaveLength(2);
    expect(joined.wallOpenings.map((opening) => opening.wallId)).toEqual(['left', 'left']);
    expect(joined.wallOpenings.map((opening) => opening.center)).toEqual([1, 3]);
    expect(joined.rooms[0].points).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }]);
    expect(roomArea(joined.rooms[0])).toBe(8);
    expect(project.walls).toEqual([left, right]);
    expect(project.rooms[0].points).toHaveLength(5);
    expect(findJoinableWall(joined, 'left')).toBeNull();

    const selectedStartsAtJoin = createWall('selected-start', { x: 2, y: 0 }, { x: 4, y: 0 });
    const previous = createWall('previous', { x: 0, y: 0 }, { x: 2, y: 0 });
    const joinedAtStart = joinCollinearWalls({ ...base, walls: [selectedStartsAtJoin, previous], rooms: [] }, 'selected-start', 'previous');
    expect(joinedAtStart.walls[0]).toMatchObject({ id: 'selected-start', start: { x: 0, y: 0 }, end: { x: 4, y: 0 } });
  });

  it('rejects joins across incompatible properties, branches, floors, or ambiguous neighbors', () => {
    const base = createStarterProject();
    const selected = createWall('selected', { x: 0, y: 0 }, { x: 2, y: 0 });
    const wrongHeight = createWall('wrong-height', { x: 2, y: 0 }, { x: 4, y: 0 }, undefined, 3.2);
    const incompatible = { ...base, walls: [selected, wrongHeight], rooms: [] };
    expect(findJoinableWall(incompatible, 'selected')).toBeNull();
    expect(() => joinCollinearWalls(incompatible, 'selected', 'wrong-height')).toThrow(/compatible, collinear/);

    const neighbor = createWall('neighbor', { x: 4, y: 0 }, { x: 2, y: 0 });
    const branch = createWall('branch', { x: 2, y: 2 }, { x: 2, y: 0 });
    const branched = { ...base, walls: [selected, neighbor, branch], rooms: [] };
    expect(findJoinableWall(branched, 'selected')).toBeNull();
    expect(() => joinCollinearWalls(branched, 'selected', 'neighbor')).toThrow(/unbranched endpoint/);

    const opposite = createWall('opposite', { x: -2, y: 0 }, { x: 0, y: 0 });
    const after = createWall('after', { x: 2, y: 0 }, { x: 4, y: 0 });
    const ambiguous = { ...base, walls: [selected, opposite, after], rooms: [] };
    expect(findJoinableWall(ambiguous, 'selected')).toBeNull();

    const upstairs = createWall('upstairs', { x: 2, y: 0 }, { x: 4, y: 0 }, undefined, undefined, undefined, 'floor-upper');
    const separateFloors = { ...base, walls: [selected, upstairs], rooms: [] };
    expect(findJoinableWall(separateFloors, 'selected')).toBeNull();
    expect(() => joinCollinearWalls(separateFloors, 'selected', 'upstairs')).toThrow(/compatible, collinear/);
  });

  it('rejects a connected-node edit that collapses a room edge or invalidates a hosted opening', () => {
    const project = createStarterProject();
    expect(() => updateWallEndpoints(project, 'wall-north', { end: { x: 4.2, y: 2.1 } })).toThrow(/self-intersect|non-zero length/);
    const withDoor = addWallOpening(project, 'wall-north', 'door');
    expect(() => updateWallEndpoints(withDoor, 'wall-north', { start: { x: 5.9, y: -0.5 } })).toThrow(/opening must fit/);
    expect(project.walls.find((wall) => wall.id === 'wall-north')?.start).toEqual({ x: 4.2, y: -0.5 });
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

  it('assigns a known material to one room ceiling and preserves it through normalization', () => {
    const project = createStarterProject();
    const updated = assignRoomCeilingMaterial(project, 'room-starter', 'material-neutral-wall');

    expect(updated.rooms[0]).toMatchObject({ ceilingMaterialId: 'material-neutral-wall', floorMaterialId: 'material-neutral-floor' });
    expect(project.rooms[0].ceilingMaterialId).toBeUndefined();
    expect(normalizeProject(JSON.parse(JSON.stringify(updated))).rooms[0].ceilingMaterialId).toBe('material-neutral-wall');
    expect(() => assignRoomCeilingMaterial(project, '', 'material-neutral-wall')).toThrow(/room id/);
    expect(() => assignRoomCeilingMaterial(project, 'missing-room', 'material-neutral-wall')).toThrow(/unknown room/);
    expect(() => assignRoomCeilingMaterial(project, 'room-starter', 'missing-material')).toThrow(/unknown material/);
  });

  it('assigns a known material to only the selected wall without mutating the project', () => {
    const project = createStarterProject();
    const updated = assignWallMaterial(project, 'wall-north', 'material-neutral-floor');

    expect(updated.walls.find((wall) => wall.id === 'wall-north')?.materialId).toBe('material-neutral-floor');
    expect(updated.walls.find((wall) => wall.id === 'wall-east')?.materialId).toBe('material-neutral-wall');
    expect(project.walls.find((wall) => wall.id === 'wall-north')?.materialId).toBe('material-neutral-wall');
    expect(updated.rooms).toEqual(project.rooms);
    expect(updated.furniture).toEqual(project.furniture);
    expect(normalizeProject(JSON.parse(JSON.stringify(updated))).walls.find((wall) => wall.id === 'wall-north')?.materialId).toBe('material-neutral-floor');
    const splitSegments = splitWall(updated, 'wall-north').walls.filter((wall) => wall.start.y === -0.5 && wall.end.y === -0.5 && wall.start.x >= 4.2 && wall.end.x <= 6.2);
    expect(splitSegments).toHaveLength(2);
    expect(splitSegments.map((wall) => wall.materialId)).toEqual(['material-neutral-floor', 'material-neutral-floor']);
  });

  it('rejects blank, unknown-wall, and unknown-material wall assignments atomically', () => {
    const project = createStarterProject();
    expect(() => assignWallMaterial(project, '', 'material-neutral-floor')).toThrow(/wall id/);
    expect(() => assignWallMaterial(project, 'missing-wall', 'material-neutral-floor')).toThrow(/unknown wall/);
    expect(() => assignWallMaterial(project, 'wall-north', 'missing-material')).toThrow(/unknown material/);
    expect(project.walls.find((wall) => wall.id === 'wall-north')?.materialId).toBe('material-neutral-wall');
  });

  it('places and incrementally rotates furniture in a project', () => {
    const project = createStarterProject();
    const withFurniture = addFurniture(project, { ...furniture, position: { x: 5.2, y: 0.8 } });
    const rotated = rotateFurniture(withFurniture, 'chair-1', 45);
    expect(withFurniture.furniture).toHaveLength(1);
    expect(withFurniture.furniture[0]).toMatchObject({ rotationX: 0, rotationZ: 0 });
    expect(rotated.furniture[0]).toMatchObject({ id: 'chair-1', position: { x: 5.2, y: 0.8 }, rotation: 45 });
    expect(project.furniture).toHaveLength(0);
  });

  it('moves one furniture instance immutably while preserving its other properties', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const moved = moveFurniture(project, 'chair-1', { x: 5.2, y: 1.2 });

    expect(moved.furniture[0]).toMatchObject({
      id: 'chair-1', position: { x: 5.2, y: 1.2 }, rotation: 0, width: 0.6, roomId: 'room-starter',
    });
    expect(project.furniture[0].position).toEqual({ x: 1, y: 1 });
    expect(moved.rooms).toEqual(project.rooms);
    expect(Object.isFrozen(moved)).toBe(true);
  });

  it('returns the same project for a same-position move', () => {
    const project = addFurniture(createStarterProject(), { ...furniture, position: { x: 5.2, y: 0.8 } });
    expect(moveFurniture(project, 'chair-1', { x: 5.2, y: 0.8 })).toBe(project);
  });

  it('rejects a move to an unknown furniture ID', () => {
    expect(() => moveFurniture(createStarterProject(), 'missing', { x: 1, y: 1 })).toThrow(/unknown furniture/);
  });

  it('rejects moves outside the assigned room without mutating the existing project', () => {
    const project = addFurniture(createStarterProject(), furniture);
    expect(() => moveFurniture(project, 'chair-1', { x: 6.05, y: 0.8 })).toThrow(/assigned room/);
    expect(project.furniture[0].position).toEqual({ x: 1, y: 1 });
  });

  it('rejects non-finite furniture move coordinates', () => {
    const project = addFurniture(createStarterProject(), furniture);
    expect(() => moveFurniture(project, 'chair-1', { x: Number.NaN, y: 1 })).toThrow(/finite numbers/);
  });

  it('updates dimensions, position and rotation without changing the original instance', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const updated = updateFurniture(project, 'chair-1', {
      position: { x: 5.2, y: 1.2 }, width: 1.2, rotation: 90,
    });

    expect(updated.furniture[0]).toMatchObject({ position: { x: 5.2, y: 1.2 }, width: 1.2, rotation: 90 });
    expect(project.furniture[0]).toMatchObject({ position: { x: 1, y: 1 }, width: 0.6, rotation: 0 });
  });

  it('rejects a numeric footprint edit that would extend beyond the assigned room', () => {
    const project = addFurniture(createStarterProject(), { ...furniture, position: { x: 5.2, y: 0.8 } });
    expect(() => updateFurniture(project, 'chair-1', { width: 2.2 })).toThrow(/assigned room/);
    expect(project.furniture[0].width).toBe(0.6);
  });

  it('changes only the selected furniture color without mutating the original project', () => {
    const project = addFurniture(createStarterProject(), furniture);
    const twoObjects = addFurniture(project, { ...furniture, id: 'chair-2', position: { x: 2, y: 2 } });
    const colored = updateFurniture(twoObjects, 'chair-1', { color: '#d9c7aa' });

    expect(colored.furniture[0].color).toBe('#d9c7aa');
    expect(colored.furniture[1].color).toBe(twoObjects.furniture[1].color);
    expect(twoObjects.furniture[0].color).toBe(project.furniture[0].color);
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

  it('duplicates furniture into the nearest valid position without colliding with another object', () => {
    const base = createStarterProject();
    const room = createRectRoom('room-placement', 'Placement room', 8, 5, { x: 10, y: 0 }, undefined, 'floor-ground');
    const empty = { ...base, rooms: [room], walls: [] };
    const project = addFurniture(empty, { ...furniture, position: { x: 12, y: 2.5 }, width: 0.6, depth: 0.6, roomId: room.id });
    const blockedRight = addFurniture(project, { ...furniture, id: 'chair-blocker', position: { x: 12.7, y: 2.5 }, width: 0.4, depth: 0.4, roomId: room.id });
    const duplicated = duplicateFurniture(blockedRight, 'chair-1');
    const copy = duplicated.furniture.find((item) => item.id !== 'chair-1' && item.id !== 'chair-blocker')!;

    expect(copy).toMatchObject({ assetId: 'asset-chair', name: 'Generic Chair', roomId: room.id });
    expect(Math.hypot(copy.position.x - 12, copy.position.y - 2.5)).toBeCloseTo(0.7, 8);
    expect(copy.position).not.toEqual({ x: 12.7, y: 2.5 });
    expect(() => assertFurniturePlacement(duplicated, copy)).not.toThrow();
    expect(blockedRight.furniture).toHaveLength(2);
  });

  it('rejects a duplicate when no collision-free position fits and leaves the source unchanged', () => {
    const base = createStarterProject();
    const room = createRectRoom('room-placement', 'Small placement room', 0.8, 0.8, { x: 10, y: 0 }, undefined, 'floor-ground');
    const empty = { ...base, rooms: [room], walls: [] };
    const project = addFurniture(empty, { ...furniture, position: { x: 10.4, y: 0.4 }, width: 0.6, depth: 0.6, roomId: room.id });

    expect(() => duplicateFurniture(project, 'chair-1')).toThrow(/no valid room placement/);
    expect(project.furniture).toHaveLength(1);
    expect(project.furniture[0].position).toEqual({ x: 10.4, y: 0.4 });
  });

  it('tests nearer duplicate clearances before farther ones for a wide furniture footprint', () => {
    const base = createStarterProject();
    const room = createRectRoom('room-placement', 'Placement room', 8, 5, { x: 10, y: 0 }, undefined, 'floor-ground');
    const empty = { ...base, rooms: [room], walls: [] };
    const project = addFurniture(empty, { ...furniture, position: { x: 14, y: 2.5 }, width: 2, depth: 0.2, roomId: room.id });
    const duplicated = duplicateFurniture(project, 'chair-1');

    expect(duplicated.furniture[1].position).toMatchObject({ x: 14, y: expect.closeTo(2.8, 8) });
  });

  it('creates an evenly spaced, validated furniture array in one immutable project update', () => {
    const base = createStarterProject();
    const room = createRectRoom('room-placement', 'Placement room', 8, 5, { x: 10, y: 0 }, undefined, 'floor-ground');
    const empty = { ...base, rooms: [room], walls: [] };
    const project = addFurniture(empty, { ...furniture, position: { x: 12, y: 2.5 }, width: 0.6, depth: 0.6, roomId: room.id });
    const result = arrayFurniture(project, 'chair-1', 3, { x: 0.8, y: -0.25 });

    expect(result.furniture).toHaveLength(4);
    expect(result.furniture.slice(1).map((item) => item.position)).toEqual([
      { x: 12.8, y: 2.25 },
      { x: 13.6, y: 2 },
      { x: 14.4, y: 1.75 },
    ]);
    expect(result.furniture.slice(1).map((item) => item.id)).toEqual(['furniture-1', 'furniture-2', 'furniture-3']);
    expect(result.furniture[3]).toMatchObject({ width: 0.6, depth: 0.6, height: 0.9, roomId: room.id });
    result.furniture.slice(1).forEach((item) => expect(() => assertFurniturePlacement(result, item)).not.toThrow());
    expect(project.furniture).toHaveLength(1);
  });

  it('rejects colliding or out-of-room arrays atomically, including a failure after valid copies', () => {
    const base = createStarterProject();
    const room = createRectRoom('room-placement', 'Placement room', 3, 2, { x: 10, y: 0 }, undefined, 'floor-ground');
    const empty = { ...base, rooms: [room], walls: [] };
    const project = addFurniture(empty, { ...furniture, position: { x: 10.8, y: 1 }, width: 0.4, depth: 0.4, roomId: room.id });

    expect(() => arrayFurniture(project, 'chair-1', 2, { x: 0.2, y: 0 })).toThrow(/overlap another visible object/);
    expect(() => arrayFurniture(project, 'chair-1', 3, { x: 0.9, y: 0 })).toThrow(/fully inside its assigned room/);
    expect(project.furniture).toHaveLength(1);
    expect(project.furniture[0].position).toEqual({ x: 10.8, y: 1 });
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
    const upperWall = createWall('wall-upper', { x: 0, y: 0 }, { x: 3, y: 0 }, undefined, undefined, undefined, second.activeLevelId);
    const withRoom = { ...second, rooms: [...second.rooms, room], walls: [...second.walls, upperWall] };
    const withOpening = addWallOpening(withRoom, upperWall.id, 'door');
    const withoutSecond = removeLevel(withOpening, second.activeLevelId);

    expect(withoutSecond.levels).toHaveLength(1);
    expect(withoutSecond.activeLevelId).toBe(project.activeLevelId);
    expect(withoutSecond.rooms.some((item) => item.id === room.id)).toBe(false);
    expect(withoutSecond.wallOpenings).toEqual([]);
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

  it('creates generic door and window openings with safe defaults and legacy projects migrate cleanly', () => {
    const project = createStarterProject();
    const doorProject = addWallOpening(project, 'wall-north', 'door');
    const door = doorProject.wallOpenings[0];
    expect(door).toMatchObject({ wallId: 'wall-north', kind: 'door', center: 1, width: 0.9, height: 2.05, sillHeight: 0 });
    const windowProject = addWallOpening(project, 'wall-north', 'window');
    expect(windowProject.wallOpenings[0]).toMatchObject({ kind: 'window', center: 1, width: 1.2, height: 1.2, sillHeight: 0.9 });
    const { wallOpenings: _wallOpenings, ...legacy } = project;
    expect(normalizeProject(legacy).wallOpenings).toEqual([]);
    expect(normalizeProject(doorProject).wallOpenings).toEqual([door]);
  });

  it('validates opening bounds, overlap, dimensions and immutable edits', () => {
    const project = addWallOpening(createStarterProject(), 'wall-north', 'door');
    const door = project.wallOpenings[0];
    const moved = updateWallOpening(project, door.id, { center: 0.5, width: 0.8 });
    expect(moved.wallOpenings[0]).toMatchObject({ center: 0.5, width: 0.8 });
    expect(project.wallOpenings[0]).toMatchObject({ center: 1, width: 0.9 });
    expect(() => updateWallOpening(project, door.id, { width: 2.1 })).toThrow(/fit within the wall length/);
    expect(() => updateWallOpening(project, door.id, { height: 2.5 })).toThrow(/fit within the wall height/);
    expect(() => addWallOpening(project, 'wall-north', 'window')).toThrow(/cannot overlap/);
    expect(() => addWallOpening(project, 'missing-wall', 'door')).toThrow(/unknown wall/);
  });

  it('rejects wall edits that invalidate openings and deletes hosted openings with their wall', () => {
    const project = addWallOpening(createStarterProject(), 'wall-north', 'door');
    expect(() => updateWallHeight(project, 'wall-north', 1.9)).toThrow(/fit within the wall height/);
    expect(() => updateWallEndpoints(project, 'wall-north', { end: { x: 5, y: -0.5 } })).toThrow(/fit within the wall length/);
    expect(removeWall(project, 'wall-north').wallOpenings).toEqual([]);
    expect(removeWallOpening(project, project.wallOpenings[0].id).wallOpenings).toEqual([]);
  });

  it('moves openings to the correct child wall when split and rejects splits through openings', () => {
    const project = addWallOpening(createStarterProject(), 'wall-north', 'door');
    expect(() => splitWall(project, 'wall-north')).toThrow(/through an opening/);
    const shifted = updateWallOpening(project, project.wallOpenings[0].id, { center: 1.5 });
    const split = splitWall(shifted, 'wall-north', 0.25);
    expect(split.wallOpenings[0]).toMatchObject({ wallId: 'wall-1', center: 1 });
    expect(split.walls.find((wall) => wall.id === 'wall-1')?.start).toEqual({ x: 4.7, y: -0.5 });
  });

  it('decomposes walls into solid 3D regions above, below and beside openings', () => {
    const project = addWallOpening(createStarterProject(), 'wall-north', 'window');
    const window = project.wallOpenings[0];
    const segments = wallSolidSegments(2, 2.4, [window]);
    expect(segments).toEqual([
      { start: 0, end: 0.4, bottom: 0, top: 2.4 },
      { start: 0.4, end: 1.6, bottom: 0, top: 0.9 },
      { start: 0.4, end: 1.6, bottom: 2.1, top: 2.4 },
      { start: 1.6, end: 2, bottom: 0, top: 2.4 },
    ]);
    expect(() => wallSolidSegments(0, 2.4, [])).toThrow(/positive finite/);
  });
});
