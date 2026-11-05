import { describe, expect, it } from 'vitest';
import { addFurniture, addRoomHole, createStarterProject, setFurnitureHidden } from './model';
import { canPlaceFurniture, furnitureFootprint } from './furniture-placement';
import type { FurnitureInput, Point, Wall } from './types';

const chair: FurnitureInput = {
  id: 'chair-1',
  assetId: 'generic-chair',
  name: 'Generic chair',
  position: { x: 5.2, y: 0.8 },
  elevation: 0,
  rotation: 0,
  width: 0.6,
  depth: 0.6,
  height: 0.9,
  color: '#506070',
  levelId: 'floor-ground',
  roomId: 'room-starter',
};

function testWall(start: Point, end: Point): Wall {
  return {
    id: 'wall-test-obstacle', start, end, thickness: 0.12, height: 2.4,
    materialId: 'material-neutral-wall', levelId: 'floor-ground',
  };
}

describe('furniture placement geometry', () => {
  it('calculates a rotated rectangular footprint around its center', () => {
    const footprint = furnitureFootprint({ ...chair, id: 'chair-1', rotationX: 0, rotationZ: 0, hidden: false, width: 1, depth: 0.4, rotation: 90 });
    expect(footprint.map((point) => [Number(point.x.toFixed(3)), Number(point.y.toFixed(3))])).toEqual([
      [5.4, 0.3], [5.4, 1.3], [5.0, 1.3], [5.0, 0.3],
    ]);
  });

  it('accepts a footprint wholly inside its assigned room and rejects a room-boundary escape', () => {
    const project = addFurniture(createStarterProject(), chair);
    expect(canPlaceFurniture(project, 'chair-1', { x: 5.2, y: 0.8 })).toBe(true);
    expect(canPlaceFurniture(project, 'chair-1', { x: 6.05, y: 0.8 })).toBe(false);
  });

  it('rejects a footprint that overlaps a floor opening', () => {
    const project = addFurniture(createStarterProject(), chair);
    const holed = addRoomHole(project, 'room-starter', [
      { x: 4.9, y: 0.5 }, { x: 5.5, y: 0.5 }, { x: 5.5, y: 1.1 }, { x: 4.9, y: 1.1 },
    ]);
    expect(canPlaceFurniture(holed, 'chair-1', { x: 5.2, y: 0.8 })).toBe(false);
  });

  it('rejects wall collisions, including the wall thickness around an interior partition', () => {
    const project = addFurniture(createStarterProject(), chair);
    const withPartition = { ...project, walls: [...project.walls, testWall({ x: 5.5, y: -0.2 }, { x: 5.5, y: 1.8 })] };
    expect(canPlaceFurniture(withPartition, 'chair-1', { x: 5.2, y: 0.8 })).toBe(false);
    const shortInteriorWall = { ...project, walls: [...project.walls, testWall({ x: 5.15, y: 0.75 }, { x: 5.25, y: 0.75 })] };
    expect(canPlaceFurniture(shortInteriorWall, 'chair-1', { x: 5.2, y: 0.8 })).toBe(false);
    expect(canPlaceFurniture(project, 'chair-1', { x: 4.35, y: 0.8 })).toBe(false);
  });

  it('rejects overlap with another visible object but ignores hidden objects', () => {
    const project = addFurniture(createStarterProject(), chair);
    const two = addFurniture(project, { ...chair, id: 'chair-2', position: { x: 5.4, y: 0.8 } });
    expect(canPlaceFurniture(two, 'chair-1', { x: 5.2, y: 0.8 })).toBe(false);
    const hidden = setFurnitureHidden(two, 'chair-2', true);
    expect(canPlaceFurniture(hidden, 'chair-1', { x: 5.2, y: 0.8 })).toBe(true);
  });
});
