import { describe, expect, it } from 'vitest';
import {
  addRoomHole,
  addStructuralOpening,
  convertProjectUnits,
  createRectRoom,
  createStarterProject,
  normalizeProject,
  removeRoomHole,
  removeLevel,
  removeStructuralOpening,
} from './model';
import type { DesignProject, Level, Point } from './types';

const levels: readonly Level[] = [
  { id: 'ground', name: 'Ground', elevation: 0, height: 2.7 },
  { id: 'second', name: 'Second', elevation: 3, height: 2.7 },
  { id: 'third', name: 'Third', elevation: 6, height: 2.7 },
];
const opening: readonly Point[] = [
  { x: 2.6, y: 1.2 }, { x: 3.2, y: 1.2 }, { x: 3.2, y: 1.8 }, { x: 2.6, y: 1.8 },
];

function threeFloorProject(thirdOrigin: Point = { x: 2.2, y: 0.8 }): DesignProject {
  const base = createStarterProject();
  const rooms = [
    { ...base.rooms.find((room) => room.id === 'room-living')!, levelId: 'ground' },
    createRectRoom('room-second', 'Second room', 2, 2.6, { x: 2.2, y: 0.8 }, base.materials[0].id, 'second'),
    createRectRoom('room-third', 'Third room', 2, 2.6, thirdOrigin, base.materials[0].id, 'third'),
  ];
  return { ...base, levels, activeLevelId: 'ground', rooms };
}

describe('multi-level structural openings', () => {
  it('cuts the same aligned polygon from each floor in the selected vertical span', () => {
    const base = threeFloorProject();
    const changed = addStructuralOpening(base, 'room-living', 'third', opening);

    expect(changed.structuralOpenings).toHaveLength(1);
    expect(changed.structuralOpenings[0]).toMatchObject({
      levelIds: ['ground', 'second', 'third'],
      roomIds: ['room-living', 'room-second', 'room-third'],
      polygon: opening,
    });
    expect(changed.rooms.map((room) => room.holes)).toEqual([[opening], [opening], [opening]]);
    expect(base.rooms.every((room) => !room.holes?.length)).toBe(true);
  });

  it('rejects lower, missing, misaligned, or ambiguous target-floor geometry atomically', () => {
    const base = threeFloorProject({ x: 8, y: 8 });
    expect(() => addStructuralOpening(base, 'room-living', 'ground', opening)).toThrow(/above/);
    expect(() => addStructuralOpening(base, 'room-living', 'missing', opening)).toThrow(/unknown target level/);
    expect(() => addStructuralOpening(base, 'room-living', 'third', opening)).toThrow(/inside a room on Third/);
    expect(base.rooms.every((room) => !room.holes?.length)).toBe(true);

    const ambiguous = {
      ...threeFloorProject(),
      rooms: [...threeFloorProject().rooms, createRectRoom('room-second-overlap', 'Overlapping', 2, 2.6,
        { x: 2.2, y: 0.8 }, 'material-neutral-floor', 'second')],
    };
    expect(() => addStructuralOpening(ambiguous, 'room-living', 'second', opening)).toThrow(/multiple rooms/);
  });

  it('removes linked holes together while preserving unrelated room voids', () => {
    const base = threeFloorProject();
    const otherHole = [
      { x: 2.3, y: 2.5 }, { x: 2.6, y: 2.5 }, { x: 2.6, y: 2.8 }, { x: 2.3, y: 2.8 },
    ];
    const withOtherHole = addRoomHole(base, 'room-second', otherHole);
    const withStructural = addStructuralOpening(withOtherHole, 'room-living', 'third', opening);
    const removed = removeStructuralOpening(withStructural, withStructural.structuralOpenings[0].id);

    expect(removed.structuralOpenings).toEqual([]);
    expect(removed.rooms.find((room) => room.id === 'room-living')?.holes).toEqual([]);
    expect(removed.rooms.find((room) => room.id === 'room-second')?.holes).toEqual([otherHole]);
    expect(removed.rooms.find((room) => room.id === 'room-third')?.holes).toEqual([]);
    expect(() => removeStructuralOpening(removed, 'missing')).toThrow(/unknown structural opening/);
    const directRemoval = removeRoomHole(withStructural, 'room-second', 1);
    expect(directRemoval.structuralOpenings).toEqual([]);
    expect(directRemoval.rooms.find((room) => room.id === 'room-second')?.holes).toEqual([otherHole]);
  });

  it('cleans linked cutouts from remaining rooms when a participating floor is deleted', () => {
    const withOpening = addStructuralOpening(threeFloorProject(), 'room-living', 'third', opening);
    const withoutSecond = removeLevel(withOpening, 'second');
    expect(withoutSecond.structuralOpenings).toEqual([]);
    expect(withoutSecond.rooms.every((room) => !room.holes?.length)).toBe(true);
  });

  it('preserves spanning geometry through unit conversion, JSON migration, and legacy upgrades', () => {
    const changed = addStructuralOpening(threeFloorProject(), 'room-living', 'third', opening);
    const imperial = convertProjectUnits(changed, 'ft');
    const restored = normalizeProject(JSON.parse(JSON.stringify(imperial)));
    expect(restored.structuralOpenings).toEqual(imperial.structuralOpenings);
    expect(restored.rooms.find((room) => room.id === 'room-second')?.holes).toEqual(imperial.rooms.find((room) => room.id === 'room-second')?.holes);
    expect(() => normalizeProject({ ...changed, structuralOpenings: [{ ...changed.structuralOpenings[0], roomIds: ['room-living'] }] })).toThrow(/matching rooms/);
    expect(() => normalizeProject({ ...changed, structuralOpenings: [{ ...changed.structuralOpenings[0], levelIds: ['ground', 'third'], roomIds: ['room-living', 'room-third'] }] })).toThrow(/every floor/);

    const { structuralOpenings: _structuralOpenings, ...legacy } = createStarterProject();
    expect(normalizeProject(legacy).structuralOpenings).toEqual([]);
  });
});
