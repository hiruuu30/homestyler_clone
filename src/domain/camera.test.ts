import { describe, expect, it } from 'vitest';
import { addFurniture, createStarterProject } from './model';
import { frameProjectCamera } from './camera';

describe('project camera framing', () => {
  it('centers the reference comparison project and fits it closer than the old fixed radius', () => {
    const frame = frameProjectCamera(createStarterProject(), 1280 / 649);

    expect(frame.targetX).toBeCloseTo(4.2);
    expect(frame.targetY).toBeCloseTo(1.008);
    expect(frame.targetZ).toBeCloseTo(-1.45);
    expect(frame.radius).toBeGreaterThan(5);
    expect(frame.radius).toBeLessThan(17);
  });

  it('pulls back further on narrow viewports so the full floor plan remains visible', () => {
    const project = createStarterProject();
    const wide = frameProjectCamera(project, 1280 / 649);
    const narrow = frameProjectCamera(project, 0.6);

    expect(narrow.radius).toBeGreaterThan(wide.radius);
  });

  it('does not let hidden furniture change the Fit view frame', () => {
    const project = createStarterProject();
    const withHiddenObject = addFurniture(project, {
      assetId: 'placeholder-chair', name: 'Hidden Chair', position: { x: 100, y: 100 },
      rotation: 0, width: 1, depth: 1, height: 1, elevation: 0, color: '#777777',
      levelId: project.activeLevelId, hidden: true,
    });

    expect(frameProjectCamera(withHiddenObject, 1280 / 649)).toEqual(frameProjectCamera(project, 1280 / 649));
  });
});
