import { roomArea } from '../domain/model';
import type { DesignProject, FurnitureInstance, Point, Room, Wall } from '../domain/types';

type Bounds = { minX: number; minY: number; width: number; height: number };

function xml(value: string): string {
  const validCharacters = Array.from(value).filter((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
  }).join('');
  return validCharacters.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function csv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function number(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function safeFileName(value: string): string {
  const base = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').toLowerCase() || 'roomlab-project';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base) ? `roomlab-${base}` : base;
}

function boundsFor(points: readonly Point[]): Bounds {
  if (!points.length) return { minX: 0, minY: 0, width: 8, height: 6 };
  const xs = points.map((item) => item.x);
  const ys = points.map((item) => item.y);
  const pad = 0.5;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    minX,
    minY,
    width: Math.max(1, Math.max(...xs) - Math.min(...xs) + pad * 2),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys) + pad * 2),
  };
}

function roomCenter(room: Room): Point {
  const centroid = (points: readonly Point[]) => {
    let areaTwice = 0;
    let x = 0;
    let y = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const cross = current.x * next.y - next.x * current.y;
      areaTwice += cross;
      x += (current.x + next.x) * cross;
      y += (current.y + next.y) * cross;
    }
    if (Math.abs(areaTwice) < 1e-12) {
      return { point: points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 }), area: 0 };
    }
    return { point: { x: x / (3 * areaTwice), y: y / (3 * areaTwice) }, area: Math.abs(areaTwice) / 2 };
  };
  const outer = centroid(room.points);
  const holes = (room.holes ?? []).map(centroid);
  const remainingArea = outer.area - holes.reduce((sum, ring) => sum + ring.area, 0);
  const weighted = remainingArea > 0 ? {
    x: (outer.point.x * outer.area - holes.reduce((sum, ring) => sum + ring.point.x * ring.area, 0)) / remainingArea,
    y: (outer.point.y * outer.area - holes.reduce((sum, ring) => sum + ring.point.y * ring.area, 0)) / remainingArea,
  } : outer.point;
  const inside = (value: Point, polygon: readonly Point[]) => {
    let result = false;
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      if ((a.y > value.y) !== (b.y > value.y) && value.x < (b.x - a.x) * (value.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
    return result;
  };
  const inFloor = (value: Point) => inside(value, room.points) && !(room.holes ?? []).some((hole) => inside(value, hole));
  if (inFloor(weighted)) return weighted;
  const xs = room.points.map((point) => point.x);
  const ys = room.points.map((point) => point.y);
  let nearest: Point | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let row = 1; row < 32; row += 1) {
    for (let column = 1; column < 32; column += 1) {
      const candidate = {
        x: Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * column / 32,
        y: Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * row / 32,
      };
      if (!inFloor(candidate)) continue;
      const distance = Math.hypot(candidate.x - weighted.x, candidate.y - weighted.y);
      if (distance < nearestDistance) { nearest = candidate; nearestDistance = distance; }
    }
  }
  return nearest ?? room.points[0];
}

function pointsText(points: readonly Point[]): string {
  return points.map((point) => `${number(point.x)},${number(point.y)}`).join(' ');
}

function roomPath(room: Room): string {
  return [room.points, ...(room.holes ?? [])]
    .map((points) => `M ${pointsText(points)} Z`)
    .join(' ');
}

function materialColor(project: DesignProject, materialId: string, fallback: string): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(materialId)
    ? materialId
    : project.materials.find((item) => item.id === materialId)?.color;
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function furnitureCorners(item: FurnitureInstance): Point[] {
  const angle = item.rotation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    [-item.width / 2, -item.depth / 2], [item.width / 2, -item.depth / 2],
    [item.width / 2, item.depth / 2], [-item.width / 2, item.depth / 2],
  ].map(([x, y]) => ({
    x: item.position.x + x * cosine - y * sine,
    y: item.position.y + x * sine + y * cosine,
  }));
}

