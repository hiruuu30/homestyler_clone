import { describe, expect, it } from 'vitest';
import {
  addRoomHole, convertProjectUnits, createPolygonRoom, createPolygonRoomWithHoles,
  createStarterProject, createWall, normalizeProject, removeRoomHole, repairWallTopology, roomArea, updateWallEndpoints,
} from './model';
import {
  ceilingElevationForLevel, createRoomCeilingGeometry, createRoomFloorGeometry, createVisibleRoomCeilings,
} from '../components/SceneViewport';

const outer = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const hole = [
  { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 },
];

describe('room floor holes', () => {
  it('subtracts validated hole area and accepts either ring orientation', () => {
    const room = createPolygonRoomWithHoles('room-1', 'Atrium', outer, [hole]);
    expect(room.holes).toHaveLength(1);
    expect(roomArea(room)).toBe(96);
    expect(Object.isFrozen(room.holes)).toBe(true);
    expect(Object.isFrozen(room.holes?.[0])).toBe(true);

    const reversed = createPolygonRoomWithHoles('room-2', 'Atrium', outer, [[...hole].reverse()]);
    expect(roomArea(reversed)).toBe(96);
  });

  it('triangulates the 3D room surface with the hole removed', () => {
    const room = createPolygonRoomWithHoles('room-1', 'Atrium', outer, [hole]);
    const geometry = createRoomFloorGeometry(room);
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    expect(index).not.toBeNull();
    let triangleArea = 0;
    for (let offset = 0; offset < index!.count; offset += 3) {
      const a = index!.getX(offset);
      const b = index!.getX(offset + 1);
      const c = index!.getX(offset + 2);
      const abX = position.getX(b) - position.getX(a);
      const abY = position.getY(b) - position.getY(a);
      const acX = position.getX(c) - position.getX(a);
      const acY = position.getY(c) - position.getY(a);
      triangleArea += Math.abs(abX * acY - abY * acX) / 2;
    }
    expect(triangleArea).toBeCloseTo(96, 6);
    geometry.dispose();
  });

  it('triangulates concave ceiling outlines in either winding without inheriting floor holes', () => {
    const concave = createPolygonRoom('ceiling-concave', 'Concave ceiling', [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 },
      { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 0, y: 5 },
    ]);
    const reversed = createPolygonRoom('ceiling-reversed', 'Reversed ceiling', [...concave.points].reverse());
    const withFloorHole = createPolygonRoomWithHoles('ceiling-hole', 'Floor opening below', outer, [hole]);
    for (const room of [concave, reversed, withFloorHole]) {
      const geometry = createRoomCeilingGeometry(room);
      const position = geometry.getAttribute('position');
      const index = geometry.getIndex();
      expect(index).not.toBeNull();
      let area = 0;
      for (let offset = 0; offset < index!.count; offset += 3) {
        const a = index!.getX(offset);
        const b = index!.getX(offset + 1);
        const c = index!.getX(offset + 2);
        area += Math.abs(
          (position.getX(b) - position.getX(a)) * (position.getY(c) - position.getY(a))
          - (position.getY(b) - position.getY(a)) * (position.getX(c) - position.getX(a)),
        ) / 2;
      }
      const expectedArea = Math.abs(room.points.reduce((sum, point, pointIndex) => {
        const next = room.points[(pointIndex + 1) % room.points.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0) / 2);
      expect(area).toBeCloseTo(expectedArea, 6);
      geometry.dispose();
    }
  });

  it('places a ceiling at the active level height and creates meshes only for visible rooms', () => {
    expect(ceilingElevationForLevel({ elevation: 3.2, height: 2.7 })).toBeCloseTo(5.9, 8);
    expect(ceilingElevationForLevel()).toBe(2.4);
    const visibleRoom = createPolygonRoom('visible', 'Visible room', outer);
    const hiddenRoom = { ...visibleRoom, id: 'hidden', ceilingVisible: false };
    const meshes = createVisibleRoomCeilings([visibleRoom, hiddenRoom], 5.9);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].position.y).toBe(5.9);
    expect(meshes[0].material).toMatchObject({ transparent: true, opacity: 0.18 });
    expect(() => createVisibleRoomCeilings([visibleRoom], Number.NaN)).toThrow(/finite/);
    meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as { dispose: () => void }).dispose();
    });
  });

  it('rejects outside, boundary-touching, intersecting, overlapping, and self-crossing holes', () => {
    expect(() => createPolygonRoomWithHoles('a', 'Room', outer, [[
      { x: 9, y: 2 }, { x: 11, y: 2 }, { x: 11, y: 4 }, { x: 9, y: 4 },
    ]])).toThrow(/strictly inside/);
    expect(() => createPolygonRoomWithHoles('b', 'Room', outer, [[
      { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ]])).toThrow(/strictly inside/);
    expect(() => createPolygonRoomWithHoles('c', 'Room', outer, [[
      { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 },
    ], [
      { x: 4, y: 4 }, { x: 7, y: 4 }, { x: 7, y: 7 }, { x: 4, y: 7 },
    ]])).toThrow(/overlap/);
    expect(() => createPolygonRoomWithHoles('d', 'Room', outer, [[
      { x: 2, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 }, { x: 5, y: 2 },
    ]])).toThrow(/self-intersect/);
    expect(() => createPolygonRoomWithHoles('e', 'Room', [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ], [[
      { x: 0.0005, y: 0.0005 }, { x: 3.9995, y: 0.0005 }, { x: 3.9995, y: 3.9995 }, { x: 0.0005, y: 3.9995 },
    ]])).toThrow(/retain at least/);
  });

  it('adds and removes holes as immutable model operations and rejects invalid indices atomically', () => {
    const base = createStarterProject();
    const room = createPolygonRoom('room-1', 'Room', outer);
    const project = { ...base, rooms: [room] };
    const withHole = addRoomHole(project, room.id, hole);
    expect(withHole).not.toBe(project);
    expect(roomArea(withHole.rooms[0])).toBe(96);
    expect(roomArea(project.rooms[0])).toBe(100);
    expect(removeRoomHole(withHole, room.id, 0).rooms[0].holes).toEqual([]);
    expect(() => removeRoomHole(withHole, room.id, 1)).toThrow(/out of range/);
    expect(project.rooms[0].holes).toBeUndefined();
  });

  it('preserves hole geometry through unit conversion and project JSON migration', () => {
    const base = createStarterProject();
    const room = createPolygonRoomWithHoles('room-1', 'Room', outer, [hole]);
    const project = { ...base, rooms: [room] };
    const imperial = convertProjectUnits(project, 'ft');
    expect(roomArea(imperial.rooms[0]) * 0.3048 ** 2).toBeCloseTo(96, 7);
    const restored = normalizeProject(JSON.parse(JSON.stringify(imperial)));
    expect(restored.rooms[0].holes).toEqual(imperial.rooms[0].holes);
    expect(roomArea(restored.rooms[0])).toBeCloseTo(roomArea(imperial.rooms[0]), 7);

    const legacy = normalizeProject(JSON.parse(JSON.stringify({ ...base, rooms: [createPolygonRoom('legacy', 'Legacy', outer)] })));
    expect(legacy.rooms[0].holes).toBeUndefined();
  });

  it('defaults missing legacy ceiling visibility to on and preserves an explicit off setting', () => {
    const base = createStarterProject();
    const legacyRooms = base.rooms.map(({ ceilingVisible: _ceilingVisible, ...room }) => room);
    const restoredLegacy = normalizeProject(JSON.parse(JSON.stringify({ ...base, rooms: legacyRooms })));
    expect(restoredLegacy.rooms.every((room) => room.ceilingVisible)).toBe(true);
    const hiddenRoom = normalizeProject(JSON.parse(JSON.stringify({
      ...base,
      rooms: [{ ...base.rooms[0], ceilingVisible: false }],
    })));
    expect(hiddenRoom.rooms[0].ceilingVisible).toBe(false);
  });

  it('keeps holes when wall-topology repair inserts an outer boundary vertex', () => {
    const base = createStarterProject();
    const room = createPolygonRoomWithHoles('room-1', 'Room', outer, [hole]);
    const project = {
      ...base,
      rooms: [room],
      walls: [createWall('crossing', { x: -2, y: 5 }, { x: 2, y: 5 })],
    };
    const repaired = repairWallTopology(project);
    expect(repaired.rooms[0].points).toHaveLength(5);
    expect(repaired.rooms[0].holes).toEqual(room.holes);
    expect(roomArea(repaired.rooms[0])).toBe(96);
  });

  it('rejects a boundary edit atomically when it would strand a room hole', () => {
    const base = createStarterProject();
    const room = createPolygonRoomWithHoles('room-1', 'Room', outer, [hole]);
    const project = {
      ...base,
      rooms: [room],
      walls: [
        createWall('bottom', outer[0], outer[1]),
        createWall('right', outer[1], outer[2]),
        createWall('top', outer[2], outer[3]),
        createWall('left', outer[3], outer[0]),
      ],
    };
    expect(() => updateWallEndpoints(project, 'left', {
      start: { x: 5, y: 10 }, end: { x: 5, y: 0 },
    })).toThrow(/strictly inside/);
    expect(project.rooms[0].points).toEqual(outer);
    expect(project.rooms[0].holes).toEqual([hole]);
  });
});
