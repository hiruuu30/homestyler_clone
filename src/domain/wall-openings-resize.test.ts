import { describe, expect, it } from 'vitest';
import { resizeOpeningFromEdge } from './wall-openings';

describe('resizeOpeningFromEdge', () => {
  const opening = { center: 1, width: 0.8 };
  const expectResize = (actual: { center: number; width: number }, center: number, width: number) => {
    expect(actual).toMatchObject({ center: expect.closeTo(center, 8), width: expect.closeTo(width, 8) });
  };

  it('keeps the opposite jamb fixed while resizing either end', () => {
    expectResize(resizeOpeningFromEdge(opening, 2, 'right', 0.2, 0.2), 1.1, 1);
    expectResize(resizeOpeningFromEdge(opening, 2, 'left', -0.2, 0.2), 0.9, 1);
  });

  it('clamps to the wall ends and enforces the minimum width', () => {
    expectResize(resizeOpeningFromEdge(opening, 2, 'right', 10, 0.2), 1.3, 1.4);
    expectResize(resizeOpeningFromEdge(opening, 2, 'left', 10, 0.2), 1.3, 0.2);
  });

  it('stops at the nearest horizontally blocking opening', () => {
    const adjacent = [{ start: 1.55, end: 1.9 }];
    expectResize(resizeOpeningFromEdge(opening, 2, 'right', 10, 0.2, adjacent), 1.075, 0.95);
    expectResize(resizeOpeningFromEdge(opening, 2, 'left', -10, 0.2, [{ start: 0.1, end: 0.45 }]), 0.925, 0.95);
  });

  it('rejects invalid geometry and a blocker that leaves no minimum span', () => {
    expect(() => resizeOpeningFromEdge(opening, 0, 'right', 0.1, 0.2)).toThrow(/wall length/);
    expect(() => resizeOpeningFromEdge(opening, 2, 'right', Number.NaN, 0.2)).toThrow(/delta must be finite/);
    expect(() => resizeOpeningFromEdge(opening, 2, 'right', 0.1, 0.2, [{ start: 0.7, end: 0.9 }])).toThrow(/no clear wall span/);
  });
});
