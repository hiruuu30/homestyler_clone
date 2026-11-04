import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { addFurniture, addLevel, addWallOpening, createStarterProject, normalizeProject } from '../domain/model';
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
    const room = elements('polygon').find((element) => element.getAttribute('id') === 'room-starter');
    expect(room?.getAttribute('data-area-m2')).toBe('5.2');
    expect(room?.getAttribute('points')).toContain('4.2,-0.5');
    expect(elements('line').find((element) => element.getAttribute('id') === 'wall-north')?.getAttribute('data-length-m')).toBe('2');
    expect(elements('g').find((element) => element.getAttribute('id') === 'opening-1')?.getAttribute('data-kind')).toBe('door');
    const chairElement = elements('rect').find((element) => element.getAttribute('id') === 'chair-quoted');
    expect(chairElement?.getAttribute('data-name')).toBe('Chair, "Oak" Suite');
    expect(chairElement?.getAttribute('fill')).toBe('#506070');
    expect(elements('title').some((element) => element.textContent === chair.name)).toBe(true);
    expect(elements('rect').some((element) => element.getAttribute('id') === 'hidden-chair')).toBe(false);
    expect(elements('polygon').some((element) => element.getAttribute('id') === 'upper-room')).toBe(false);
    expect(elements('text').some((element) => element.textContent === 'Living Room · 5.20 m²')).toBe(true);
    expect(svg).not.toContain('\u0000');
    expect(() => exportPlanSvg(project, 'missing-floor')).toThrow(/unknown level/);
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
