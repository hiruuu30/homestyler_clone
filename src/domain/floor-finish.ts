import type { FloorFinishMapping, FloorFinishPattern, Room, Units } from './types';

export const DEFAULT_FLOOR_FINISH_MAPPING: FloorFinishMapping = Object.freeze({
  pattern: 'none',
  colorOverlay: false,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
});

export type FloorPatternSpec = Readonly<{
  id: string;
  pattern: Exclude<FloorFinishPattern, 'none'>;
  width: number;
  height: number;
  transform: string;
  baseColor: string;
  grooveColor: string;
  highlightColor: string;
  strokeWidth: number;
}>;

export function normalizeFloorFinishMapping(value: unknown): FloorFinishMapping {
  if (value === undefined || value === null) return DEFAULT_FLOOR_FINISH_MAPPING;
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('floor finish mapping must be an object');
  const raw = value as Partial<FloorFinishMapping>;
  const pattern = raw.pattern ?? DEFAULT_FLOOR_FINISH_MAPPING.pattern;
  if (pattern !== 'none' && pattern !== 'wood' && pattern !== 'tile') throw new TypeError('floor pattern must be none, wood, or tile');
  const colorOverlay = raw.colorOverlay ?? DEFAULT_FLOOR_FINISH_MAPPING.colorOverlay;
  if (typeof colorOverlay !== 'boolean') throw new TypeError('floor color overlay must be a boolean');
  const rotation = raw.rotation ?? DEFAULT_FLOOR_FINISH_MAPPING.rotation;
  if (!Number.isFinite(rotation) || rotation < -180 || rotation > 180) throw new RangeError('floor pattern rotation must be between -180 and 180 degrees');
  const offsetX = raw.offsetX ?? DEFAULT_FLOOR_FINISH_MAPPING.offsetX;
  const offsetY = raw.offsetY ?? DEFAULT_FLOOR_FINISH_MAPPING.offsetY;
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY) || Math.abs(offsetX) > 1_000_000 || Math.abs(offsetY) > 1_000_000) {
    throw new RangeError('floor pattern offsets must be finite and within 1,000,000 project units');
  }
  const scaleX = raw.scaleX ?? DEFAULT_FLOOR_FINISH_MAPPING.scaleX;
  const scaleY = raw.scaleY ?? DEFAULT_FLOOR_FINISH_MAPPING.scaleY;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX < 0.05 || scaleY < 0.05 || scaleX > 20 || scaleY > 20) {
    throw new RangeError('floor pattern scales must be between 0.05 and 20');
  }
  return Object.freeze({ pattern, colorOverlay, rotation, offsetX, offsetY, scaleX, scaleY });
}

export function floorFinishForRoom(room: Pick<Room, 'floorFinish'>): FloorFinishMapping {
  return room.floorFinish ?? DEFAULT_FLOOR_FINISH_MAPPING;
}

export function floorPatternId(roomId: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < roomId.length; index += 1) {
    hash = Math.imul(hash ^ roomId.charCodeAt(index), 16_777_619);
  }
  return `floor-pattern-${(hash >>> 0).toString(36)}`;
}

function svgNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function safeColor(value: string): string {
  return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ? value : '#c9b8a0';
}

export function floorPatternSpec(
  roomId: string,
  mapping: FloorFinishMapping,
  materialColor: string,
  units: Units,
): FloorPatternSpec | null {
  if (mapping.pattern === 'none') return null;
  const unitsPerMetre = units === 'ft' ? 1 / 0.3048 : 1;
  const tileWidthMetres = 0.6;
  const tileHeightMetres = mapping.pattern === 'wood' ? 0.36 : 0.6;
  const width = tileWidthMetres * mapping.scaleX * unitsPerMetre;
  const height = tileHeightMetres * mapping.scaleY * unitsPerMetre;
  return Object.freeze({
    id: floorPatternId(roomId),
    pattern: mapping.pattern,
    width,
    height,
    transform: `translate(${svgNumber(mapping.offsetX)} ${svgNumber(mapping.offsetY)}) rotate(${svgNumber(mapping.rotation)})`,
    baseColor: mapping.colorOverlay ? safeColor(materialColor) : '#d9d6ce',
    grooveColor: mapping.colorOverlay ? 'rgba(32, 30, 28, 0.3)' : 'rgba(73, 70, 65, 0.32)',
    highlightColor: 'rgba(255, 255, 255, 0.38)',
    strokeWidth: 0.004 * unitsPerMetre,
  });
}

export function floorPatternSvgMarkup(spec: FloorPatternSpec): string {
  const { id, width, height, transform, baseColor, grooveColor, highlightColor, strokeWidth, pattern } = spec;
  const paths = pattern === 'wood'
    ? `<path d="M 0 0 H ${svgNumber(width)} M 0 ${svgNumber(height / 2)} H ${svgNumber(width)} M 0 ${svgNumber(height)} H ${svgNumber(width)} M ${svgNumber(width / 2)} 0 V ${svgNumber(height / 2)} M 0 ${svgNumber(height / 2)} V ${svgNumber(height)} M ${svgNumber(width)} ${svgNumber(height / 2)} V ${svgNumber(height)}" fill="none" stroke="${grooveColor}" stroke-width="${svgNumber(strokeWidth)}"/><path d="M 0 ${svgNumber(strokeWidth)} H ${svgNumber(width)} M 0 ${svgNumber(height / 2 + strokeWidth)} H ${svgNumber(width)}" fill="none" stroke="${highlightColor}" stroke-width="${svgNumber(strokeWidth / 2)}"/>`
    : `<path d="M 0 0 H ${svgNumber(width)} V ${svgNumber(height)} H 0 Z" fill="none" stroke="${grooveColor}" stroke-width="${svgNumber(strokeWidth)}"/><path d="M ${svgNumber(strokeWidth)} ${svgNumber(strokeWidth)} H ${svgNumber(width - strokeWidth)} V ${svgNumber(height - strokeWidth)} H ${svgNumber(strokeWidth)} Z" fill="none" stroke="${highlightColor}" stroke-width="${svgNumber(strokeWidth / 2)}"/>`;
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${svgNumber(width)}" height="${svgNumber(height)}" patternTransform="${transform}"><rect width="${svgNumber(width)}" height="${svgNumber(height)}" fill="${baseColor}"/>${paths}</pattern>`;
}
