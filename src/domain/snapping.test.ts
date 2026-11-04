import { describe, expect, it } from 'vitest';
import { createStarterProject } from './model';
import { snapPlanPoint } from './snapping';

describe('plan endpoint snapping', () => {
  it('snaps to a nearby room corner or wall endpoint and leaves distant points unchanged', () => {
    const project = createStarterProject();

    expect(snapPlanPoint(project, { x: 4.24, y: -0.47 }, 0.1)).toEqual({ x: 4.2, y: -0.5 });
    const distant = { x: 7, y: 4 };
    expect(snapPlanPoint(project, distant, 0.1)).toBe(distant);
  });

  it('rejects invalid tolerance and non-finite candidate coordinates', () => {
    const project = createStarterProject();

    expect(() => snapPlanPoint(project, { x: 0, y: 0 }, -0.1)).toThrow(/non-negative/);
    expect(() => snapPlanPoint(project, { x: Number.NaN, y: 0 })).toThrow(/finite numbers/);
  });
});
