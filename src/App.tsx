import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Download, GitMerge,
  Eye, EyeOff, FilePlus2, Grid2X2, Layers3, Maximize2, MousePointer2, PaintBucket, PanelLeftClose,
  PenTool, Plus, Redo2, RotateCw, Save, Scissors, Search, Sofa, Square, Trash2, Undo2, Upload,
} from 'lucide-react';
import {
  addFurniture, addWall as addProjectWall, addWallOpening, arrayFurniture, assignRoomMaterial, createPlanUnderlay, createPolygonRoom as makePolygonRoom, createRectRoom, createStarterProject, duplicateFurniture,
  addLevel as addProjectLevel, convertProjectUnits, createWall as makeWall, moveFurniture, normalizeProject, removeFurniture,
  removeLevel as removeProjectLevel, removePlanUnderlay, removeWall, removeWallOpening, roomArea, rotateFurniture, setFurnitureHidden, splitWall as splitProjectWall, updateFurniture, updatePlanUnderlay, updateWallOpening,
  findJoinableWall, joinCollinearWalls, repairWallTopology, updateWallEndpoints, updateWallHeight, updateWallThickness,
} from './domain/model';
import type { DesignProject, Point, ToolMode } from './domain/types';
import { deliverableFileName, exportPlanSvg, exportQuantitiesCsv } from './export/deliverables';
import { reconstructRoomsFromWalls } from './domain/room-reconstruction';
import { PlanCanvas } from './components/PlanCanvas';
const SceneViewport = lazy(() => import('./components/SceneViewport'));

type ViewMode = 'plan' | '3d';
type PanelMode = 'build' | 'furniture' | 'finish' | 'project';
const STORAGE_KEY = 'roomlab.project.v2';
const LEGACY_STORAGE_KEY = 'roomlab.project.v1';

function loadProject(): DesignProject {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) return normalizeProject(JSON.parse(saved));
  } catch { localStorage.removeItem(STORAGE_KEY); }
  return createStarterProject();
}

function centerOf(points: readonly Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }

