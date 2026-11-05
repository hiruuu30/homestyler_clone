import { describe, expect, it } from 'vitest';
import { addFurniture, convertProjectUnits, createStarterProject, normalizeProject } from './model';
import { frameProjectCamera, normalizeSavedCamera } from './camera';

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


describe('saved camera metadata', () => {
  const camera = { targetX: 4, targetY: 1.5, targetZ: -2, radius: 8, azimuth: 1.2, elevation: 0.8 };

  it('normalizes saved views while keeping old projects valid without camera metadata', () => {
    const project = createStarterProject();
    const imported = normalizeProject({ ...project, camera });

    expect(imported.camera).toEqual(camera);
    expect(normalizeProject(project).camera).toBeUndefined();
    expect(normalizeProject({ ...project, camera: { ...camera, radius: Number.NaN } }).camera).toBeUndefined();
  });

  it('bounds imported camera values and rejects non-finite coordinates', () => {
    expect(normalizeSavedCamera({ ...camera, targetX: Number.POSITIVE_INFINITY }, 'm')).toBeNull();
    expect(normalizeSavedCamera({ ...camera, targetX: 1e12, radius: 1e12, elevation: 8 }, 'm')).toMatchObject({
      targetX: 1_000_000,
      radius: 1_000,
      elevation: 1.45,
    });
  });

  it('scales camera target and zoom with project units and reverses the conversion', () => {
    const metric = normalizeProject({ ...createStarterProject(), camera });
    const feet = convertProjectUnits(metric, 'ft');
    const roundTrip = convertProjectUnits(feet, 'm');

    expect(feet.camera?.targetX).toBeCloseTo(camera.targetX / 0.3048);
    expect(feet.camera?.targetY).toBeCloseTo(camera.targetY / 0.3048);
    expect(feet.camera?.targetZ).toBeCloseTo(camera.targetZ / 0.3048);
    expect(feet.camera?.radius).toBeCloseTo(camera.radius / 0.3048);
    expect(roundTrip.camera?.targetX).toBeCloseTo(camera.targetX);
    expect(roundTrip.camera?.radius).toBeCloseTo(camera.radius);
    expect(roundTrip.camera?.azimuth).toBeCloseTo(camera.azimuth);
  });
});
