export type Point = Readonly<{
  x: number;
  y: number;
}>;

export type Units = 'm' | 'ft';

export type ToolMode = 'select' | 'room' | 'wall' | 'furniture';

export type Level = Readonly<{
  id: string;
  name: string;
  elevation: number;
  height: number;
}>;

export type Room = Readonly<{
  id: string;
  name: string;
  points: readonly Point[];
  floorMaterialId: string;
  ceilingVisible: boolean;
  levelId: string;
}>;

export type Wall = Readonly<{
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  materialId: string;
  levelId: string;
}>;

export type FurnitureInstance = Readonly<{
  id: string;
  assetId: string;
  name: string;
  position: Point;
  elevation: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  levelId: string;
  roomId?: string;
}>;

export type Material = Readonly<{
  id: string;
  name: string;
  category: string;
  color: string;
  textureUrl?: string;
}>;

export type DesignProject = Readonly<{
  id: string;
  name: string;
  units: Units;
  levels: readonly Level[];
  activeLevelId: string;
  rooms: readonly Room[];
  walls: readonly Wall[];
  furniture: readonly FurnitureInstance[];
  materials: readonly Material[];
  updatedAt: string;
}>;

export type FurnitureInput = Omit<FurnitureInstance, 'id'> & { id?: string };
