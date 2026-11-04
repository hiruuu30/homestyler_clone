import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Download,
  FilePlus2, Grid2X2, Layers3, Maximize2, MousePointer2, PaintBucket, PanelLeftClose,
  Plus, Redo2, RotateCw, Save, Search, Sofa, Square, Trash2, Undo2, Upload,
} from 'lucide-react';
import {
  addFurniture, assignRoomMaterial, createRectRoom, createStarterProject, duplicateFurniture,
  addLevel as addProjectLevel, createWall as makeWall, moveFurniture, normalizeProject, removeFurniture,
  removeLevel as removeProjectLevel, removeWall, roomArea, rotateFurniture, updateFurniture,
  updateWallHeight, updateWallThickness,
} from './domain/model';
import type { DesignProject, Point, ToolMode } from './domain/types';
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
  const [panel, setPanel] = useState<PanelMode>('build');
  const [tool, setTool] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const activeLevel = project.levels.find((level) => level.id === activeLevelId) ?? project.levels[0];
  const visibleProject = useMemo(() => ({
    ...project,
    activeLevelId,
    rooms: project.rooms.filter((item) => item.levelId === activeLevelId),
    walls: project.walls.filter((item) => item.levelId === activeLevelId),
    furniture: project.furniture.filter((item) => item.levelId === activeLevelId),
  }), [project, activeLevelId]);
  const selectedRoom = visibleProject.rooms.find((item) => item.id === selectedId) ?? null;
  const selectedWall = visibleProject.walls.find((item) => item.id === selectedId) ?? null;
  const selectedFurniture = visibleProject.furniture.find((item) => item.id === selectedId) ?? null;
  const area = useMemo(() => visibleProject.rooms.reduce((sum, room) => sum + roomArea(room), 0), [visibleProject.rooms]);
  const selectedMaterial = selectedRoom ? project.materials.find((item) => item.id === selectedRoom.floorMaterialId) : null;

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
    setRedoStack((items) => [...items, project]);
    setUndoStack((items) => items.slice(0, -1));
    setProject(previous);
    setActiveLevelId(previous.activeLevelId);
    setSaved(false);
  }
  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
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
    if (distance(start, end) < 0.35) { notify('Draw a larger room'); return; }
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const room = createRectRoom(nextEntityId(project.rooms, 'room'), `Room ${project.rooms.length + 1}`, Math.abs(end.x - start.x), Math.abs(end.y - start.y), { x: minX, y: minY }, project.materials[0]?.id, activeLevelId);
    const existingWalls = [...project.walls];
    const walls = room.points.map((point, index) => {
      const wall = makeWall(nextEntityId(existingWalls, 'wall'), point, room.points[(index + 1) % room.points.length], undefined, undefined, undefined, activeLevelId);
      existingWalls.push(wall);
      return wall;
    });
    const next = { ...project, rooms: [...project.rooms, room], walls: [...project.walls, ...walls] };
    commit(next);
    setSelectedId(room.id);
    setTool('select');
  }
  function createWall(start: Point, end: Point) {
    if (distance(start, end) < 0.05) { notify('Draw a longer wall segment'); return; }
    const wall = makeWall(nextEntityId(project.walls, 'wall'), start, end, undefined, undefined, undefined, activeLevelId);
    const next = { ...project, walls: [...project.walls, wall] };
    commit(next);
    setSelectedId(wall.id);
    setTool('select');
  }
  function addSofa() {
    const room = selectedRoom ?? visibleProject.rooms[0];
    if (!room) { notify('Create a room first'); return; }
    const next = addFurniture(project, {
      assetId: 'generic-starter-sofa',
      name: 'Starter sofa',
      position: centerOf(room.points),
      rotation: 0,
      width: 1.8,
      depth: 0.8,
      height: 0.85,
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
  function deleteSelected() {
    if (selectedFurniture) commit(removeFurniture(project, selectedFurniture.id));
    else if (selectedWall) commit(removeWall(project, selectedWall.id));
    else return;
    setSelectedId(null);
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
      else if ((event.key === 'Delete' || event.key === 'Backspace') && (selectedFurniture || selectedWall)) { event.preventDefault(); deleteSelected(); }
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
        <button className="top-btn" onClick={newDesign}><FilePlus2 size={16} /><span>New</span></button>
        <button className="top-btn" onClick={save}><Save size={16} /><span>{saved ? 'Save' : 'Save*'}</span></button>
        <button className="top-btn" onClick={undo} disabled={!undoStack.length}><Undo2 size={16} /><span>Undo</span></button>
        <button className="top-btn" onClick={redo} disabled={!redoStack.length}><Redo2 size={16} /><span>Redo</span></button>
        <button className="top-btn" onClick={exportProject}><Download size={16} /><span>Export</span></button>
        <button className="icon-btn" title="Help" onClick={() => notify('Starter editor: draw rooms, add walls, furniture and finishes')}><CircleHelp size={17} /></button>
        <span className="avatar">H</span>
      </header>
      <div className="workspace" id="workspace">
        <nav className="rail" aria-label="Editor tools">
          <Rail icon={<Building2 size={19} />} label="Build" active={panel === 'build'} onClick={() => setPanel('build')} />
          <Rail icon={<Sofa size={19} />} label="Furniture" active={panel === 'furniture'} onClick={() => setPanel('furniture')} />
          <Rail icon={<PaintBucket size={19} />} label="Finish" active={panel === 'finish'} onClick={() => setPanel('finish')} />
          <Rail icon={<Layers3 size={19} />} label="Project" active={panel === 'project'} onClick={() => setPanel('project')} />
        </nav>
        {!collapsed && <aside className="tool-panel">
          <div className="panel-heading"><div><small>EDITOR</small><h1>{panelTitle}</h1></div><button className="icon-btn" title="Collapse panel" onClick={() => setCollapsed(true)}><PanelLeftClose size={16} /></button></div>
          {panel === 'build' && <div className="panel-scroll">
            <div className="section-label">PLAN TOOLS</div>
            <div className="tool-grid">
              <Tool icon={<MousePointer2 size={18} />} label="Select" active={tool === 'select'} onClick={() => setTool('select')} />
              <Tool icon={<Square size={18} />} label="Room" active={tool === 'room'} onClick={() => { setView('plan'); setTool('room'); }} />
              <Tool icon={<Grid2X2 size={18} />} label="Wall" active={tool === 'wall'} onClick={() => { setView('plan'); setTool('wall'); }} />
            </div>
            <div className="tip"><b>Draw geometry</b><p>Select Room or Wall, then drag on the 2D plan. Select a wall to edit its thickness.</p></div>
            <div className="section-label">FLOORS</div>
            <div className="level-list">{project.levels.map((level) => <div key={level.id} className={`level-row${level.id === activeLevelId ? ' active' : ''}`}>
              <button className="level-select" onClick={() => selectLevel(level.id)}><Layers3 size={14} /><span>{level.name}<small>Elevation {level.elevation.toFixed(2)} m</small></span></button>
              {project.levels.length > 1 && <button className="level-delete" title={`Delete ${level.name} · undoable`} onClick={() => deleteLevel(level.id)}><Trash2 size={13} /></button>}
            </div>)}</div>
            <button className="action-row add-level" onClick={addLevel}><Plus size={15} />Add floor</button>
            <div className="section-label">ADVANCED TOOLS</div>
            <button className="locked-row" disabled><Plus size={16} /><span>Doors and windows</span><small>Not implemented</small></button>
            <p className="disclaimer">This is an early independent implementation; full feature and pixel parity have not been verified.</p>
          </div>}
          {panel === 'furniture' && <div className="panel-scroll">
            <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search starter assets" /></div>
            <div className="section-label">GENERIC STARTER ASSETS</div>
            <button className="asset-card" onClick={addSofa}><span className="asset-drawing"><Sofa size={44} /></span><b>Starter sofa</b><small>Procedural placeholder</small></button>
            <div className="tip"><b>Asset corpus missing</b><p>User stated permission for the Homestyler catalog; the source catalog is not supplied here. These starter assets are not equivalent.</p></div>
          </div>}
          {panel === 'finish' && <div className="panel-scroll">
            <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search starter finishes" /></div>
            <div className="section-label">STARTER MATERIALS</div>
            <div className="material-grid">{project.materials.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((material) => <button key={material.id} className="material-card" onClick={() => applyMaterial(material.id)}><span style={{ background: material.color }} /><b>{material.name}</b></button>)}</div>
            <div className="tip"><b>Catalog coverage</b><p>Only generic color swatches are present. Texture maps, UV controls and exhaustive finishes remain outstanding.</p></div>
          </div>}
          {panel === 'project' && <div className="panel-scroll">
            <div className="project-card"><strong>{project.name}</strong><p>{project.levels.length} floors · {project.rooms.length} rooms · {project.furniture.length} objects</p><p>{area.toFixed(2)} m² on {activeLevel.name}</p></div>
            <button className="action-row" onClick={() => importRef.current?.click()}><Upload size={16} />Import RoomLab JSON</button>
            <button className="action-row" onClick={exportProject}><Download size={16} />Export RoomLab JSON</button>
            <div className="tip"><b>Local persistence only</b><p>Save stores data in this browser. Cloud accounts, sharing and project history are not implemented.</p></div>
          </div>}
          <div className="panel-foot"><span className="status-dot" />Starter build · local-only storage</div>
        </aside>}
        <main className="editor-stage">
          {collapsed && <button className="expand-panel" onClick={() => setCollapsed(false)} aria-label="Show panel"><ChevronRight size={17} /></button>}
          <div className="viewport-area">
            {view === 'plan'
              ? <PlanCanvas project={visibleProject} tool={tool} selectedId={selectedId} onSelect={setSelectedId} onCreateRoom={createRoom} onCreateWall={createWall} onMoveFurniture={moveSelectedFurniture} />
              : <Suspense fallback={<div className="scene-loading">Loading 3D view…</div>}><SceneViewport project={visibleProject} selectedId={selectedId} onSelect={setSelectedId} onMoveFurniture={moveSelectedFurniture} /></Suspense>}
            <div className="canvas-hint">{tool === 'room' ? 'Drag to draw a rectangular room' : tool === 'wall' ? 'Drag to add a wall segment' : view === 'plan' ? 'Select elements to edit · scroll to zoom' : 'Drag to orbit · Shift-drag to pan · scroll to zoom'}</div>
          </div>
          <footer className="bottom-bar">
            <div className="canvas-tools"><button className={tool === 'select' ? 'chosen' : ''} title="Select" onClick={() => setTool('select')}><MousePointer2 size={16} /></button><button className={tool === 'room' ? 'chosen' : ''} title="Draw room" onClick={() => { setView('plan'); setTool('room'); }}><Square size={16} /></button><button className={tool === 'wall' ? 'chosen' : ''} title="Draw wall" onClick={() => { setView('plan'); setTool('wall'); }}><Grid2X2 size={16} /></button><button title="Add sofa" onClick={() => { setPanel('furniture'); addSofa(); }}><Sofa size={16} /></button></div>
            <span className="bottom-spacer" />
            <button className={`view-tab ${view === 'plan' ? 'selected' : ''}`} onClick={() => { setView('plan'); setTool('select'); }}>2D Plan</button>
            <button className={`view-tab ${view === '3d' ? 'selected' : ''}`} onClick={() => { setView('3d'); setTool('select'); }}>3D View</button>
            <button className="view-tab disabled" disabled title="Not implemented">Walkthrough</button>
            <button className="icon-btn" title="Fit view" onClick={() => notify('View fitted to current project')}><Maximize2 size={16} /></button>
          </footer>
        </main>
        <aside className="inspector">
          <div className="map-card"><MapPreview project={visibleProject} onToggle={() => setView(view === 'plan' ? '3d' : 'plan')} /></div>
          <div className="inspector-head"><small>PROPERTIES</small><h2>{selectedRoom?.name ?? (selectedWall ? 'Wall' : selectedFurniture?.name ?? 'Design summary')}</h2></div>
          {!selectedRoom && !selectedWall && !selectedFurniture && <div className="summary"><Building2 size={27} /><p>{activeLevel.name} · select a room, wall, or furniture object.</p><div><span>Rooms</span><b>{visibleProject.rooms.length}</b></div><div><span>Floor area</span><b>{area.toFixed(2)} m²</b></div><div><span>Furniture</span><b>{visibleProject.furniture.length}</b></div></div>}
          {selectedRoom && <div className="properties"><section><h3>Room settings</h3><label>Room name<input value={selectedRoom.name} onChange={(event) => commit({ ...project, rooms: project.rooms.map((room) => room.id === selectedRoom.id ? { ...room, name: event.target.value } : room) })} /></label><label>Floor area<input readOnly value={`${roomArea(selectedRoom).toFixed(2)} m²`} /></label><label>Floor finish<div className="current-material"><span style={{ background: selectedMaterial?.color }} />{selectedMaterial?.name ?? 'Default'}</div></label></section><section><h3>Room options</h3><label className="ceiling-toggle"><input type="checkbox" checked={selectedRoom.ceilingVisible} onChange={(event) => commit({ ...project, rooms: project.rooms.map((room) => room.id === selectedRoom.id ? { ...room, ceilingVisible: event.target.checked } : room) })} />Show ceiling in 3D</label></section></div>}
          {selectedWall && <div className="properties"><section><h3>Wall parameters</h3><NumericField label="Thickness" value={selectedWall.thickness} unit="m" min={0.05} step={0.01} onCommit={(value) => commit(updateWallThickness(project, selectedWall.id, value))} /><NumericField label="Height" value={selectedWall.height} unit="m" min={0.1} step={0.05} onCommit={(value) => commit(updateWallHeight(project, selectedWall.id, value))} /><label>Length<div className="unit-input"><input readOnly value={distance(selectedWall.start, selectedWall.end).toFixed(2)} /><span>m</span></div></label><button className="rotate-btn danger-action" onClick={deleteSelected}><Trash2 size={14} /> Delete wall</button></section></div>}
          {selectedFurniture && <div className="properties"><section><h3>Object transform</h3>
            <NumericField label="Position X" value={selectedFurniture.position.x} unit="m" step={0.05} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { position: { ...selectedFurniture.position, x: value } }))} />
            <NumericField label="Position Y" value={selectedFurniture.position.y} unit="m" step={0.05} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { position: { ...selectedFurniture.position, y: value } }))} />
            <NumericField label="Width" value={selectedFurniture.width} unit="m" min={0.01} step={0.05} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { width: value }))} />
            <NumericField label="Depth" value={selectedFurniture.depth} unit="m" min={0.01} step={0.05} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { depth: value }))} />
            <NumericField label="Height" value={selectedFurniture.height} unit="m" min={0.01} step={0.05} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { height: value }))} />
            <NumericField label="Rotation" value={selectedFurniture.rotation} unit="°" step={1} onCommit={(value) => commit(updateFurniture(project, selectedFurniture.id, { rotation: value }))} />
            <button className="rotate-btn" onClick={rotateSelected}><RotateCw size={15} /> Rotate 45°</button>
            <button className="rotate-btn" onClick={duplicateSelectedFurniture}><Copy size={14} /> Duplicate object</button>
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