function nextEntityId(items: readonly { id: string }[], prefix: string): string {
  const used = new Set(items.map((item) => item.id));
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export default function App() {
  const [project, setProject] = useState<DesignProject>(loadProject);
  const [activeLevelId, setActiveLevelId] = useState(() => project.activeLevelId);
  const [undoStack, setUndoStack] = useState<DesignProject[]>([]);
  const [redoStack, setRedoStack] = useState<DesignProject[]>([]);
  const [view, setView] = useState<ViewMode>('plan');
  const [cameraFitRequest, setCameraFitRequest] = useState(0);
  const [panel, setPanel] = useState<PanelMode>('build');
  const [tool, setTool] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [arraySettingsOpen, setArraySettingsOpen] = useState(false);
  const [arrayCopies, setArrayCopies] = useState(2);
  const [arrayOffsetX, setArrayOffsetX] = useState(1);
  const [arrayOffsetY, setArrayOffsetY] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const planImageRef = useRef<HTMLInputElement>(null);

  const activeLevel = project.levels.find((level) => level.id === activeLevelId) ?? project.levels[0];
  const visibleProject = useMemo(() => ({
    ...project,
    activeLevelId,
    rooms: project.rooms.filter((item) => item.levelId === activeLevelId),
    walls: project.walls.filter((item) => item.levelId === activeLevelId),
    furniture: project.furniture.filter((item) => item.levelId === activeLevelId),
    wallOpenings: project.wallOpenings.filter((opening) => project.walls.some((wall) => wall.id === opening.wallId && wall.levelId === activeLevelId)),
    underlays: project.underlays.filter((item) => item.levelId === activeLevelId),
  }), [project, activeLevelId]);
  const selectedRoom = visibleProject.rooms.find((item) => item.id === selectedId) ?? null;
  const selectedWall = visibleProject.walls.find((item) => item.id === selectedId) ?? null;
  const joinableWallId = selectedWall ? findJoinableWall(project, selectedWall.id) : null;
  const selectedFurniture = visibleProject.furniture.find((item) => item.id === selectedId) ?? null;
  const selectedOpening = visibleProject.wallOpenings.find((item) => item.id === selectedId) ?? null;
  const area = useMemo(() => visibleProject.rooms.reduce((sum, room) => sum + roomArea(room), 0), [visibleProject.rooms]);
  const selectedMaterial = selectedRoom ? project.materials.find((item) => item.id === selectedRoom.floorMaterialId) : null;
  const lengthUnit = project.units;
  const areaUnit = project.units === 'ft' ? 'ft²' : 'm²';
  const metresToProjectUnits = project.units === 'ft' ? 1 / 0.3048 : 1;
  const metresPerProjectUnit = project.units === 'ft' ? 0.3048 : 1;

  function commit(next: DesignProject, nextLevelId = activeLevelId) {
    setUndoStack((items) => [...items.slice(-49), project]);
    setRedoStack([]);
    setProject({ ...next, activeLevelId: nextLevelId, updatedAt: new Date().toISOString() });
    setActiveLevelId(nextLevelId);
    setSaved(false);
  }
  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    if (previous.units !== project.units) setCameraFitRequest((value) => value + 1);
    setRedoStack((items) => [...items, project]);
    setUndoStack((items) => items.slice(0, -1));
    setProject(previous);
    setActiveLevelId(previous.activeLevelId);
    setSelectedId((currentId) => currentId && [
      ...previous.rooms.map((item) => item.id),
      ...previous.walls.map((item) => item.id),
      ...previous.wallOpenings.map((item) => item.id),
      ...previous.furniture.map((item) => item.id),
    ].includes(currentId) ? currentId : null);
    setSaved(false);
  }
  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    if (next.units !== project.units) setCameraFitRequest((value) => value + 1);
    setUndoStack((items) => [...items, project]);
    setRedoStack((items) => items.slice(0, -1));
    setProject(next);
    setActiveLevelId(next.activeLevelId);
    setSaved(false);
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, activeLevelId }));
    setSaved(true);
    notify('Saved on this device');
  }
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2400); }
  function createRoom(start: Point, end: Point) {
    if (distance(start, end) * metresPerProjectUnit < 0.35) { notify('Draw a larger room'); return; }
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const room = createRectRoom(nextEntityId(project.rooms, 'room'), `Room ${project.rooms.length + 1}`, Math.abs(end.x - start.x), Math.abs(end.y - start.y), { x: minX, y: minY }, project.materials[0]?.id, activeLevelId, project.units);
    const existingWalls = [...project.walls];
    const walls = room.points.map((point, index) => {
      const wall = makeWall(nextEntityId(existingWalls, 'wall'), point, room.points[(index + 1) % room.points.length], undefined, undefined, undefined, activeLevelId, project.units);
      existingWalls.push(wall);
      return wall;
    });
    const next = { ...project, rooms: [...project.rooms, room], walls: [...project.walls, ...walls] };
    commit(next);
    setSelectedId(room.id);
    setTool('select');
  }
  function createFreeformRoom(points: readonly Point[]) {
    try {
      const room = makePolygonRoom(nextEntityId(project.rooms, 'room'), `Room ${project.rooms.length + 1}`, points, project.materials[0]?.id, activeLevelId, project.units);
      const existingWalls = [...project.walls];
      const walls = room.points.map((point, index) => {
        const wall = makeWall(nextEntityId(existingWalls, 'wall'), point, room.points[(index + 1) % room.points.length], undefined, undefined, undefined, activeLevelId, project.units);
        existingWalls.push(wall);
        return wall;
      });
      commit({ ...project, rooms: [...project.rooms, room], walls: [...project.walls, ...walls] });
      setSelectedId(room.id);
      setTool('select');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create this room outline');
    }
  }
  function createWall(start: Point, end: Point) {
    if (distance(start, end) * metresPerProjectUnit < 0.05) { notify('Draw a longer wall segment'); return; }
    try {
      const wall = makeWall(nextEntityId(project.walls, 'wall'), start, end, undefined, undefined, undefined, activeLevelId, project.units);
      commit(addProjectWall(project, wall));
      setSelectedId(wall.id);
      setTool('select');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not connect this wall');
    }
  }
  function addSofa() {
    const room = selectedRoom ?? visibleProject.rooms[0];
    if (!room) { notify('Create a room first'); return; }
    const next = addFurniture(project, {
      assetId: 'generic-starter-sofa',
      name: 'Starter sofa',
      position: centerOf(room.points),
      rotation: 0,
      width: 1.8 * metresToProjectUnits,
      depth: 0.8 * metresToProjectUnits,
      height: 0.85 * metresToProjectUnits,
      elevation: 0,
      color: '#b9a58e',
      levelId: activeLevelId,
      roomId: room.id,
    });
    commit(next);
    setSelectedId(next.furniture.at(-1)?.id ?? null);
    setView('plan');
  }
  function rotateSelected() {
    if (!selectedFurniture) return;
    commit(rotateFurniture(project, selectedFurniture.id, 45));
  }
  function moveSelectedFurniture(id: string, position: Point) {
    commit(moveFurniture(project, id, position));
  }
  function duplicateSelectedFurniture() {
    if (!selectedFurniture) return;
    const next = duplicateFurniture(project, selectedFurniture.id);
    commit(next);
    setSelectedId(next.furniture.at(-1)?.id ?? null);
  }
  function createSelectedFurnitureArray() {
    if (!selectedFurniture) return;
    try {
      const next = arrayFurniture(project, selectedFurniture.id, arrayCopies, { x: arrayOffsetX, y: arrayOffsetY });
      commit(next);
      setSelectedId(next.furniture.at(-1)?.id ?? null);
      setArraySettingsOpen(false);
      notify(`${arrayCopies} furniture copies added · Undo to restore`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create furniture array');
    }
  }
  function toggleArraySettings() {
    const open = !arraySettingsOpen;
    if (open && selectedFurniture) setArrayOffsetX(Number((selectedFurniture.width + 0.2 * metresToProjectUnits).toFixed(2)));
    setArraySettingsOpen(open);
  }
  function toggleSelectedFurnitureHidden() {
    if (!selectedFurniture) return;
    const hidden = !selectedFurniture.hidden;
    commit(setFurnitureHidden(project, selectedFurniture.id, hidden));
    notify(hidden ? 'Object hidden · Undo to restore' : 'Object shown');
  }
  function deleteSelected() {
    if (selectedFurniture) commit(removeFurniture(project, selectedFurniture.id));
    else if (selectedWall) commit(removeWall(project, selectedWall.id));
    else if (selectedOpening) commit(removeWallOpening(project, selectedOpening.id));
    else return;
    setSelectedId(null);
  }
  function splitSelectedWall() {
    if (!selectedWall) return;
    commit(splitProjectWall(project, selectedWall.id));
    notify('Wall split at midpoint · Undo to restore');
  }
  function joinSelectedWall() {
    if (!selectedWall || !joinableWallId) return;
    try {
      commit(joinCollinearWalls(project, selectedWall.id, joinableWallId));
      notify('Collinear wall joined · Undo to restore');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not join this wall');
    }
  }
  function createSelectedWallOpening(kind: 'door' | 'window') {
    if (!selectedWall) { notify('Select a wall first, then add its door or window'); return; }
    try {
      const next = addWallOpening(project, selectedWall.id, kind);
      commit(next);
      setSelectedId(next.wallOpenings.at(-1)?.id ?? null);
      setView('plan');
      notify(`${kind === 'door' ? 'Door' : 'Window'} opening added · Undo to restore`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add an opening to this wall');
    }
  }
  function editSelectedOpening(changes: Parameters<typeof updateWallOpening>[2]) {
    if (!selectedOpening) return;
    try { commit(updateWallOpening(project, selectedOpening.id, changes)); }
    catch (error) { notify(error instanceof Error ? error.message : 'Could not update this opening'); }
  }
  function applyMaterial(materialId: string) {
    const room = selectedRoom ?? visibleProject.rooms[0];
    if (!room) { notify('Create a room first'); return; }
    commit(assignRoomMaterial(project, room.id, materialId));
    setSelectedId(room.id);
  }
  function exportProject() {
    const blob = new Blob([JSON.stringify({ ...project, activeLevelId }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.roomlab.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Project JSON exported');
  }
  function downloadText(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportFloorPlan() {
    downloadText(exportPlanSvg(project, activeLevelId), deliverableFileName(project.name, 'svg'), 'image/svg+xml;charset=utf-8');
    notify(`${activeLevel.name} SVG plan exported`);
  }
  function exportSchedule() {
    downloadText(exportQuantitiesCsv(project), deliverableFileName(project.name, 'csv'), 'text/csv;charset=utf-8');
    notify('Project quantities CSV exported');
  }
  async function importPlanImage(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12_000_000) {
      notify('Choose a PNG, JPEG or WebP under 12 MB');
      if (planImageRef.current) planImageRef.current.value = '';
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 20_000 || bitmap.height > 20_000 || !bitmap.width || !bitmap.height) {
        bitmap.close();
        throw new RangeError('Image dimensions are too large');
      }
      const aspectRatio = bitmap.width / bitmap.height;
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        bitmap.close();
        throw new Error('Image processing is unavailable');
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const src = canvas.toDataURL('image/jpeg', 0.82);
      if (src.length > 1_500_000) throw new RangeError('This plan image is too detailed for local project storage');
      const width = 5 * metresToProjectUnits;
      const height = width / aspectRatio;
      const points = [...visibleProject.rooms.flatMap((room) => room.points), ...visibleProject.walls.flatMap((wall) => [wall.start, wall.end])];
      const center = centerOf(points);
      const next = createPlanUnderlay(project, {
        id: nextEntityId(project.underlays, 'underlay'),
        name: file.name.slice(0, 120) || 'Floor plan image',
        src,
        levelId: activeLevelId,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        aspectRatio,
        opacity: 0.45,
      });
      commit(next);
      setCameraFitRequest((value) => value + 1);
      setView('plan');
      notify('Plan image added · adjust size and position below');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import this image');
    }
    if (planImageRef.current) planImageRef.current.value = '';
  }
  function updateUnderlay(id: string, changes: Parameters<typeof updatePlanUnderlay>[2]) {
    try { commit(updatePlanUnderlay(project, id, changes)); }
    catch (error) { notify(error instanceof Error ? error.message : 'Could not update this image'); }
  }
  function deleteUnderlay(id: string) {
    commit(removePlanUnderlay(project, id));
    notify('Plan image removed · Undo to restore');
  }
  function editWallEndpoints(id: string, changes: { start?: Point; end?: Point }): boolean {
    try {
      commit(updateWallEndpoints(project, id, changes));
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the connected wall geometry');
      return false;
    }
  }
  function repairExistingWallJunctions() {
    try {
      const next = repairWallTopology(project);
      if (next === project) { notify('No wall junctions need repair'); return; }
      commit(next);
      notify('Existing wall junctions repaired · Undo to restore');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not repair existing wall junctions');
    }
  }
  function createRoomsFromClosedWalls() {
    try {
      const next = reconstructRoomsFromWalls(project);
      const count = next.rooms.length - project.rooms.length;
      if (count <= 0) { notify('No new closed wall loops found'); return; }
      commit(next);
      notify(`${count} room${count === 1 ? '' : 's'} reconstructed · Undo to restore`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not reconstruct rooms from these walls');
    }
  }
  function changeUnits(units: 'm' | 'ft') {
    if (units === project.units) return;
    commit(convertProjectUnits(project, units));
    setCameraFitRequest((value) => value + 1);
    notify(`Project dimensions converted to ${units === 'm' ? 'metres' : 'feet'}`);
  }
  async function importProject(file?: File) {
    if (!file) return;
    try {
      const imported = normalizeProject(JSON.parse(await file.text()));
      commit(imported, imported.activeLevelId);
      setSelectedId(null);
      notify('Project imported');
    } catch { notify('Could not import this project file'); }
    if (importRef.current) importRef.current.value = '';
  }
  function newDesign() {
    if (!window.confirm('Start a new design?')) return;
    const next = createStarterProject();
    commit(next, next.activeLevelId);
    setSelectedId(null);
  }

  function selectLevel(levelId: string) {
    setActiveLevelId(levelId);
    setProject((current) => ({ ...current, activeLevelId: levelId }));
    setSelectedId(null);
  }

  function addLevel() {
    const next = addProjectLevel(project);
    commit(next, next.activeLevelId);
    setSelectedId(null);
  }

  function deleteLevel(levelId: string) {
    try {
      const next = removeProjectLevel(project, levelId);
      commit(next, next.activeLevelId);
      setSelectedId(null);
      notify('Floor removed · Undo to restore');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not remove this floor');
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedFurniture) { event.preventDefault(); duplicateSelectedFurniture(); }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && (selectedFurniture || selectedWall || selectedOpening)) { event.preventDefault(); deleteSelected(); }
      else if (event.code === 'Space' && selectedFurniture) { event.preventDefault(); rotateSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const panelTitle = ({ build: 'Build', furniture: 'Furniture', finish: 'Finishes', project: 'Project' })[panel];
  return (
    <div className="studio-shell">
      <header className="topbar">
        <a className="brand" href="#workspace"><span className="brand-mark"><Building2 size={18} /></span><b>ROOM<span>LAB</span></b></a>
        <button className="project-title" onClick={() => notify(project.name)}>{project.name}<ChevronDown size={13} /></button>
        <span className="cloud-state"><i /> Local project</span>
        <div className="top-spacer" />
        <div className="top-actions">
          <button className="top-btn" title="Save project" aria-label="Save project" onClick={save}><Save size={20} /><span>{saved ? 'Save' : 'Save*'}</span></button>
          <button className="top-btn" title="Undo" aria-label="Undo" onClick={undo} disabled={!undoStack.length}><Undo2 size={20} /><span>Undo</span></button>
          <button className="top-btn" title="Redo" aria-label="Redo" onClick={redo} disabled={!redoStack.length}><Redo2 size={20} /><span>Redo</span></button>
          <span className="avatar" aria-label="RoomLab account">H</span>
          <button className="icon-btn" title="Help" aria-label="Help" onClick={() => notify('Starter editor: draw rooms, add walls, furniture and finishes')}><CircleHelp size={20} /></button>
        </div>
      </header>
      <div className="workspace" id="workspace">
        <nav className="rail" aria-label="Editor tools">
          <Rail icon={<Building2 size={28} />} label="Build" active={panel === 'build'} onClick={() => setPanel('build')} />
          <div className="rail-divider" />
          <Rail icon={<Sofa size={28} />} label="Decorate" active={panel === 'furniture' || panel === 'finish'} onClick={() => setPanel('furniture')} />
          <div className="rail-divider" />
          <Rail icon={<PaintBucket size={28} />} label="AI Decor" active={false} disabled title="AI decorating is not implemented" onClick={() => {}} />
          <div className="rail-divider" />
          <Rail icon={<Grid2X2 size={28} />} label="Templates" active={false} disabled title="Template catalog is not implemented" onClick={() => {}} />
          <div className="rail-divider" />
          <Rail icon={<Layers3 size={28} />} label="My" active={panel === 'project'} onClick={() => setPanel('project')} />
        </nav>
        {!collapsed && <aside className="tool-panel">
          <div className={`panel-heading${panel === 'build' ? ' build-heading' : ''}`}><div>{panel === 'build' ? <span className="build-heading-title">Create room</span> : <><small>EDITOR</small><h1>{panelTitle}</h1></>}</div><button className="icon-btn" title="Collapse panel" onClick={() => setCollapsed(true)}><PanelLeftClose size={16} /></button></div>
          {panel === 'build' && <div className="panel-scroll build-panel-scroll"><div className="build-panel-content">
            <div className="build-template-grid">
              <button className="build-template-card" disabled title="Room templates are not implemented"><div className="build-card-eyebrow">Select</div><div className="build-card-title">Templates</div><span className="build-card-art"><Building2 size={27} /></span></button>
              <button className="build-template-card" onClick={() => planImageRef.current?.click()} title="Import a floor-plan image underlay"><div className="build-card-eyebrow">Import</div><div className="build-card-title">Floor plan</div><span className="build-card-art"><Upload size={25} /></span><span className="build-new-badge">New</span></button>
            </div>
            <input ref={planImageRef} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Choose floor plan image" onChange={(event) => importPlanImage(event.currentTarget.files?.[0])} />
            {visibleProject.underlays.length > 0 && <div className="plan-underlay-list">
              <div className="section-label">PLAN IMAGES · {activeLevel.name.toUpperCase()}</div>
              {visibleProject.underlays.map((underlay) => <div className="plan-underlay-card" key={underlay.id}>
                <strong title={underlay.name}>{underlay.name}</strong>
                <label>Width · {lengthUnit}<input key={`${underlay.id}-width-${underlay.width}`} type="number" min="0.01" step="0.1" defaultValue={underlay.width.toFixed(2)} onBlur={(event) => {
                  const width = event.currentTarget.valueAsNumber;
                  if (!Number.isFinite(width) || width <= 0) { event.currentTarget.value = underlay.width.toFixed(2); return; }
                  if (Math.abs(width - underlay.width) > 1e-9) updateUnderlay(underlay.id, { width, height: width / underlay.aspectRatio });
                }} /></label>
                <label>X · {lengthUnit}<input key={`${underlay.id}-x-${underlay.x}`} type="number" step="0.1" defaultValue={underlay.x.toFixed(2)} onBlur={(event) => {
                  const x = event.currentTarget.valueAsNumber;
                  if (!Number.isFinite(x)) { event.currentTarget.value = underlay.x.toFixed(2); return; }
                  if (Math.abs(x - underlay.x) > 1e-9) updateUnderlay(underlay.id, { x });
                }} /></label>
                <label>Y · {lengthUnit}<input key={`${underlay.id}-y-${underlay.y}`} type="number" step="0.1" defaultValue={underlay.y.toFixed(2)} onBlur={(event) => {
                  const y = event.currentTarget.valueAsNumber;
                  if (!Number.isFinite(y)) { event.currentTarget.value = underlay.y.toFixed(2); return; }
                  if (Math.abs(y - underlay.y) > 1e-9) updateUnderlay(underlay.id, { y });
                }} /></label>
                <label className="plan-underlay-opacity">Opacity<input key={`${underlay.id}-opacity-${underlay.opacity}`} type="range" min="0.05" max="1" step="0.05" defaultValue={underlay.opacity} onPointerUp={(event) => {
                  const opacity = event.currentTarget.valueAsNumber;
                  if (Math.abs(opacity - underlay.opacity) > 1e-9) updateUnderlay(underlay.id, { opacity });
                }} onKeyUp={(event) => {
                  const opacity = event.currentTarget.valueAsNumber;
                  if (Math.abs(opacity - underlay.opacity) > 1e-9) updateUnderlay(underlay.id, { opacity });
                }} /></label>
                <button className="plan-underlay-remove" onClick={() => deleteUnderlay(underlay.id)}>Remove image · Undo available</button>
              </div>)}
            </div>}
            <button className="build-new-plan" onClick={() => { setView('plan'); setTool('room'); }}><Plus size={15} />Add a room to the plan</button>
            <span className="section-label build-section build-section-first">Draw walls</span>
            <div className="build-reference-grid build-wall-tools">
              <button className={`build-reference-tool${tool === 'wall' ? ' active' : ''}`} onClick={() => { setView('plan'); setTool('wall'); }}><span><Grid2X2 size={27} /></span><div>Draw straight walls</div></button>
              <button className={`build-reference-tool${tool === 'room' ? ' active' : ''}`} onClick={() => { setView('plan'); setTool('room'); }}><span><Square size={27} /></span><div>Draw rectangular room</div></button>
              <button className={`build-reference-tool${tool === 'polygon' ? ' active' : ''}`} onClick={() => { setView('plan'); setTool('polygon'); }}><span><PenTool size={27} /></span><div>Draw custom room</div></button>
              <button className="build-reference-tool" disabled title="Outside area is not implemented"><span><Maximize2 size={27} /></span><span className="build-reference-label">Outside area</span></button>
            </div>
            <button className="action-row" title="Connect existing same-floor X/T junctions and matching room edges; undo is available" onClick={repairExistingWallJunctions}><Grid2X2 size={16} />Repair wall junctions</button>
            <button className="action-row" title="Create missing rooms inside closed wall loops on every floor; existing rooms are preserved. Repair wall crossings first." onClick={createRoomsFromClosedWalls}><Grid2X2 size={16} />Reconstruct rooms</button>
            <span className="section-label build-section">Door and window</span>
            <div className="build-reference-grid build-muted-grid build-door-tools">
              <button className="build-reference-tool" onClick={() => createSelectedWallOpening('door')} title="Select a wall first"><span><Square size={27} /></span><div>Single door</div></button>
              <button className="build-reference-tool" onClick={() => createSelectedWallOpening('window')} title="Select a wall first"><span><Square size={27} /></span><div>Window</div></button>
              <button className="build-reference-tool" disabled><span><Square size={27} /></span><div>Corner bay window</div></button>
            </div>
            <span className="section-label build-section">Structure</span>
            <div className="build-reference-grid build-muted-grid build-structure-tools">
              <button className="build-reference-tool" disabled><span><Building2 size={27} /></span><div>Auto add roof</div></button>
              <button className="build-reference-tool" disabled><span><Layers3 size={27} /></span><div>Stair</div></button>
              <button className="build-reference-tool" onClick={() => createSelectedWallOpening('door')} title="Select a wall first"><span><Square size={27} /></span><span className="build-reference-label">Door opening</span></button>
            </div>
            <div className="section-label">FLOORS</div>
            <div className="level-list">{project.levels.map((level) => <div key={level.id} className={`level-row${level.id === activeLevelId ? ' active' : ''}`}>
              <button className="level-select" onClick={() => selectLevel(level.id)}><Layers3 size={14} /><span>{level.name}<small>Elevation {level.elevation.toFixed(2)} {lengthUnit}</small></span></button>
              {project.levels.length > 1 && <button className="level-delete" title={`Delete ${level.name} · undoable`} onClick={() => deleteLevel(level.id)}><Trash2 size={13} /></button>}
            </div>)}</div>
            <button className="action-row add-level" onClick={addLevel}><Plus size={15} />Add floor</button>
            <div className="section-label">ADVANCED TOOLS</div>
            <button className="locked-row" disabled><Plus size={16} /><span>Advanced openings</span><small>Not implemented</small></button>
            <p className="disclaimer">This is an early independent implementation; full feature and pixel parity have not been verified.</p>
          </div></div>}
          {panel === 'furniture' && <div className="panel-scroll">
            <div className="panel-subnav"><button className="active" onClick={() => setPanel('furniture')}>Furniture</button><button onClick={() => setPanel('finish')}>Finish</button></div>
            <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search starter assets" /></div>
            <div className="section-label">GENERIC STARTER ASSETS</div>
            <button className="asset-card" onClick={addSofa}><span className="asset-drawing"><Sofa size={44} /></span><b>Starter sofa</b><small>Procedural placeholder</small></button>
            <div className="tip"><b>Asset corpus missing</b><p>User stated permission for the Homestyler catalog; the source catalog is not supplied here. These starter assets are not equivalent.</p></div>
          </div>}
          {panel === 'finish' && <div className="panel-scroll">
            <div className="panel-subnav"><button onClick={() => setPanel('furniture')}>Furniture</button><button className="active" onClick={() => setPanel('finish')}>Finish</button></div>
            <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search starter finishes" /></div>
            <div className="section-label">STARTER MATERIALS</div>
            <div className="material-grid">{project.materials.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((material) => <button key={material.id} className="material-card" onClick={() => applyMaterial(material.id)}><span style={{ background: material.color }} /><b>{material.name}</b></button>)}</div>
            <div className="tip"><b>Catalog coverage</b><p>Only generic color swatches are present. Texture maps, UV controls and exhaustive finishes remain outstanding.</p></div>
          </div>}
          {panel === 'project' && <div className="panel-scroll">
            <div className="project-card"><strong>{project.name}</strong><p>{project.levels.length} floors · {project.rooms.length} rooms · {project.furniture.length} objects · {project.wallOpenings.length} openings</p><p>{area.toFixed(2)} {areaUnit} on {activeLevel.name}</p></div>
            <label className="unit-setting">Project units<select aria-label="Project units" value={project.units} onChange={(event) => changeUnits(event.target.value as 'm' | 'ft')}><option value="m">Metric · metres</option><option value="ft">Imperial · feet</option></select></label>
            <button className="action-row" onClick={newDesign}><FilePlus2 size={16} />New design</button>
            <button className="action-row" onClick={() => importRef.current?.click()}><Upload size={16} />Import RoomLab JSON</button>
            <button className="action-row" onClick={exportProject}><Download size={16} />Export RoomLab JSON</button>
            <button className="action-row" onClick={exportFloorPlan}><Download size={16} />Export active-floor SVG plan</button>
            <button className="action-row" onClick={exportSchedule}><Download size={16} />Export project quantities CSV</button>
            <div className="section-label">HIDDEN OBJECTS · {activeLevel.name.toUpperCase()}</div>
            {visibleProject.furniture.filter((item) => item.hidden).map((item) => <button key={item.id} className="action-row hidden-object-row" onClick={() => { commit(setFurnitureHidden(project, item.id, false)); setSelectedId(item.id); notify('Object shown'); }}><Eye size={15} /><span>Show {item.name}</span></button>)}
            {!visibleProject.furniture.some((item) => item.hidden) && <p className="hidden-empty">No hidden objects on this floor.</p>}
            <div className="tip"><b>Local persistence only</b><p>Save stores data in this browser. Cloud accounts, sharing and project history are not implemented.</p></div>
          </div>}
          <div className="panel-foot"><span className="status-dot" />Starter build · local-only storage</div>
        </aside>}
        <main className="editor-stage">
          {collapsed && <button className="expand-panel" onClick={() => setCollapsed(false)} aria-label="Show panel"><ChevronRight size={17} /></button>}
          <div className="viewport-area">
            {view === 'plan'
              ? <PlanCanvas project={visibleProject} tool={tool} selectedId={selectedId} onSelect={setSelectedId} onCreateRoom={createRoom} onCreatePolygonRoom={createFreeformRoom} onCreateWall={createWall} onMoveFurniture={moveSelectedFurniture} fitRequest={cameraFitRequest} />
              : <Suspense fallback={<div className="scene-loading">Loading 3D view…</div>}><SceneViewport key={cameraFitRequest} project={visibleProject} selectedId={selectedId} onSelect={setSelectedId} onMoveFurniture={moveSelectedFurniture} /></Suspense>}
            <div className="canvas-hint">{tool === 'room' ? 'Drag to draw a rectangular room · snaps to plan points' : tool === 'polygon' ? 'Click outline points · click the first point or press Enter to close · Esc cancels' : tool === 'wall' ? 'Drag to add a wall · snaps to plan points' : view === 'plan' ? 'Select elements to edit · scroll to zoom' : 'Drag to orbit · Shift-drag to pan · scroll to zoom'}</div>
          </div>
          <footer className="bottom-bar">
            <div className="canvas-tools"><button className={tool === 'select' ? 'chosen' : ''} title="Select" onClick={() => setTool('select')}><MousePointer2 size={16} /></button><button className={tool === 'room' ? 'chosen' : ''} title="Draw room" onClick={() => { setView('plan'); setTool('room'); }}><Square size={16} /></button><button className={tool === 'wall' ? 'chosen' : ''} title="Draw wall" onClick={() => { setView('plan'); setTool('wall'); }}><Grid2X2 size={16} /></button><button title="Add sofa" onClick={() => { setPanel('furniture'); addSofa(); }}><Sofa size={16} /></button></div>
            <span className="bottom-spacer" />
            <button className={`view-tab ${view === 'plan' ? 'selected' : ''}`} onClick={() => { setView('plan'); setTool('select'); }}>2D Plan</button>
            <button className={`view-tab ${view === '3d' ? 'selected' : ''}`} onClick={() => { setView('3d'); setTool('select'); }}>3D View</button>
            <button className="view-tab disabled" disabled title="Not implemented">Walkthrough</button>
            <button className="icon-btn" title="Fit view" onClick={() => { setCameraFitRequest((value) => value + 1); notify('View fitted to current project'); }}><Maximize2 size={16} /></button>
          </footer>
        </main>
        <aside className={`inspector${selectedWall ? ' wall-state' : ''}`}>
          <div className="map-card"><MapPreview
            project={visibleProject}
            view={view}
            onSet3d={() => { setView('3d'); setTool('select'); }}
            onSet2d={() => { setView('plan'); setTool('select'); }}
            onSelectRoom={(roomId) => {
              if (visibleProject.rooms.some((room) => room.id === roomId)) setSelectedId(roomId);
            }}
          /></div>
          <div className={`inspector-head${selectedWall ? ' wall-selected' : ''}`}>{!selectedWall && <small>PROPERTIES</small>}<h2>{selectedWall ? 'Layer settings' : selectedRoom?.name ?? selectedFurniture?.name ?? (selectedOpening ? `${selectedOpening.kind === 'door' ? 'Door' : 'Window'} opening` : 'Design summary')}</h2></div>
          {!selectedRoom && !selectedWall && !selectedFurniture && !selectedOpening && <div className="summary"><Building2 size={27} /><p>{activeLevel.name} · select a room, wall, furniture object or opening.</p><div><span>Rooms</span><b>{visibleProject.rooms.length}</b></div><div><span>Floor area</span><b>{area.toFixed(2)} {areaUnit}</b></div><div><span>Furniture</span><b>{visibleProject.furniture.length}</b></div></div>}
          {selectedRoom && <div className="properties"><section><h3>Room settings</h3><label>Room name<input value={selectedRoom.name} onChange={(event) => commit({ ...project, rooms: project.rooms.map((room) => room.id === selectedRoom.id ? { ...room, name: event.target.value } : room) })} /></label><label>Floor area<input readOnly value={`${roomArea(selectedRoom).toFixed(2)} ${areaUnit}`} /></label><label>Floor finish<div className="current-material"><span style={{ background: selectedMaterial?.color }} />{selectedMaterial?.name ?? 'Default'}</div></label></section><section><h3>Room options</h3><label className="ceiling-toggle"><input type="checkbox" checked={selectedRoom.ceilingVisible} onChange={(event) => commit({ ...project, rooms: project.rooms.map((room) => room.id === selectedRoom.id ? { ...room, ceilingVisible: event.target.checked } : room) })} />Show ceiling in 3D</label></section></div>}
          {selectedWall && <div className="properties wall-properties">
            <section className="wall-basic-section"><h3>Basic parameters</h3><div className="wall-basic-row"><span>Total floor area</span><b>{area.toFixed(2)} {areaUnit}</b></div><div className="wall-basic-row"><span>Rooms</span><b>{visibleProject.rooms.length}</b></div></section>
            <section className="wall-settings-section"><h3>Wall settings</h3><div className="wall-fields">
              <label>Size<div className="unit-input"><input readOnly value={distance(selectedWall.start, selectedWall.end).toFixed(2)} /><span>{project.units}</span></div></label>
              <NumericField label="Start X" value={selectedWall.start.x} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => editWallEndpoints(selectedWall.id, { start: { ...selectedWall.start, x: value } })} />
              <NumericField label="Start Y" value={selectedWall.start.y} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => editWallEndpoints(selectedWall.id, { start: { ...selectedWall.start, y: value } })} />
              <NumericField label="End X" value={selectedWall.end.x} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => editWallEndpoints(selectedWall.id, { end: { ...selectedWall.end, x: value } })} />
              <NumericField label="End Y" value={selectedWall.end.y} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => editWallEndpoints(selectedWall.id, { end: { ...selectedWall.end, y: value } })} />
              <NumericField label="Wall height" value={selectedWall.height} unit={lengthUnit} min={0.1 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateWallHeight(project, selectedWall.id, value))} />
              <NumericField label="Thickness" value={selectedWall.thickness} unit={lengthUnit} min={0.05 * metresToProjectUnits} step={0.01 * metresToProjectUnits} onCommit={(value) => commit(updateWallThickness(project, selectedWall.id, value))} />
              <button className="rotate-btn" onClick={splitSelectedWall}><Scissors size={14} /> Split wall at midpoint</button>
              {joinableWallId && <button className="rotate-btn" onClick={joinSelectedWall}><GitMerge size={14} /> Join collinear wall</button>}
              <button className="rotate-btn danger-action wall-delete" onClick={deleteSelected}><Trash2 size={14} /> Delete wall</button>
            </div></section>
          </div>}
          {selectedOpening && <div className="properties"><section><h3>{selectedOpening.kind === 'door' ? 'Door' : 'Window'} opening</h3>
            <NumericField label="Along wall" value={selectedOpening.center} unit={lengthUnit} min={selectedOpening.width / 2} step={0.05 * metresToProjectUnits} onCommit={(value) => editSelectedOpening({ center: value })} />
            <NumericField label="Width" value={selectedOpening.width} unit={lengthUnit} min={0.2 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => editSelectedOpening({ width: value })} />
            <NumericField label="Height" value={selectedOpening.height} unit={lengthUnit} min={0.1 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => editSelectedOpening({ height: value })} />
            {selectedOpening.kind === 'window' && <NumericField label="Sill height" value={selectedOpening.sillHeight} unit={lengthUnit} min={0} step={0.05 * metresToProjectUnits} onCommit={(value) => editSelectedOpening({ sillHeight: value })} />}
            <button className="rotate-btn" onClick={() => setSelectedId(selectedOpening.wallId)}><Building2 size={14} /> Select host wall</button>
            <button className="rotate-btn danger-action" onClick={deleteSelected}><Trash2 size={14} /> Delete opening</button>
          </section></div>}
          {selectedFurniture && <div className="properties"><section><h3>Object transform</h3>
            <NumericField label="Elevation" value={selectedFurniture.elevation} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { elevation: value }))} />
            <NumericField label="Position X" value={selectedFurniture.position.x} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { position: { ...selectedFurniture.position, x: value } }))} />
            <NumericField label="Position Y" value={selectedFurniture.position.y} unit={lengthUnit} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { position: { ...selectedFurniture.position, y: value } }))} />
            <NumericField label="Width" value={selectedFurniture.width} unit={lengthUnit} min={0.01 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { width: value }))} />
            <NumericField label="Depth" value={selectedFurniture.depth} unit={lengthUnit} min={0.01 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { depth: value }))} />
            <NumericField label="Height" value={selectedFurniture.height} unit={lengthUnit} min={0.01 * metresToProjectUnits} step={0.05 * metresToProjectUnits} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { height: value }))} />
            <NumericField label="Rotation X" value={selectedFurniture.rotationX} unit="°" step={1} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { rotationX: value }))} />
            <NumericField label="Rotation Y" value={selectedFurniture.rotation} unit="°" step={1} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { rotation: value }))} />
            <NumericField label="Rotation Z" value={selectedFurniture.rotationZ} unit="°" step={1} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { rotationZ: value }))} />
            <button className="rotate-btn" onClick={rotateSelected}><RotateCw size={15} /> Rotate 45°</button>
            <button className="rotate-btn" onClick={duplicateSelectedFurniture}><Copy size={14} /> Duplicate object</button>
            <button className="rotate-btn" aria-expanded={arraySettingsOpen} onClick={toggleArraySettings}><Copy size={14} /> Linear array</button>
            {arraySettingsOpen && <div className="array-settings" aria-label="Linear array settings">
              <NumericField label="Copies" value={arrayCopies} unit="items" min={1} step={1} onCommit={setArrayCopies} />
              <NumericField label="Spacing X" value={arrayOffsetX} unit={lengthUnit} step={0.1 * metresToProjectUnits} onCommit={setArrayOffsetX} />
              <NumericField label="Spacing Y" value={arrayOffsetY} unit={lengthUnit} step={0.1 * metresToProjectUnits} onCommit={setArrayOffsetY} />
              <div className="array-actions"><button className="array-cancel" onClick={() => setArraySettingsOpen(false)}>Cancel</button><button className="array-apply" onClick={createSelectedFurnitureArray}>Create array</button></div>
              <small>Spacing is applied between each successive copy. Up to 100 copies.</small>
            </div>}
            <button className="rotate-btn" onClick={toggleSelectedFurnitureHidden}>{selectedFurniture.hidden ? <Eye size={14} /> : <EyeOff size={14} />}{selectedFurniture.hidden ? ' Show object' : ' Hide object'}</button>
            <button className="rotate-btn danger-action" onClick={deleteSelected}><Trash2 size={14} /> Delete object</button>
          </section></div>}
          <div className="inspector-foot"><span className={saved ? 'saved' : 'unsaved'}>{saved ? <Check size={13} /> : <i />}{saved ? 'Saved locally' : 'Unsaved changes'}</span><span>{project.units}</span></div>
        </aside>
      </div>
      <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importProject(event.target.files?.[0])} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Rail({ icon, label, active, onClick, disabled = false, title }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; disabled?: boolean; title?: string }) {
  return <button className={`rail-item ${active ? 'active' : ''}`} onClick={onClick} disabled={disabled} title={title} aria-label={label}><span>{icon}</span><small>{label}</small></button>;
}

