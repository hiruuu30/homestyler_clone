import { describe, expect, it } from 'vitest';
import { createRectRoom, createStarterProject } from './model';
import { snapFurniturePosition, snapPlanPoint } from './snapping';

describe('plan endpoint snapping', () => {
  it('snaps to a nearby room corner or wall endpoint and leaves distant points unchanged', () => {
    const project = createStarterProject();

    expect(snapPlanPoint(project, { x: 4.24, y: -0.47 }, 0.1)).toEqual({ x: 4.2, y: -0.5 });
    const distant = { x: 7, y: 4 };
    expect(snapPlanPoint(project, distant, 0.1)).toBe(distant);
  });

  it('snaps to the nearest point on wall and room edges when no endpoint is nearby', () => {
    const project = createStarterProject();
    expect(snapPlanPoint(project, { x: 5.1, y: -0.46 }, 0.1)).toEqual({ x: 5.1, y: -0.5 });

    const room = createRectRoom('room-edge', 'Room edge', 4, 2);
    expect(snapPlanPoint({ rooms: [room], walls: [] }, { x: 2.1, y: 0.04 }, 0.1)).toEqual({ x: 2.1, y: 0 });
  });

  it('rejects invalid tolerance and non-finite candidate coordinates', () => {
    const project = createStarterProject();

    expect(() => snapPlanPoint(project, { x: 0, y: 0 }, -0.1)).toThrow(/non-negative/);
    expect(() => snapPlanPoint(project, { x: Number.NaN, y: 0 })).toThrow(/finite numbers/);
  });

  it('snaps furniture to a 10 cm grid in metres and feet only within tolerance', () => {
    expect(snapFurniturePosition({ x: 1.04, y: -0.04 }, 0.05, 'm')).toEqual({ x: 1, y: 0 });
    expect(snapFurniturePosition({ x: 1.08, y: 0.04 }, 0.01, 'm')).toEqual({ x: 1.08, y: 0.04 });
    expect(snapFurniturePosition({ x: 0.32, y: 0.32 }, 0.01, 'ft')).toEqual({ x: 0.32808399, y: 0.32808399 });
  });

  it('rejects invalid furniture snap parameters', () => {
    expect(() => snapFurniturePosition({ x: 0, y: 0 }, -0.1)).toThrow(/non-negative/);
    expect(() => snapFurniturePosition({ x: Number.POSITIVE_INFINITY, y: 0 }, 0.1)).toThrow(/finite/);
  });
});