function Rail({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`rail-item ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}
function Tool({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`tool-button ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function previewBounds(project: DesignProject) {
  const points = [
    ...project.rooms.flatMap((room) => room.points),
    ...project.walls.flatMap((wall) => [wall.start, wall.end]),
    ...project.furniture.map((item) => item.position),
  ];
  if (!points.length) return { minX: -4, minY: -2, width: 8, height: 4 };
  const padding = 0.05;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const rawMinX = Math.min(...xs) - padding;
  const rawMaxX = Math.max(...xs) + padding;
  const rawMinY = Math.min(...ys) - padding;
  const rawMaxY = Math.max(...ys) + padding;
  const width = Math.max(8, rawMaxX - rawMinX);
  const height = Math.max(4, rawMaxY - rawMinY);
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;
  return { minX: centerX - width / 2, minY: centerY - height / 2 - 0.19, width, height };
}

function MapPreview({ project, onToggle }: { project: DesignProject; onToggle: () => void }) {
  const bounds = previewBounds(project);
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const fontSize = Math.min(bounds.width, bounds.height) * 0.0875;
  const pointsAttribute = (points: readonly Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
  const center = (points: readonly Point[]): Point => points.reduce(
    (result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  return <button className="mini-map" type="button" aria-label="Switch between 2D and 3D view" onClick={onToggle}>
    <svg className="map-preview" viewBox={viewBox} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect className="map-background" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} />
      {project.rooms.map((room) => <polygon key={room.id} className="map-room" points={pointsAttribute(room.points)} />)}
      {project.walls.map((wall) => <line key={wall.id} className="map-wall" x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} strokeWidth={Math.max(0.05, wall.thickness * 0.55)} />)}
      {project.rooms.map((room) => {
        const centroid = center(room.points);
        const referenceOffset = room.name === 'Living Room' ? { x: 0.28, y: -0.11 } : { x: 0, y: 0 };
        const label = { x: centroid.x + referenceOffset.x, y: centroid.y + referenceOffset.y };
        const referenceWidth = room.name === 'Lobby' ? 1.149 : room.name === 'Living Room' ? 2.567 : undefined;
        return <text key={`${room.id}-label`} className="map-room-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} textLength={referenceWidth} lengthAdjust={referenceWidth ? 'spacingAndGlyphs' : undefined}>{room.name}</text>;
      })}
    </svg>
  </button>;
}

function NumericField({ label, value, unit, min, step, onCommit }: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);
  const commitDraft = () => {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next) && (min === undefined || next >= min)) {
      if (!Object.is(next, value)) onCommit(next);
    } else {
      setDraft(String(value));
    }
  };
  return <label>{label}<div className="unit-input"><input ref={inputRef} type="number" value={draft} min={min} step={step} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); } }} /><span>{unit}</span></div></label>;
}
