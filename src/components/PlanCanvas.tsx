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
  onCreatePolygonRoom: (points: readonly Point[]) => void;
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
  const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
  const padding = PADDING * unitsPerMetre;
  const points: Point[] = [];
  project.rooms.forEach((room) => points.push(...room.points));
  project.walls.forEach((wall) => points.push(wall.start, wall.end));
  project.furniture.filter((item) => !item.hidden).forEach((item) => points.push(item.position));
  project.underlays.forEach((item) => points.push({ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.height }));
  if (points.length === 0) return { minX: -padding, minY: -padding, width: 20 * unitsPerMetre, height: 14 * unitsPerMetre };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  return {
    minX,
    minY,
    width: Math.max(12 * unitsPerMetre, Math.max(...xs) - minX + padding),
    height: Math.max(9 * unitsPerMetre, Math.max(...ys) - minY + padding),
  };
}

function pointsAttribute(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PlanCanvas({ project, tool, selectedId, onSelect, onCreateRoom, onCreatePolygonRoom, onCreateWall, onMoveFurniture, fitRequest }: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [polygonCursor, setPolygonCursor] = useState<Point | null>(null);
  const [cameraBox, setCameraBox] = useState<CameraBox | null>(null);
  const bounds = projectBounds(project);
  const visibleBox = cameraBox ?? bounds;
  const viewBox = `${visibleBox.minX} ${visibleBox.minY} ${visibleBox.width} ${visibleBox.height}`;
  const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
  const gridSize = GRID_SIZE * unitsPerMetre;

  useEffect(() => setCameraBox(null), [fitRequest]);
  useEffect(() => {
    if (tool !== 'polygon') {
      setPolygonPoints([]);
      setPolygonCursor(null);
    }
  }, [tool]);

  const snapDistance = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
    if (!rect || !rect.width || !rect.height) return 0.2 * unitsPerMetre;
    const worldPerPixel = Math.max(visibleBox.width / rect.width, visibleBox.height / rect.height);
    return Math.max(0.1 * unitsPerMetre, Math.min(0.25 * unitsPerMetre, worldPerPixel * 12));
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
    if (tool === 'polygon') return;
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
    if (tool === 'polygon') {
      event.preventDefault();
      event.currentTarget.focus();
      const rawPoint = modelPoint(event.clientX, event.clientY);
      if (!rawPoint) return;
      const nextPoint = snapPoint(rawPoint);
      setPolygonCursor(nextPoint);
      if (polygonPoints.length >= 3 && distance(nextPoint, polygonPoints[0]) <= snapDistance()) {
        onCreatePolygonRoom(polygonPoints);
        setPolygonPoints([]);
        setPolygonCursor(null);
        return;
      }
      const lastPoint = polygonPoints.at(-1);
      if (!lastPoint || distance(lastPoint, nextPoint) > 0.05 * unitsPerMetre) {
        setPolygonPoints((items) => [...items, nextPoint]);
      }
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
    if (tool === 'polygon') {
      const point = modelPoint(event.clientX, event.clientY);
      if (point) setPolygonCursor(snapPoint(point));
    }
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
      if (distance(end, drag.start) > 0.05 * unitsPerMetre) {
        if (tool === 'room') onCreateRoom(drag.start, end);
        if (tool === 'wall') onCreateWall(drag.start, end);
      }
    } else if (distance(end, drag.start) > 0.05 * unitsPerMetre) {
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
    const nextWidth = Math.max(1.5 * unitsPerMetre, Math.min(200 * unitsPerMetre, origin.width * Math.exp(event.deltaY * 0.0012)));
    const nextHeight = origin.height * nextWidth / origin.width;
    const fractionX = (anchor.x - origin.minX) / origin.width;
    const fractionY = (anchor.y - origin.minY) / origin.height;
    setCameraBox({ minX: anchor.x - fractionX * nextWidth, minY: anchor.y - fractionY * nextHeight, width: nextWidth, height: nextHeight });
  };

  const previewPoints = drag?.mode === 'create' && tool === 'room'
    ? `${drag.start.x},${drag.start.y} ${drag.current.x},${drag.start.y} ${drag.current.x},${drag.current.y} ${drag.start.x},${drag.current.y}`
    : undefined;
  const polygonPreview = polygonCursor && polygonPoints.length
    ? [...polygonPoints, polygonPoints.length >= 3 && distance(polygonCursor, polygonPoints[0]) <= snapDistance() ? polygonPoints[0] : polygonCursor]
    : polygonPoints;

  return (
    <svg
      ref={svgRef}
      className="plan-canvas"
      viewBox={viewBox}
      role="img"
      aria-label="2D floor plan"
      tabIndex={tool === 'polygon' ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onWheel={handleWheel}
      onKeyDown={(event) => {
        if (tool !== 'polygon') return;
        if (event.key === 'Enter' && polygonPoints.length >= 3) {
          event.preventDefault();
          onCreatePolygonRoom(polygonPoints);
          setPolygonPoints([]);
          setPolygonCursor(null);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setPolygonPoints([]);
          setPolygonCursor(null);
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <defs>
        <pattern id="plan-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} className="plan-grid-line" fill="none" />
        </pattern>
      </defs>
      <rect className="plan-grid" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#plan-grid)" />
      {project.underlays.map((underlay) => <image key={underlay.id} href={underlay.src} x={underlay.x} y={underlay.y} width={underlay.width} height={underlay.height} opacity={underlay.opacity} preserveAspectRatio="none" pointerEvents="none" aria-label={`${underlay.name} plan underlay`} />)}
      {project.rooms.map((room) => (
        <polygon
          key={room.id}
          className={`plan-room${selectedId === room.id ? ' is-selected' : ''}`}
          points={pointsAttribute(room.points)}
          onPointerDown={(event) => { if (tool === 'polygon') return; event.stopPropagation(); onSelect(room.id); }}
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
          onPointerDown={(event) => { if (tool === 'polygon') return; event.stopPropagation(); onSelect(wall.id); }}
        />
      ))}
      {project.wallOpenings.map((opening) => {
        const wall = project.walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.hypot(dx, dy);
        const centerX = wall.start.x + (dx / length) * opening.center;
        const centerY = wall.start.y + (dy / length) * opening.center;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const half = opening.width / 2;
        const selected = selectedId === opening.id;
        return (
          <g
            key={opening.id}
            className={`plan-opening plan-opening-${opening.kind}${selected ? ' is-selected' : ''}`}
            transform={`translate(${centerX} ${centerY}) rotate(${angle})`}
            role="button"
            aria-label={`${opening.kind} opening, ${opening.width.toFixed(2)} ${project.units} wide`}
            onPointerDown={(event) => { if (tool === 'polygon') return; event.stopPropagation(); onSelect(opening.id); }}
          >
            <rect x={-half} y={-wall.thickness / 2 - 0.025} width={opening.width} height={wall.thickness + 0.05} fill="#fff" />
            {opening.kind === 'window'
              ? <><line x1={-half} y1={-0.035} x2={half} y2={-0.035} /><line x1={-half} y1={0.035} x2={half} y2={0.035} /></>
              : <><line x1={-half} y1={0} x2={-half} y2={-Math.min(opening.width * 0.92, 1.05)} /><path d={`M ${-half} ${-Math.min(opening.width * 0.92, 1.05)} A ${Math.min(opening.width, 1.05)} ${Math.min(opening.width, 1.05)} 0 0 1 ${half} 0`} fill="none" /></>}
            <line className="opening-jamb" x1={-half} y1={-wall.thickness / 2 - 0.04} x2={-half} y2={wall.thickness / 2 + 0.04} />
            <line className="opening-jamb" x1={half} y1={-wall.thickness / 2 - 0.04} x2={half} y2={wall.thickness / 2 + 0.04} />
          </g>
        );
      })}
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
      {polygonPreview.length > 1 && <polyline className="plan-polygon-preview" points={pointsAttribute(polygonPreview)} />}
      {polygonPoints.map((point, index) => <circle key={`polygon-point-${index}`} className="plan-polygon-vertex" cx={point.x} cy={point.y} r={0.07 * unitsPerMetre} />)}
      {drag?.mode === 'create' && tool === 'wall' && <line className="plan-preview" x1={drag.start.x} y1={drag.start.y} x2={drag.current.x} y2={drag.current.y} />}
    </svg>
  );
}

export default PlanCanvas;
