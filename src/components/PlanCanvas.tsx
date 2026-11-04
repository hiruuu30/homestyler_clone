import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DesignProject, FurnitureInstance, Point, ToolMode } from '../domain/types';

export type PlanCanvasProps = {
  project: DesignProject;
  tool: ToolMode;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onCreateRoom: (start: Point, end: Point) => void;
  onCreateWall: (start: Point, end: Point) => void;
  onMoveFurniture: (id: string, position: Point) => void;
};

type DragState =
  | { mode: 'create'; start: Point; current: Point }
  | { mode: 'move'; start: Point; current: Point; furnitureId: string; origin: Point };

const GRID_SIZE = 1;
const PADDING = 2;

function projectBounds(project: DesignProject): { minX: number; minY: number; width: number; height: number } {
  const points: Point[] = [];
  project.rooms.forEach((room) => points.push(...room.points));
  project.walls.forEach((wall) => points.push(wall.start, wall.end));
  project.furniture.forEach((item) => points.push(item.position));
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

export function PlanCanvas({ project, tool, selectedId, onSelect, onCreateRoom, onCreateWall, onMoveFurniture }: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const bounds = projectBounds(project);
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;

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
    if (tool !== 'room' && tool !== 'wall') {
      if (event.target === event.currentTarget) onSelect(null);
      return;
    }
    if (event.target !== event.currentTarget) return;
    const start = modelPoint(event.clientX, event.clientY);
    if (!start) return;
    capture(event);
    setDrag({ mode: 'create', start, current: start });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const current = modelPoint(event.clientX, event.clientY);
    if (current) setDrag({ ...drag, current });
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const end = modelPoint(event.clientX, event.clientY) ?? drag.current;
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
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
      {project.furniture.map((item) => {
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
