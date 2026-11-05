import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { snapPlanPoint } from '../domain/snapping';
import type { DesignProject, FurnitureInstance, Point, ToolMode } from '../domain/types';
import { floorFinishForRoom, floorPatternSpec } from '../domain/floor-finish';
import { resizeOpeningFromEdge } from '../domain/wall-openings';

export type PlanCanvasProps = {
  project: DesignProject;
  tool: ToolMode;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onCreateRoom: (start: Point, end: Point) => void;
  onCreatePolygonRoom: (points: readonly Point[]) => void;
  onCreateRoomHole: (points: readonly Point[]) => void;
  onCreateWall: (start: Point, end: Point) => void;
  onMoveFurniture: (id: string, position: Point) => void;
  onMoveOpening: (id: string, center: number) => void;
  onResizeOpening: (id: string, center: number, width: number) => void;
  fitRequest: number;
};

type CameraBox = { minX: number; minY: number; width: number; height: number };

type DragState =
  | { mode: 'create'; start: Point; current: Point }
  | { mode: 'move'; start: Point; current: Point; furnitureId: string; origin: Point }
  | { mode: 'move-opening'; start: Point; current: Point; openingId: string; originCenter: number; width: number; wallStart: Point; wallEnd: Point }
  | { mode: 'resize-opening'; start: Point; current: Point; openingId: string; originCenter: number; originWidth: number; wallStart: Point; wallEnd: Point; wallLength: number; side: 'left' | 'right'; minimumWidth: number; blockers: readonly { start: number; end: number }[] }
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