function selectedFloor(project: DesignProject, levelId: string) {
  const factor = project.units === 'ft' ? 0.3048 : 1;
  const scalePoint = (point: Point): Point => ({ x: point.x * factor, y: point.y * factor });
  const rooms = project.rooms.filter((room) => room.levelId === levelId).map((room) => ({
    ...room,
    points: room.points.map(scalePoint),
    ...(room.holes === undefined ? {} : { holes: room.holes.map((hole) => hole.map(scalePoint)) }),
  }));
  const walls = project.walls.filter((wall) => wall.levelId === levelId).map((wall) => ({
    ...wall,
    start: scalePoint(wall.start),
    end: scalePoint(wall.end),
    thickness: wall.thickness * factor,
    height: wall.height * factor,
  }));
  const wallIds = new Set(walls.map((wall) => wall.id));
  const openings = project.wallOpenings.filter((opening) => wallIds.has(opening.wallId)).map((opening) => ({
    ...opening,
    center: opening.center * factor,
    width: opening.width * factor,
    height: opening.height * factor,
    sillHeight: opening.sillHeight * factor,
  }));
  const furniture = project.furniture.filter((item) => item.levelId === levelId && !item.hidden).map((item) => ({
    ...item,
    position: scalePoint(item.position),
    width: item.width * factor,
    depth: item.depth * factor,
    height: item.height * factor,
    elevation: item.elevation * factor,
  }));
  const points = [
    ...rooms.flatMap((room) => room.points),
    ...walls.flatMap((wall) => [wall.start, wall.end]),
    ...furniture.flatMap(furnitureCorners),
  ];
  return { rooms, walls, openings, furniture, bounds: boundsFor(points) };
}

/** Generate a dependency-free, editable SVG plan for the requested floor (active floor by default). */
export function exportPlanSvg(project: DesignProject, levelId = project.activeLevelId): string {
  const level = project.levels.find((item) => item.id === levelId);
  if (!level) throw new RangeError(`unknown level: ${levelId}`);
  const { rooms, walls, openings, furniture, bounds } = selectedFloor(project, levelId);
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(bounds.width * 1000)}mm" height="${Math.ceil(bounds.height * 1000)}mm" viewBox="${number(bounds.minX)} ${number(bounds.minY)} ${number(bounds.width)} ${number(bounds.height)}" role="img" aria-labelledby="title description" data-units="m">`,
    `<title id="title">${xml(project.name)} — ${xml(level.name)} floor plan</title>`,
    `<desc id="description">Editable vector floor plan. Coordinates and dimensions are in metres.</desc>`,
    `<rect x="${number(bounds.minX)}" y="${number(bounds.minY)}" width="${number(bounds.width)}" height="${number(bounds.height)}" fill="#ffffff"/>`,
    '<g class="rooms" stroke="#737981" stroke-width="0.025">',
  ];
  for (const room of rooms) {
    const fill = materialColor(project, room.floorMaterialId, '#eee9df');
    parts.push(`<path id="${xml(room.id)}" data-kind="room" data-area-m2="${number(roomArea(room))}" d="${roomPath(room)}" fill="${fill}" fill-opacity="0.62" fill-rule="evenodd"/>`);
  }
  parts.push('</g>', '<g class="walls" fill="none" stroke="#50565e" stroke-linecap="square" stroke-linejoin="round">');
  for (const wall of walls) {
    parts.push(`<line id="${xml(wall.id)}" data-kind="wall" data-length-m="${number(wallLength(wall))}" x1="${number(wall.start.x)}" y1="${number(wall.start.y)}" x2="${number(wall.end.x)}" y2="${number(wall.end.y)}" stroke-width="${number(wall.thickness)}"/>`);
  }
  parts.push('</g>', '<g class="openings" fill="none" stroke="#3c758c" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.035">');
  for (const opening of openings) {
    const wall = walls.find((item) => item.id === opening.wallId);
    if (!wall) continue;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = wallLength(wall);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const x = wall.start.x + dx / length * opening.center;
    const y = wall.start.y + dy / length * opening.center;
    const half = opening.width / 2;
    parts.push(`<g id="${xml(opening.id)}" data-kind="${opening.kind}" data-width-m="${number(opening.width)}" transform="translate(${number(x)} ${number(y)}) rotate(${number(angle)})">`);
    parts.push(`<rect x="${number(-half)}" y="${number(-wall.thickness / 2 - 0.04)}" width="${number(opening.width)}" height="${number(wall.thickness + 0.08)}" fill="#ffffff" stroke="none"/>`);
    if (opening.kind === 'window') {
      parts.push(`<line x1="${number(-half)}" y1="-0.035" x2="${number(half)}" y2="-0.035"/><line x1="${number(-half)}" y1="0.035" x2="${number(half)}" y2="0.035"/>`);
    } else {
      const swing = Math.min(opening.width * 0.92, 1.05);
      parts.push(`<line x1="${number(-half)}" y1="0" x2="${number(-half)}" y2="${number(-swing)}"/><path d="M ${number(-half)} ${number(-swing)} A ${number(swing)} ${number(swing)} 0 0 1 ${number(half)} 0"/>`);
    }
    parts.push(`<line x1="${number(-half)}" y1="${number(-wall.thickness / 2 - 0.05)}" x2="${number(-half)}" y2="${number(wall.thickness / 2 + 0.05)}" stroke="#ffffff" stroke-width="0.07"/><line x1="${number(half)}" y1="${number(-wall.thickness / 2 - 0.05)}" x2="${number(half)}" y2="${number(wall.thickness / 2 + 0.05)}" stroke="#ffffff" stroke-width="0.07"/>`);
    parts.push('</g>');
  }
  parts.push('</g>', '<g class="furniture" stroke="#665746" stroke-width="0.025">');
  for (const item of furniture) {
    parts.push(`<rect id="${xml(item.id)}" data-kind="furniture" data-name="${xml(item.name)}" x="${number(-item.width / 2)}" y="${number(-item.depth / 2)}" width="${number(item.width)}" height="${number(item.depth)}" rx="0.06" fill="${materialColor(project, item.color, '#b9a58e')}" transform="translate(${number(item.position.x)} ${number(item.position.y)}) rotate(${number(item.rotation)})"><title>${xml(item.name)}</title></rect>`);
  }
  parts.push('</g>', '<g class="room-labels" fill="#42474e" font-family="Arial, sans-serif" text-anchor="middle">');
  for (const room of rooms) {
    const center = roomCenter(room);
    const label = `${room.name} · ${roomArea(room).toFixed(2)} m²`;
    parts.push(`<text data-kind="room-label" x="${number(center.x)}" y="${number(center.y)}" font-size="0.16">${xml(label)}</text>`);
  }
  parts.push('</g>', '<g class="drawing-metadata" font-family="Arial, sans-serif" font-size="0.11" fill="#626870">');
  parts.push(`<text x="${number(bounds.minX + 0.08)}" y="${number(bounds.minY + 0.2)}">${xml(project.name)} · ${xml(level.name)} · dimensions in metres</text>`);
  parts.push('</g>', '</svg>');
  return parts.join('\n');
}

