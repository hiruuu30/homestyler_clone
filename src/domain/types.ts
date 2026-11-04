export type Point = Readonly<{
  x: number;
  y: number;
}>;

export type Units = 'm' | 'ft';

export type ToolMode = 'select' | 'room' | 'polygon' | 'hole' | 'wall' | 'furniture';

export type Level = Readonly<{
  id: string;
  name: string;
  elevation: number;
  height: number;
}>;

export type FloorFinishPattern = 'none' | 'wood' | 'tile';

export type FloorFinishMapping = Readonly<{
  pattern: FloorFinishPattern;
  colorOverlay: boolean;
  rotation: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}>;

export type Room = Readonly<{
  id: string;
  name: string;
  points: readonly Point[];
  holes?: readonly (readonly Point[])[];
  floorMaterialId: string;
  ceilingVisible: boolean;
  floorFinish?: FloorFinishMapping;
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

export type WallOpeningKind = 'door' | 'window';

export type WallOpening = Readonly<{
  id: string;
  wallId: string;
  kind: WallOpeningKind;
  center: number;
  width: number;
  height: number;
  sillHeight: number;
}>;

export type PlanUnderlay = Readonly<{
  id: string;
  name: string;
  src: string;
  levelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
  opacity: number;
}>;

export type FurnitureInstance = Readonly<{
  id: string;
  assetId: string;
  name: string;
  position: Point;
  elevation: number;
  rotation: number;
  rotationX: number;
  rotationZ: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  hidden: boolean;
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
  wallOpenings: readonly WallOpening[];
  furniture: readonly FurnitureInstance[];
  underlays: readonly PlanUnderlay[];
  materials: readonly Material[];
  updatedAt: string;
}>;

export type FurnitureInput = Omit<FurnitureInstance, 'id' | 'rotationX' | 'rotationZ' | 'hidden'> & {
  id?: string;
  rotationX?: number;
  rotationZ?: number;
  hidden?: boolean;
};