function roomPath(room: DesignProject['rooms'][number]): string {
  return [room.points, ...(room.holes ?? [])]
    .map((points) => `M ${pointsAttribute(points)} Z`)
    .join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function draggedOpeningCenter(drag: Extract<DragState, { mode: 'move-opening' }>, point: Point): number {
  const dx = drag.wallEnd.x - drag.wallStart.x;
  const dy = drag.wallEnd.y - drag.wallStart.y;
  const length = Math.hypot(dx, dy);
  const projectedDelta = ((point.x - drag.start.x) * dx + (point.y - drag.start.y) * dy) / length;
  return Math.max(drag.width / 2, Math.min(length - drag.width / 2, drag.originCenter + projectedDelta));
}

function resizePreview(drag: Extract<DragState, { mode: 'resize-opening' }>, point: Point): Readonly<{ center: number; width: number }> {
  const dx = drag.wallEnd.x - drag.wallStart.x;
  const dy = drag.wallEnd.y - drag.wallStart.y;
  const projectedDelta = ((point.x - drag.start.x) * dx + (point.y - drag.start.y) * dy) / drag.wallLength;
  return resizeOpeningFromEdge(
    { center: drag.originCenter, width: drag.originWidth },
    drag.wallLength,
    drag.side,
    projectedDelta,
    drag.minimumWidth,
    drag.blockers,
  );
}

export function PlanCanvas({ project, tool, selectedId, onSelect, onCreateRoom, onCreatePolygonRoom, onCreateRoomHole, onCreateWall, onMoveFurniture, onMoveOpening, onResizeOpening, fitRequest }: PlanCanvasProps) {
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
  const polygonTool = tool === 'polygon' || tool === 'hole';
  const roomFill = (room: DesignProject['rooms'][number]) => {
    const color = project.materials.find((material) => material.id === room.floorMaterialId)?.color ?? '#c9b8a0';
    const spec = floorPatternSpec(room.id, floorFinishForRoom(room), color, project.units);
    return spec ? `url(#${spec.id})` : color;
  };

  useEffect(() => setCameraBox(null), [fitRequest]);
  useEffect(() => {
    setPolygonPoints([]);
    setPolygonCursor(null);
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
    if (polygonTool) return;
    event.stopPropagation();
    onSelect(item.id);
    if (tool !== 'select') return;
    const start = modelPoint(event.clientX, event.clientY);
    if (!start) return;
    capture(event);
    setDrag({ mode: 'move', start, current: start, furnitureId: item.id, origin: item.position });
  };

  const beginOpeningDrag = (event: ReactPointerEvent<SVGGElement>, opening: DesignProject['wallOpenings'][number], wall: DesignProject['walls'][number]) => {
    if (polygonTool) return;
    event.stopPropagation();
    onSelect(opening.id);
    if (tool !== 'select') return;
    const start = modelPoint(event.clientX, event.clientY);
    if (!start) return;
    capture(event);
    setDrag({
      mode: 'move-opening',
      start,
      current: start,
      openingId: opening.id,
      originCenter: opening.center,
      width: opening.width,
      wallStart: wall.start,
      wallEnd: wall.end,
    });
  };

  const openingBlockers = (opening: DesignProject['wallOpenings'][number]) => project.wallOpenings
    .filter((other) => other.wallId === opening.wallId && other.id !== opening.id)
    .filter((other) => opening.sillHeight < other.sillHeight + other.height - 1e-9
      && opening.sillHeight + opening.height > other.sillHeight + 1e-9)
    .map((other) => ({ start: other.center - other.width / 2, end: other.center + other.width / 2 }));

  const beginOpeningResize = (
    event: ReactPointerEvent<SVGElement>,
    opening: DesignProject['wallOpenings'][number],
    wall: DesignProject['walls'][number],
    side: 'left' | 'right',
  ) => {
    event.stopPropagation();
    onSelect(opening.id);
    if (tool !== 'select') return;
    const start = modelPoint(event.clientX, event.clientY);
    if (!start) return;
    const wallLength = distance(wall.start, wall.end);
    const minimumWidth = Math.min(0.2 * unitsPerMetre, opening.width);
    capture(event);
    setDrag({ mode: 'resize-opening', start, current: start, openingId: opening.id, originCenter: opening.center,
      originWidth: opening.width, wallStart: wall.start, wallEnd: wall.end, wallLength, side, minimumWidth,
      blockers: openingBlockers(opening) });
  };

  const keyboardResizeOpening = (
    event: ReactKeyboardEvent<SVGRectElement>,
    opening: DesignProject['wallOpenings'][number],
    wall: DesignProject['walls'][number],
    side: 'left' | 'right',
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const step = 0.05 * unitsPerMetre;
    const delta = event.key === 'ArrowRight' ? (side === 'right' ? step : -step) : (side === 'left' ? -step : step);
    const resized = resizeOpeningFromEdge({ center: opening.center, width: opening.width }, distance(wall.start, wall.end), side,
      delta, Math.min(0.2 * unitsPerMetre, opening.width), openingBlockers(opening));
    onResizeOpening(opening.id, resized.center, resized.width);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || event.button === 2 || (event.shiftKey && event.button === 0)) {
      event.preventDefault();
      capture(event);
      setDrag({ mode: 'pan', pointerStart: { x: event.clientX, y: event.clientY }, origin: visibleBox });
      return;
    }
    if (polygonTool) {
      event.preventDefault();
      event.currentTarget.focus();
      const rawPoint = modelPoint(event.clientX, event.clientY);
      if (!rawPoint) return;
      const nextPoint = snapPoint(rawPoint);
      setPolygonCursor(nextPoint);
      if (polygonPoints.length >= 3 && distance(nextPoint, polygonPoints[0]) <= snapDistance()) {
        if (tool === 'hole') onCreateRoomHole(polygonPoints);
        else onCreatePolygonRoom(polygonPoints);
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
    const edgeTarget = tool === 'wall' && event.target instanceof SVGElement
      && (event.target.classList.contains('plan-wall') || event.target.classList.contains('plan-room'));
    const backgroundTarget = event.target === event.currentTarget
      || (event.target instanceof SVGElement && event.target.classList.contains('plan-grid'))
      || edgeTarget;
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
    if (polygonTool) {
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
    } else if (drag.mode === 'move') {
      if (distance(end, drag.start) > 0.05 * unitsPerMetre) {
        onMoveFurniture(drag.furnitureId, {
          x: drag.origin.x + end.x - drag.start.x,
          y: drag.origin.y + end.y - drag.start.y,
        });
      }
    } else if (drag.mode === 'move-opening') {
      const center = draggedOpeningCenter(drag, end);
      if (Math.abs(center - drag.originCenter) > 0.05 * unitsPerMetre) onMoveOpening(drag.openingId, center);
    } else if (drag.mode === 'resize-opening') {
      const resized = resizePreview(drag, end);
      if (Math.abs(resized.center - drag.originCenter) > 0.025 * unitsPerMetre
        || Math.abs(resized.width - drag.originWidth) > 0.05 * unitsPerMetre) {
        onResizeOpening(drag.openingId, resized.center, resized.width);
      }
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
      tabIndex={polygonTool ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onWheel={handleWheel}
      onKeyDown={(event) => {
        if (!polygonTool) return;
        if (event.key === 'Enter' && polygonPoints.length >= 3) {
          event.preventDefault();
          if (tool === 'hole') onCreateRoomHole(polygonPoints);
          else onCreatePolygonRoom(polygonPoints);
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
        {project.rooms.map((room) => {
          const mapping = floorFinishForRoom(room);
          const color = project.materials.find((material) => material.id === room.floorMaterialId)?.color ?? '#c9b8a0';
          const spec = floorPatternSpec(room.id, mapping, color, project.units);
          if (!spec) return null;
          const halfHeight = spec.height / 2;
          const groovePath = spec.pattern === 'wood'
            ? `M 0 0 H ${spec.width} M 0 ${halfHeight} H ${spec.width} M 0 ${spec.height} H ${spec.width} M ${spec.width / 2} 0 V ${halfHeight} M 0 ${halfHeight} V ${spec.height} M ${spec.width} ${halfHeight} V ${spec.height}`
            : `M 0 0 H ${spec.width} V ${spec.height} H 0 Z`;
          const highlightPath = spec.pattern === 'wood'
            ? `M 0 ${spec.strokeWidth} H ${spec.width} M 0 ${halfHeight + spec.strokeWidth} H ${spec.width}`
            : `M ${spec.strokeWidth} ${spec.strokeWidth} H ${spec.width - spec.strokeWidth} V ${spec.height - spec.strokeWidth} H ${spec.strokeWidth} Z`;
          return <pattern key={spec.id} id={spec.id} patternUnits="userSpaceOnUse" width={spec.width} height={spec.height} patternTransform={spec.transform}>
            <rect width={spec.width} height={spec.height} fill={spec.baseColor} />
            <path d={groovePath} fill="none" stroke={spec.grooveColor} strokeWidth={spec.strokeWidth} />
            <path d={highlightPath} fill="none" stroke={spec.highlightColor} strokeWidth={spec.strokeWidth / 2} />
          </pattern>;
        })}
      </defs>
      <rect className="plan-grid" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#plan-grid)" />
      {project.underlays.map((underlay) => <image key={underlay.id} href={underlay.src} x={underlay.x} y={underlay.y} width={underlay.width} height={underlay.height} opacity={underlay.opacity} preserveAspectRatio="none" pointerEvents="none" aria-label={`${underlay.name} plan underlay`} />)}
      {project.rooms.map((room) => (
        <path
          key={room.id}
          className={`plan-room${selectedId === room.id ? ' is-selected' : ''}`}
          d={roomPath(room)}
          fill={roomFill(room)}
          fillRule="evenodd"
          onPointerDown={(event) => { if (polygonTool || tool === 'wall') return; event.stopPropagation(); onSelect(room.id); }}
        />
      ))}
      {project.walls.map((wall) => (
        <g key={wall.id}>
          <line
            className={`plan-wall${selectedId === wall.id ? ' is-selected' : ''}`}
            data-wall-id={wall.id}
            x1={wall.start.x}
            y1={wall.start.y}
            x2={wall.end.x}
            y2={wall.end.y}
            strokeWidth={wall.thickness}
            onPointerDown={(event) => { if (polygonTool || tool === 'wall') return; event.stopPropagation(); onSelect(wall.id); }}
          />
          <line
            data-wall-id={wall.id}
            data-wall-material-id={wall.materialId}
            x1={wall.start.x}
            y1={wall.start.y}
            x2={wall.end.x}
            y2={wall.end.y}
            stroke={project.materials.find((material) => material.id === wall.materialId)?.color ?? '#d2d0ca'}
            strokeWidth={Math.max(wall.thickness * 0.68, 0.01)}
            strokeLinecap="square"
            pointerEvents="none"
          />
        </g>
      ))}
      {project.wallOpenings.map((opening) => {
        const wall = project.walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.hypot(dx, dy);
        const openingDrag = drag?.mode === 'move-opening' && drag.openingId === opening.id ? drag : null;
        const openingResize = drag?.mode === 'resize-opening' && drag.openingId === opening.id ? drag : null;
        const resized = openingResize ? resizePreview(openingResize, openingResize.current) : { center: opening.center, width: opening.width };
        const center = openingDrag ? draggedOpeningCenter(openingDrag, openingDrag.current) : resized.center;
        const centerX = wall.start.x + (dx / length) * center;
        const centerY = wall.start.y + (dy / length) * center;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const half = resized.width / 2;
        const selected = selectedId === opening.id;
        return (
          <g
            key={opening.id}
            className={`plan-opening plan-opening-${opening.kind}${selected ? ' is-selected' : ''}`}
            transform={`translate(${centerX} ${centerY}) rotate(${angle})`}
            data-opening-id={opening.id}
            role="button"
            aria-label={`${opening.kind} opening, ${resized.width.toFixed(2)} ${project.units} wide; drag to move along wall`}
            onPointerDown={(event) => beginOpeningDrag(event, opening, wall)}
          >
            <rect x={-half} y={-wall.thickness / 2 - 0.025} width={resized.width} height={wall.thickness + 0.05} fill="#fff" />
            {opening.kind === 'window'
              ? <><line x1={-half} y1={-0.035} x2={half} y2={-0.035} /><line x1={-half} y1={0.035} x2={half} y2={0.035} /></>
              : <><line x1={-half} y1={0} x2={-half} y2={-Math.min(resized.width * 0.92, 1.05)} /><path d={`M ${-half} ${-Math.min(resized.width * 0.92, 1.05)} A ${Math.min(resized.width, 1.05)} ${Math.min(resized.width, 1.05)} 0 0 1 ${half} 0`} fill="none" /></>}
            <line className="opening-jamb" x1={-half} y1={-wall.thickness / 2 - 0.04} x2={-half} y2={wall.thickness / 2 + 0.04} />
            <line className="opening-jamb" x1={half} y1={-wall.thickness / 2 - 0.04} x2={half} y2={wall.thickness / 2 + 0.04} />
            {selected && <>
              {(['left', 'right'] as const).map((side) => <rect key={side} className="plan-opening-resize-handle"
                data-opening-resize-handle={side} x={(side === 'left' ? -half : half) - 0.07} y={-0.07} width={0.14} height={0.14} rx={0.025}
                role="button" tabIndex={tool === 'select' ? 0 : -1} aria-label={`Resize ${opening.kind} opening from ${side} edge`}
                onPointerDown={(event) => beginOpeningResize(event, opening, wall, side)}
                onKeyDown={(event) => keyboardResizeOpening(event, opening, wall, side)} />)}
            </>}
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
            data-furniture-id={item.id}
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