const CSV_COLUMNS = [
  'category', 'id', 'name', 'level', 'quantity', 'area_m2', 'length_m', 'width_m', 'depth_m', 'height_m',
  'sill_height_m', 'elevation_m', 'position_x_m', 'position_y_m', 'rotation_y_deg', 'material_id', 'host_wall_id', 'hidden', 'asset_id',
] as const;

/** Generate a project-wide quantity schedule; hidden instances are retained and marked. */
export function exportQuantitiesCsv(project: DesignProject): string {
  const levels = new Map(project.levels.map((level) => [level.id, level.name]));
  const lengthScale = project.units === 'ft' ? 0.3048 : 1;
  const areaScale = lengthScale * lengthScale;
  const rows: (string | number | boolean | null | undefined)[][] = [
    [...CSV_COLUMNS],
    ...project.levels.map((level) => [
      'level', level.id, level.name, level.name, 1, '', '', '', '', number(level.height * lengthScale), '', number(level.elevation * lengthScale), '', '', '', '', '', false, '',
    ]),
    ...project.rooms.map((room) => [
      'room', room.id, room.name, levels.get(room.levelId) ?? room.levelId, 1, number(roomArea(room) * areaScale), '', '', '', '', '', '', '', '', '', room.floorMaterialId, '', false, '',
    ]),
    ...project.walls.map((wall) => [
      'wall', wall.id, 'Wall', levels.get(wall.levelId) ?? wall.levelId, 1, '', number(wallLength(wall) * lengthScale), '', '', number(wall.height * lengthScale), '', '', '', '', '', wall.materialId, '', false, '',
    ]),
    ...project.wallOpenings.map((opening) => {
      const wall = project.walls.find((item) => item.id === opening.wallId);
      return [
        opening.kind, opening.id, opening.kind === 'door' ? 'Door opening' : 'Window opening', wall ? levels.get(wall.levelId) ?? wall.levelId : '', 1, '', '', number(opening.width * lengthScale), '', number(opening.height * lengthScale), number(opening.sillHeight * lengthScale), '', '', '', '', '', opening.wallId, false, '',
      ];
    }),
    ...project.furniture.map((item: FurnitureInstance) => [
      'furniture', item.id, item.name, levels.get(item.levelId) ?? item.levelId, 1, '', '', number(item.width * lengthScale), number(item.depth * lengthScale), number(item.height * lengthScale), '', number(item.elevation * lengthScale), number(item.position.x * lengthScale), number(item.position.y * lengthScale), number(item.rotation), '', '', item.hidden, item.assetId,
    ]),
  ];
  return rows.map((row) => row.map((value) => csv(value === undefined ? '' : value)).join(',')).join('\r\n') + '\r\n';
}

export function deliverableFileName(projectName: string, extension: 'svg' | 'csv'): string {
  return `${safeFileName(projectName)}.${extension}`;
}