function previewBounds(project: DesignProject) {
  const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
  const points = [
    ...project.rooms.flatMap((room) => room.points),
    ...project.walls.flatMap((wall) => [wall.start, wall.end]),
    ...project.furniture.map((item) => item.position),
  ];
  if (!points.length) return { minX: -4 * unitsPerMetre, minY: -2 * unitsPerMetre, width: 8 * unitsPerMetre, height: 4 * unitsPerMetre };
  const padding = 0.05 * unitsPerMetre;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const rawMinX = Math.min(...xs) - padding;
  const rawMaxX = Math.max(...xs) + padding;
  const rawMinY = Math.min(...ys) - padding;
  const rawMaxY = Math.max(...ys) + padding;
  const width = Math.max(8 * unitsPerMetre, rawMaxX - rawMinX);
  const height = Math.max(4 * unitsPerMetre, rawMaxY - rawMinY);
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;
  return { minX: centerX - width / 2, minY: centerY - height / 2 - 0.19 * unitsPerMetre, width, height };
}

function MapPreview({ project, view, onSet3d, onSet2d, onSelectRoom }: { project: DesignProject; view: ViewMode; onSet3d: () => void; onSet2d: () => void; onSelectRoom: (roomId: string) => void }) {
  const [openMenu, setOpenMenu] = useState<'view' | 'room' | null>(null);
  const bounds = previewBounds(project);
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
  const fontSize = Math.min(bounds.width, bounds.height) * 0.0875;
  const pointsAttribute = (points: readonly Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
  const center = (points: readonly Point[]): Point => points.reduce(
    (result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  return <div className="mini-map" role="group" aria-label="Floor plan overview">
    <svg className="map-preview" viewBox={viewBox} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect className="map-background" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} />
      {project.rooms.map((room) => <polygon key={room.id} className="map-room" points={pointsAttribute(room.points)} />)}
      {project.walls.map((wall) => <line key={wall.id} className="map-wall" x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} strokeWidth={Math.max(0.05, wall.thickness * 0.55)} />)}
      {project.rooms.map((room) => {
        const centroid = center(room.points);
        const referenceOffset = room.name === 'Living Room' ? { x: 0.28 * unitsPerMetre, y: -0.11 * unitsPerMetre } : { x: 0, y: 0 };
        const label = { x: centroid.x + referenceOffset.x, y: centroid.y + referenceOffset.y };
        const referenceWidth = room.name === 'Lobby' ? 1.149 * unitsPerMetre : room.name === 'Living Room' ? 2.567 * unitsPerMetre : undefined;
        return <text key={`${room.id}-label`} className="map-room-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} textLength={referenceWidth} lengthAdjust={referenceWidth ? 'spacingAndGlyphs' : undefined}>{room.name}</text>;
      })}
    </svg>
    <div className="mini-map-controls">
      <button className="mini-map-control mini-map-view" title="Choose view" aria-haspopup="menu" aria-expanded={openMenu === 'view'} onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}><div>{view === '3d' ? '3D View' : '2D Plan'}</div><ChevronDown size={11} /></button>
      <button className="mini-map-control mini-map-select" title="Select room" aria-haspopup="menu" aria-expanded={openMenu === 'room'} onClick={() => setOpenMenu(openMenu === 'room' ? null : 'room')}><div>Select room</div><ChevronDown size={11} /></button>
      {openMenu === 'view' && <div className="mini-map-menu mini-map-view-menu" role="menu" aria-label="Choose view">
        <button role="menuitem" className={view === 'plan' ? 'selected' : ''} onClick={() => { onSet2d(); setOpenMenu(null); }}>2D Plan</button>
        <button role="menuitem" className={view === '3d' ? 'selected' : ''} onClick={() => { onSet3d(); setOpenMenu(null); }}>3D View</button>
      </div>}
      {openMenu === 'room' && <div className="mini-map-menu mini-map-room-menu" role="menu" aria-label="Select room">
        {project.rooms.map((room) => <button key={room.id} role="menuitem" onClick={() => { onSelectRoom(room.id); setOpenMenu(null); }}>{room.name}</button>)}
      </div>}
    </div>
    <button className="mini-map-switch" title={view === '3d' ? 'Switch to 2D' : 'Switch to 3D'} onClick={view === '3d' ? onSet2d : onSet3d}><div>{view === '3d' ? 'Switch to 2D' : 'Switch to 3D'}</div><ChevronRight size={11} /></button>
  </div>;
}

function NumericField({ label, value, unit, min, step, onCommit }: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  step: number;
  onCommit: (value: number) => void | boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);
  const commitDraft = () => {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next) && (min === undefined || next >= min)) {
      if (!Object.is(next, value) && onCommit(next) === false) setDraft(String(value));
    } else {
      setDraft(String(value));
    }
  };
  return <label>{label}<div className="unit-input"><input ref={inputRef} type="number" value={draft} min={min} step={step} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); } }} /><span>{unit}</span></div></label>;
}
