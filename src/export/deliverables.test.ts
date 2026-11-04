import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { addFurniture, addLevel, addWallOpening, assignRoomCeilingMaterial, assignWallMaterial, createPolygonRoomWithHoles, createStarterProject, normalizeProject, updateFurniture, updateRoomFloorFinishMapping } from '../domain/model';
import { deliverableFileName, exportPlanSvg, exportQuantitiesCsv } from './deliverables';

const chair = {
  id: 'chair-quoted',
  assetId: 'asset-chair',
  name: 'Chair, "Oak"\nSuite',
  position: { x: 4.8, y: 1.2 },
  elevation: 0.1,
  rotation: 30,
  width: 0.6,
  depth: 0.55,
  height: 0.9,
  color: '#506070',
  levelId: 'floor-ground',
  roomId: 'room-starter',
} as const;

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += character;
    } else if (character === '"' && field === '') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\r' && source[index + 1] === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; index += 1;
    } else if (character === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

describe('independent project deliverables', () => {
  it('exports a well-formed editable SVG plan for only the requested level with rooms, walls, openings and visible furniture', () => {
    let project = createStarterProject('project-1', 'Studio & <Loft>\u0000');
    project = addFurniture(project, chair);
    project = addFurniture(project, { ...chair, id: 'hidden-chair', name: 'Hidden chair', hidden: true });
    project = addWallOpening(project, 'wall-north', 'door');
    const secondLevel = addLevel(project, 'Upper Floor');
    project = normalizeProject({
      ...secondLevel,
      rooms: [...secondLevel.rooms, { ...secondLevel.rooms[0], id: 'upper-room', name: 'Upper Room', levelId: secondLevel.activeLevelId }],
      activeLevelId: 'floor-ground',
    });

    const svg = exportPlanSvg(project);
    const errors: string[] = [];
    const document = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(svg, 'image/svg+xml');
    const ns = 'http://www.w3.org/2000/svg';
    const elements = (tag: string) => Array.from(document.getElementsByTagNameNS(ns, tag));
    expect(errors).toEqual([]);
    expect(elements('svg')).toHaveLength(1);
    expect(elements('title')[0].textContent).toBe('Studio & <Loft> — Ground Floor floor plan');
    expect(elements('svg')[0].getAttribute('data-units')).toBe('m');
    const room = elements('path').find((element) => element.getAttribute('id') === 'room-starter');
    expect(room?.getAttribute('data-area-m2')).toBe('5.2');
    expect(room?.getAttribute('d')).toContain('4.2,-0.5');
    expect(elements('line').find((element) => element.getAttribute('id') === 'wall-north')?.getAttribute('data-length-m')).toBe('2');
    expect(elements('g').find((element) => element.getAttribute('id') === 'opening-1')?.getAttribute('data-kind')).toBe('door');
    const chairElement = elements('rect').find((element) => element.getAttribute('id') === 'chair-quoted');
    expect(chairElement?.getAttribute('data-name')).toBe('Chair, "Oak" Suite');
    expect(chairElement?.getAttribute('fill')).toBe('#506070');
    expect(elements('title').some((element) => element.textContent === chair.name)).toBe(true);
    expect(elements('rect').some((element) => element.getAttribute('id') === 'hidden-chair')).toBe(false);
    expect(elements('path').some((element) => element.getAttribute('id') === 'upper-room')).toBe(false);
    expect(elements('text').some((element) => element.textContent === 'Living Room · 5.20 m²')).toBe(true);
    expect(svg).not.toContain('\u0000');
    expect(() => exportPlanSvg(project, 'missing-floor')).toThrow(/unknown level/);
  });

  it('exports floor finish patterns and metric transform metadata for imperial rooms', () => {
    const base = createStarterProject('imperial-finish', 'Mapped Floor', 'ft');
    const project = updateRoomFloorFinishMapping(base, 'room-starter', {
      pattern: 'wood', colorOverlay: true, rotation: 30, offsetX: 2, offsetY: -1, scaleX: 1.5, scaleY: 0.75,
    });
    const svg = exportPlanSvg(project);
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const ns = 'http://www.w3.org/2000/svg';
    const patterns = Array.from(document.getElementsByTagNameNS(ns, 'pattern'));
    const room = Array.from(document.getElementsByTagNameNS(ns, 'path')).find((element) => element.getAttribute('id') === 'room-starter');
    expect(patterns).toHaveLength(1);
    expect(patterns[0].getAttribute('patternTransform')).toBe('translate(0.6096 -0.3048) rotate(30)');
    expect(patterns[0].getAttribute('width')).toBe('0.9');
    expect(room?.getAttribute('fill')).toBe(`url(#${patterns[0].getAttribute('id')})`);
    expect(room?.getAttribute('data-floor-offset-x-m')).toBe('0.6096');
    expect(room?.getAttribute('data-floor-offset-y-m')).toBe('-0.3048');
    expect(room?.getAttribute('data-floor-scale-y')).toBe('0.75');
  });

  it('exports assigned wall material identity and resolved color', () => {
    const project = assignWallMaterial(createStarterProject(), 'wall-north', 'material-neutral-floor');
    const svg = exportPlanSvg(project);
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const walls = Array.from(document.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'line'));
    const wall = walls.find((element) => element.getAttribute('id') === 'wall-north');

    expect(wall?.getAttribute('data-material-id')).toBe('material-neutral-floor');
    expect(wall?.getAttribute('stroke')).toBe('#d9c7aa');
    expect(walls.find((element) => element.getAttribute('id') === 'wall-east')?.getAttribute('stroke')).toBe('#f4f1eb');
  });

  it('exports the assigned room ceiling material identity without changing its floor fill', () => {
    const project = assignRoomCeilingMaterial(createStarterProject(), 'room-starter', 'material-neutral-wall');
    const document = new DOMParser().parseFromString(exportPlanSvg(project), 'image/svg+xml');
    const room = Array.from(document.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'path'))
      .find((path) => path.getAttribute('id') === 'room-starter');

    expect(room?.getAttribute('data-ceiling-material-id')).toBe('material-neutral-wall');
    expect(room?.getAttribute('fill')).toBe('#d9c7aa');
  });

  it('exports a furniture swatch color as the object fill', () => {
    const project = updateFurniture(addFurniture(createStarterProject(), chair), 'chair-quoted', { color: '#d9c7aa' });
    const document = new DOMParser().parseFromString(exportPlanSvg(project), 'image/svg+xml');
    const element = Array.from(document.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'rect'))
      .find((rect) => rect.getAttribute('id') === 'chair-quoted');

    expect(element?.getAttribute('fill')).toBe('#d9c7aa');
  });

  it('exports all levels and quantities as escaped, parseable CSV with consistent 19-column metric rows', () => {
    let project = createStarterProject();
    project = addFurniture(project, chair);
    project = addFurniture(project, { ...chair, id: 'hidden-chair', name: 'Hidden chair', hidden: true });
    project = addWallOpening(project, 'wall-north', 'window');
    project = addLevel(project, 'Upper Floor');
    const csv = exportQuantitiesCsv(project);
    const rows = parseCsv(csv);
    const header = rows[0];

    expect(header).toEqual(['category', 'id', 'name', 'level', 'quantity', 'area_m2', 'length_m', 'width_m', 'depth_m', 'height_m', 'sill_height_m', 'elevation_m', 'position_x_m', 'position_y_m', 'rotation_y_deg', 'material_id', 'host_wall_id', 'hidden', 'asset_id']);
    expect(rows.slice(1).every((row) => row.length === header.length)).toBe(true);
    expect(rows.find((row) => row[0] === 'level' && row[2] === 'Upper Floor')).toBeDefined();
    expect(rows.find((row) => row[0] === 'room' && row[1] === 'room-starter')?.slice(0, 6)).toEqual(['room', 'room-starter', 'Lobby', 'Ground Floor', '1', '5.2']);
    expect(rows.find((row) => row[0] === 'window' && row[1] === 'opening-1')?.slice(7, 11)).toEqual(['1.2', '', '1.2', '0.9']);
    const chairRow = rows.find((row) => row[1] === 'chair-quoted');
    expect(chairRow?.[2]).toBe(chair.name);
    expect(chairRow?.[18]).toBe('asset-chair');
    const hiddenRow = rows.find((row) => row[1] === 'hidden-chair');
    expect(hiddenRow?.[17]).toBe('true');
    expect(hiddenRow?.[18]).toBe('asset-chair');
    expect(rows.find((row) => row[0] === 'wall' && row[1] === 'wall-north')?.[6]).toBe('2');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('exports imperial projects as accurately labeled metric SVG and CSV data', () => {
    const project = createStarterProject('imperial-project', 'Imperial Room', 'ft');
    const svg = exportPlanSvg(project);
    const rows = parseCsv(exportQuantitiesCsv(project));
    const room = rows.find((row) => row[0] === 'room' && row[1] === 'room-starter');
    const wall = rows.find((row) => row[0] === 'wall' && row[1] === 'wall-north');
    const svgWall = new DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagNameNS('http://www.w3.org/2000/svg', 'line');
    expect(svg).toContain('data-units="m"');
    expect(Array.from(svgWall).find((element) => element.getAttribute('id') === 'wall-north')?.getAttribute('data-length-m')).toBe('2');
    expect(room?.[5]).toBe('5.2');
    expect(wall?.[6]).toBe('2');
  });

  it('exports room holes as even-odd SVG cut-outs and subtracts them from net area', () => {
    const base = createStarterProject();
    const room = createPolygonRoomWithHoles('room-hole', 'Atrium', [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ], [[
      { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 2 },
    ]], base.materials.find((material) => material.category === 'floor')?.id, 'floor-ground');
    const project = { ...base, rooms: [room] };
    const svg = exportPlanSvg(project);
    const element = new DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagNameNS('http://www.w3.org/2000/svg', 'path')[0];
    expect(element.getAttribute('id')).toBe('room-hole');
    expect(element.getAttribute('fill-rule')).toBe('evenodd');
    expect(element.getAttribute('d')?.match(/M /g)).toHaveLength(2);
    expect(element.getAttribute('data-area-m2')).toBe('19');
    expect(parseCsv(exportQuantitiesCsv(project)).find((row) => row[1] === 'room-hole')?.[5]).toBe('19');
  });

  it('fits rotated furniture into the SVG drawing bounds', () => {
    const project = addFurniture(createStarterProject(), {
      ...chair, id: 'wide-chair', position: { x: 8, y: 5 }, width: 2, depth: 1, rotation: 45,
    });
    const viewBox = exportPlanSvg(project).match(/viewBox="([^"]+)"/)?.[1].split(' ').map(Number);
    expect(viewBox).toHaveLength(4);
    expect(viewBox![0] + viewBox![2]).toBeGreaterThan(9.55);
    expect(viewBox![1] + viewBox![3]).toBeGreaterThan(6.05);
  });

  it('creates portable predictable download names', () => {
    expect(deliverableFileName('My Home / Plan', 'svg')).toBe('my-home-plan.svg');
    expect(deliverableFileName('Málaga . Plan.', 'csv')).toBe('malaga-plan.csv');
    expect(deliverableFileName('CON', 'svg')).toBe('roomlab-con.svg');
    expect(deliverableFileName('... / !!!', 'csv')).toBe('roomlab-project.csv');
  });
});
