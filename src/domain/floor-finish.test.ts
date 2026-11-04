import { describe, expect, it } from 'vitest';
import {
  addRoomHole,
  convertProjectUnits,
  createPolygonRoom,
  createStarterProject,
  normalizeProject,
  removeRoomHole,
  updateRoomFloorFinishMapping,
} from './model';
import { floorPatternSpec, floorPatternSvgMarkup } from './floor-finish';

function sampleProject() {
  const starter = createStarterProject();
  const room = createPolygonRoom('mapped-room', 'Mapped Room', [
    { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
  ], starter.materials[0].id, starter.activeLevelId, starter.units);
  return normalizeProject({
    ...starter,
    rooms: [room],
    walls: [],
    wallOpenings: [],
    furniture: [],
    underlays: [],
  });
}

describe('per-room floor finish mapping', () => {
  it('migrates older projects to an identity mapping without changing the plain finish', () => {
    const project = sampleProject();
    const legacy = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
    const rooms = legacy.rooms as Array<Record<string, unknown>>;
    delete rooms[0].floorFinish;

    const normalized = normalizeProject(legacy);
    expect(normalized.rooms[0].floorFinish).toEqual({
      pattern: 'none', colorOverlay: false, rotation: 0, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1,
    });
  });

  it('round-trips custom pattern transforms and overlay values through project normalization', () => {
    const project = sampleProject();
    const updated = updateRoomFloorFinishMapping(project, 'mapped-room', {
      pattern: 'wood', colorOverlay: true, rotation: 27, offsetX: 0.4, offsetY: -0.2, scaleX: 1.5, scaleY: 0.75,
    });
    const reloaded = normalizeProject(JSON.parse(JSON.stringify(updated)));
    expect(reloaded.rooms[0].floorFinish).toEqual({
      pattern: 'wood', colorOverlay: true, rotation: 27, offsetX: 0.4, offsetY: -0.2, scaleX: 1.5, scaleY: 0.75,
    });
    expect(project.rooms[0].floorFinish?.pattern).toBe('none');
  });

  it('rejects unsupported patterns, out-of-range angles, and invalid scale values', () => {
    const project = sampleProject();
    expect(() => updateRoomFloorFinishMapping(project, 'mapped-room', { pattern: 'marble' as 'wood' })).toThrow(/floor pattern/);
    expect(() => updateRoomFloorFinishMapping(project, 'mapped-room', { rotation: 181 })).toThrow(/rotation/);
    expect(() => updateRoomFloorFinishMapping(project, 'mapped-room', { scaleY: 0 })).toThrow(/scales/);
  });

  it('converts pattern offsets with project units while preserving rotation and relative scales', () => {
    const project = sampleProject();
    const mapped = updateRoomFloorFinishMapping(project, 'mapped-room', {
      pattern: 'tile', rotation: -45, offsetX: 0.25, offsetY: -0.5, scaleX: 2, scaleY: 0.5,
    });
    const imperial = convertProjectUnits(mapped, 'ft').rooms[0].floorFinish!;
    expect(imperial.offsetX).toBeCloseTo(0.25 / 0.3048, 7);
    expect(imperial.offsetY).toBeCloseTo(-0.5 / 0.3048, 7);
    expect(imperial.rotation).toBe(-45);
    expect(imperial.scaleX).toBe(2);
    expect(imperial.scaleY).toBe(0.5);
    const metric = convertProjectUnits(convertProjectUnits(mapped, 'ft'), 'm').rooms[0].floorFinish!;
    expect(metric.offsetX).toBeCloseTo(0.25, 8);
    expect(metric.offsetY).toBeCloseTo(-0.5, 8);
  });

  it('keeps mapping when adding and removing floor-surface openings', () => {
    const project = updateRoomFloorFinishMapping(sampleProject(), 'mapped-room', { pattern: 'wood', offsetX: 0.5, scaleX: 1.25 });
    const withHole = addRoomHole(project, 'mapped-room', [
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ]);
    expect(withHole.rooms[0].floorFinish).toEqual(project.rooms[0].floorFinish);
    const restored = removeRoomHole(withHole, 'mapped-room', 0);
    expect(restored.rooms[0].floorFinish).toEqual(project.rooms[0].floorFinish);
  });

  it('creates physical pattern dimensions in metric and imperial project units', () => {
    const project = sampleProject();
    const room = updateRoomFloorFinishMapping(project, 'mapped-room', { pattern: 'wood', colorOverlay: true, scaleX: 2, scaleY: 0.5 }).rooms[0];
    const metric = floorPatternSpec(room.id, room.floorFinish!, '#b88656', 'm')!;
    const imperial = floorPatternSpec(room.id, room.floorFinish!, '#b88656', 'ft')!;
    expect(metric.width).toBeCloseTo(1.2);
    expect(metric.height).toBeCloseTo(0.18);
    expect(imperial.width).toBeCloseTo(1.2 / 0.3048);
    expect(imperial.height).toBeCloseTo(0.18 / 0.3048);
    expect(floorPatternSvgMarkup(metric)).toContain('patternTransform="translate(0 0) rotate(0)"');
    expect(floorPatternSvgMarkup(metric)).toContain('#b88656');
  });
});
