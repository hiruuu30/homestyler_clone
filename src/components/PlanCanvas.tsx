import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { snapPlanPoint } from '../domain/snapping';
import type { DesignProject, FurnitureInstance, Point, ToolMode } from '../domain/types';

export type PlanCanvasProps = {
  project: DesignProject;
  tool: ToolMode;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onCreateRoom: (start: Point, end: Point) => void;
  onCreateWall: (start: Point, end: Point) => void;
  onMoveFurniture: (id: string, position: Point) => void;
  fitRequest: number;
};

type CameraBox = { minX: number; minY: number; width: number; height: number };

type DragState =
  | { mode: 'create'; start: Point; current: Point }
  | { mode: 'move'; start: Point; current: Point; furnitureId: string; origin: Point }
  | { mode: 'pan'; pointerStart: Point; origin: CameraBox };

const GRID_SIZE = 1;
const PADDING = 2;

function projectBounds(project: DesignProject): { minX: number; minY: number; width: number; height: number } {
  const points: Point[] = [];
  project.rooms.forEach((room) => points.push(...room.points));
  project.walls.forEach((wall) => points.push(wall.start, wall.end));
  project.furniture.filter((item) => !item.hidden).forEach((item) => points.push(item.position));
  if (points.length === 0) return { minX: -PADDING, minY: -PADDING, width: 20, height: 14 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  return {
    minX,
    minY,
    width: Math.max(12, Math.max(...xs) - minX + PADDING),
    height: Math.max(9, Math.max(...ys) - minY + PADDING),
  };
}

function pointsAttribute(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PlanCanvas({ project, tool, selectedId, onSelect, onCreateRoom, onCreateWall, onMoveFurniture, fitRequest }: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cameraBox, setCameraBox] = useState<CameraBox | null>(null);
  const bounds = projectBounds(project);
  const visibleBox = cameraBox ?? bounds;
  const viewBox = `${visibleBox.minX} ${visibleBox.minY} ${visibleBox.width} ${visibleBox.height}`;

  useEffect(() => setCameraBox(null), [fitRequest]);

  const snapDistance = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return 0.2;
    const worldPerPixel = Math.max(visibleBox.width / rect.width, visibleBox.height / rect.height);
    return Math.max(0.1, Math.min(0.25, worldPerPixel * 12));
  };
  const snapPoint = (point: Point) => snapPlanPoint(project, point, snapDistance());

  const modelPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const capture = (event: ReactPointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (svg) svg.setPointerCapture(event.pointerId);
  };

  const beginFurnitureDrag = (event: ReactPointerEvent<SVGGElement>, item: FurnitureInstance) => {
    event.stopPropagation();
    onSelect(item.id);
    if (tool !== 'select') return;
    const start = modelPoint(event.clientX, event.clientY);
    if (!start) return;
    capture(event);
    setDrag({ mode: 'move', start, current: start, furnitureId: item.id, origin: item.position });
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || event.button === 2 || (event.shiftKey && event.button === 0)) {
      event.preventDefault();
      capture(event);
      setDrag({ mode: 'pan', pointerStart: { x: event.clientX, y: event.clientY }, origin: visibleBox });
      return;
    }
    const backgroundTarget = event.target === event.currentTarget
      || (event.target instanceof SVGElement && event.target.classList.contains('plan-grid'));
    if (tool !== 'room' && tool !== 'wall') {
      if (backgroundTarget) onSelect(null);
      return;
    }
    if (!backgroundTarget) return;
    const rawStart = modelPoint(event.clientX, event.clientY);
    if (!rawStart) return;
    const start = snapPoint(rawStart);
    capture(event);
    setDrag({ mode: 'create', start, current: start });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.mode === 'pan') {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      setCameraBox({
        ...drag.origin,
        minX: drag.origin.minX - (event.clientX - drag.pointerStart.x) * drag.origin.width / rect.width,
        minY: drag.origin.minY - (event.clientY - drag.pointerStart.y) * drag.origin.height / rect.height,
      });
      return;
    }
    const point = modelPoint(event.clientX, event.clientY);
    if (point) setDrag({ ...drag, current: drag.mode === 'create' ? snapPoint(point) : point });
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.mode === 'pan') {
      setDrag(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const point = modelPoint(event.clientX, event.clientY) ?? drag.current;
    const end = drag.mode === 'create' ? snapPoint(point) : point;
    if (drag.mode === 'create') {
      if (distance(end, drag.start) > 0.05) {
        if (tool === 'room') onCreateRoom(drag.start, end);
        if (tool === 'wall') onCreateWall(drag.start, end);
      }
    } else if (distance(end, drag.start) > 0.05) {
      onMoveFurniture(drag.furnitureId, {
        x: drag.origin.x + end.x - drag.start.x,
        y: drag.origin.y + end.y - drag.start.y,
      });
    }
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cancelDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag?.mode === 'pan') setCameraBox(drag.origin);
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const anchor = modelPoint(event.clientX, event.clientY);
    if (!anchor) return;
    const origin = cameraBox ?? bounds;
    const nextWidth = Math.max(1.5, Math.min(200, origin.width * Math.exp(event.deltaY * 0.0012)));
    const nextHeight = origin.height * nextWidth / origin.width;
    const fractionX = (anchor.x - origin.minX) / origin.width;
    const fractionY = (anchor.y - origin.minY) / origin.height;
    setCameraBox({ minX: anchor.x - fractionX * nextWidth, minY: anchor.y - fractionY * nextHeight, width: nextWidth, height: nextHeight });
  };

  const previewPoints = drag?.mode === 'create' && tool === 'room'
    ? `${drag.start.x},${drag.start.y} ${drag.current.x},${drag.start.y} ${drag.current.x},${drag.current.y} ${drag.start.x},${drag.current.y}`
    : undefined;

  return (
    <svg
      ref={svgRef}
      className="plan-canvas"
      viewBox={viewBox}
      role="img"
      aria-label="2D floor plan"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <defs>
        <pattern id="plan-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} className="plan-grid-line" fill="none" />
        </pattern>
      </defs>
      <rect className="plan-grid" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#plan-grid)" />
      {project.rooms.map((room) => (
        <polygon
          key={room.id}
          className={`plan-room${selectedId === room.id ? ' is-selected' : ''}`}
          points={pointsAttribute(room.points)}
          onPointerDown={(event) => { event.stopPropagation(); onSelect(room.id); }}
        />
      ))}
      {project.walls.map((wall) => (
        <line
          key={wall.id}
          className={`plan-wall${selectedId === wall.id ? ' is-selected' : ''}`}
          x1={wall.start.x}
          y1={wall.start.y}
          x2={wall.end.x}
          y2={wall.end.y}
          strokeWidth={wall.thickness}
          onPointerDown={(event) => { event.stopPropagation(); onSelect(wall.id); }}
        />
      ))}
      {project.furniture.filter((item) => !item.hidden).map((item) => {
        const moving = drag?.mode === 'move' && drag.furnitureId === item.id ? drag : null;
        const x = item.position.x + (moving ? moving.current.x - moving.start.x : 0);
        const y = item.position.y + (moving ? moving.current.y - moving.start.y : 0);
        return (
          <g
            key={item.id}
            className={`plan-furniture${selectedId === item.id ? ' is-selected' : ''}`}
            aria-label={`${item.name}, furniture object`}
            transform={`translate(${x} ${y}) rotate(${item.rotation})`}
            onPointerDown={(event) => beginFurnitureDrag(event, item)}
          >
            <rect x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} rx={0.08} fill={item.color || '#b9a58e'} />
            <title>{item.name}</title>
          </g>
        );
      })}
      {previewPoints && <polygon className="plan-preview" points={previewPoints} />}
      {drag?.mode === 'create' && tool === 'wall' && <line className="plan-preview" x1={drag.start.x} y1={drag.start.y} x2={drag.current.x} y2={drag.current.y} />}
    </svg>
  );
}

export default PlanCanvas;
