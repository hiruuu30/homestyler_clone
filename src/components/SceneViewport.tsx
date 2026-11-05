import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { frameProjectCamera } from '../domain/camera';
import { wallSolidSegments } from '../domain/wall-openings';
import type { DesignProject, FloorFinishMapping, Level, Material, Point, Room, SavedCamera, Units } from '../domain/types';
import { ceilingFinishForRoom, floorFinishForRoom, floorPatternSpec } from '../domain/floor-finish';
import { canPlaceFurniture } from '../domain/furniture-placement';
import { snapFurniturePosition } from '../domain/snapping';

export type SceneViewportProps = {
  project: DesignProject;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onMoveFurniture: (id: string, position: Point) => void;
  cameraState: SavedCamera | null;
  onCameraChange: (camera: SavedCamera) => void;
};

function materialColor(project: DesignProject, id: string, fallback: string): string {
  return project.materials.find((material) => material.id === id)?.color ?? fallback;
}

function createFloorPatternTexture(
  room: Room,
  project: Pick<DesignProject, 'units'>,
  material: string,
  mapping: FloorFinishMapping = floorFinishForRoom(room),
): THREE.CanvasTexture | null {
  const spec = floorPatternSpec(room.id, mapping, material, project.units);
  if (!spec) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = spec.baseColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = Math.max(1, spec.strokeWidth / spec.width * canvas.width);
  if (spec.pattern === 'wood') {
    context.strokeStyle = spec.grooveColor;
    context.beginPath();
    context.moveTo(0, 0); context.lineTo(256, 0);
    context.moveTo(0, 128); context.lineTo(256, 128);
    context.moveTo(0, 256); context.lineTo(256, 256);
    context.moveTo(128, 0); context.lineTo(128, 128);
    context.moveTo(0, 128); context.lineTo(0, 256);
    context.moveTo(256, 128); context.lineTo(256, 256);
    context.stroke();
    context.strokeStyle = spec.highlightColor;
    context.lineWidth = Math.max(1, context.lineWidth / 2);
    context.beginPath();
    context.moveTo(0, 2); context.lineTo(256, 2);
    context.moveTo(0, 130); context.lineTo(256, 130);
    context.stroke();
  } else {
    context.strokeStyle = spec.grooveColor;
    context.strokeRect(0, 0, 256, 256);
    context.strokeStyle = spec.highlightColor;
    context.lineWidth = Math.max(1, context.lineWidth / 2);
    context.strokeRect(context.lineWidth, context.lineWidth, 256 - context.lineWidth * 2, 256 - context.lineWidth * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / spec.width, 1 / spec.height);
  texture.offset.set(mapping.offsetX / spec.width, -mapping.offsetY / spec.height);
  texture.rotation = -THREE.MathUtils.degToRad(mapping.rotation);
  texture.center.set(0, 0);
  texture.needsUpdate = true;
  return texture;
}

function polygonShape(points: readonly Point[], holes: readonly (readonly Point[])[] = []): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.y);
    else shape.lineTo(point.x, -point.y);
  });
  shape.closePath();
  holes.forEach((vertices) => {
    const hole = new THREE.Path();
    vertices.forEach((point, index) => {
      if (index === 0) hole.moveTo(point.x, -point.y);
      else hole.lineTo(point.x, -point.y);
    });
    hole.closePath();
    shape.holes.push(hole);
  });
  return shape;
}

export function createRoomFloorGeometry(room: Pick<Room, 'points' | 'holes'>): THREE.ShapeGeometry {
  return new THREE.ShapeGeometry(polygonShape(room.points, room.holes));
}

/** Build the room ceiling outline independently from floor-surface openings. */
export function createRoomCeilingGeometry(room: Pick<Room, 'points'>): THREE.ShapeGeometry {
  return new THREE.ShapeGeometry(polygonShape(room.points));
}

export function ceilingElevationForLevel(level?: Pick<Level, 'elevation' | 'height'>): number {
  return (level?.elevation ?? 0) + (level?.height ?? 2.4);
}

export function createVisibleRoomCeilings(rooms: readonly Room[], elevation: number, materials: readonly Material[] = [], units: Units = 'm'): THREE.Mesh[] {
  if (!Number.isFinite(elevation)) throw new TypeError('ceiling elevation must be finite');
  return rooms.filter((room) => room.ceilingVisible).map((room) => {
    const color = materials.find((material) => material.id === room.ceilingMaterialId)?.color ?? '#faf9f6';
    const texture = createFloorPatternTexture(room, { units }, color, ceilingFinishForRoom(room));
    const material = new THREE.MeshStandardMaterial({
      color: texture ? '#ffffff' : color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      roughness: 0.98,
      ...(texture ? { map: texture } : {}),
    });
    const mesh = new THREE.Mesh(createRoomCeilingGeometry(room), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = elevation;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    return mesh;
  });
}

function addBox(
  scene: THREE.Scene,
  dimensions: [number, number, number],
  position: [number, number, number],
  color: string,
  id: string,
  rotation = 0,
  rotationX = 0,
  rotationZ = 0,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(...dimensions);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(rotationX * (Math.PI / 180), -rotation * (Math.PI / 180), rotationZ * (Math.PI / 180));
  mesh.userData.selectionId = id;
  scene.add(mesh);
  return mesh;
}

export function SceneViewport({ project, selectedId, onSelect, onMoveFurniture, cameraState, onCameraChange }: SceneViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-viewport-canvas';
    host.replaceChildren(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef1f2');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    const activeLevel = project.levels.find((level) => level.id === project.activeLevelId);
    const floorElevation = activeLevel?.elevation ?? 0;
    const ceilingElevation = ceilingElevationForLevel(activeLevel);
    const initialFrame = frameProjectCamera(project, host.clientWidth / Math.max(1, host.clientHeight), camera.fov);
    const target = new THREE.Vector3(
      cameraState?.targetX ?? initialFrame.targetX,
      cameraState?.targetY ?? initialFrame.targetY,
      cameraState?.targetZ ?? initialFrame.targetZ,
    );
    let radius = cameraState?.radius ?? initialFrame.radius;
    let azimuth = cameraState?.azimuth ?? Math.PI / 4;
    let elevation = cameraState?.elevation ?? 0.82;
    let hasCustomCamera = Boolean(cameraState);
    const updateCamera = () => {
      camera.position.set(
        target.x + radius * Math.cos(elevation) * Math.sin(azimuth),
        target.y + radius * Math.sin(elevation),
        target.z + radius * Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.lookAt(target);
    };
    const snapshotCamera = (): SavedCamera => ({
      targetX: target.x, targetY: target.y, targetZ: target.z, radius, azimuth, elevation,
    });
    updateCamera();

    scene.add(new THREE.HemisphereLight('#ffffff', '#8b9298', 2.1));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.6);
    keyLight.position.set(8, 16, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: '#dfe3e4', roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorElevation - 0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    project.rooms.forEach((room) => {
      const geometry = createRoomFloorGeometry(room);
      const color = materialColor(project, room.floorMaterialId, '#c9b8a0');
      const texture = createFloorPatternTexture(room, project, color);
      const material = new THREE.MeshStandardMaterial({
        color: texture ? '#ffffff' : color,
        side: THREE.DoubleSide,
        ...(texture ? { map: texture } : {}),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = floorElevation + 0.01;
      mesh.userData.selectionId = room.id;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    createVisibleRoomCeilings(project.rooms, ceilingElevation, project.materials, project.units).forEach((mesh) => scene.add(mesh));

    project.walls.forEach((wall) => {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const length = Math.hypot(dx, dy);
      const unitX = dx / length;
      const unitY = dy / length;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const openings = project.wallOpenings.filter((opening) => opening.wallId === wall.id);
      wallSolidSegments(length, wall.height, openings).forEach((segment) => {
        const along = (segment.start + segment.end) / 2;
        const segmentHeight = segment.top - segment.bottom;
        const mesh = addBox(
          scene,
          [segment.end - segment.start, segmentHeight, wall.thickness],
          [wall.start.x + unitX * along, floorElevation + (segment.top + segment.bottom) / 2, -(wall.start.y + unitY * along)],
          materialColor(project, wall.materialId, '#d2d0ca'),
          wall.id,
          -angle,
        );
        mesh.castShadow = true;
      });

      openings.forEach((opening) => {
        const centerX = wall.start.x + unitX * opening.center;
        const centerY = wall.start.y + unitY * opening.center;
        const baseY = floorElevation + opening.sillHeight;
        const frame = Math.min(0.07, opening.width * 0.08, opening.height * 0.08);
        const frameDepth = wall.thickness * 1.25;
        const frameColor = opening.kind === 'window' ? '#f7f8f8' : '#ddd2c1';
        const left = addBox(scene, [frame, opening.height, frameDepth], [centerX - unitX * (opening.width / 2 - frame / 2), baseY + opening.height / 2, -(centerY - unitY * (opening.width / 2 - frame / 2))], frameColor, opening.id, -angle);
        const right = addBox(scene, [frame, opening.height, frameDepth], [centerX + unitX * (opening.width / 2 - frame / 2), baseY + opening.height / 2, -(centerY + unitY * (opening.width / 2 - frame / 2))], frameColor, opening.id, -angle);
        const header = addBox(scene, [opening.width, frame, frameDepth], [centerX, baseY + opening.height - frame / 2, -centerY], frameColor, opening.id, -angle);
        left.castShadow = right.castShadow = header.castShadow = true;
        if (opening.kind === 'window') {
          const sill = addBox(scene, [opening.width, frame, frameDepth], [centerX, baseY + frame / 2, -centerY], frameColor, opening.id, -angle);
          sill.castShadow = true;
          const pane = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.02, opening.width - frame * 2), Math.max(0.02, opening.height - frame * 2), 0.025),
            new THREE.MeshStandardMaterial({ color: '#9dd5e6', transparent: true, opacity: 0.38, roughness: 0.22, metalness: 0.05 }),
          );
          pane.position.set(centerX, baseY + opening.height / 2, -centerY);
          pane.rotation.y = angle * (Math.PI / 180);
          pane.userData.selectionId = opening.id;
          scene.add(pane);
        } else {
          const hingeX = centerX - unitX * (opening.width / 2 - frame);
          const hingeY = centerY - unitY * (opening.width / 2 - frame);
          const door = new THREE.Group();
          door.position.set(hingeX, baseY + opening.height / 2, -hingeY);
          door.rotation.y = angle * (Math.PI / 180) + 0.65;
          const leaf = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.04, opening.width - frame), Math.max(0.04, opening.height - frame), Math.max(0.035, wall.thickness * 0.28)),
            new THREE.MeshStandardMaterial({ color: '#c8ad89', roughness: 0.74 }),
          );
          leaf.position.x = (opening.width - frame) / 2;
          leaf.userData.selectionId = opening.id;
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          door.add(leaf);
          scene.add(door);
        }
      });
    });

    project.furniture.filter((item) => !item.hidden).forEach((item) => {
      const mesh = addBox(scene, [item.width, item.height, item.depth], [item.position.x, floorElevation + item.elevation + item.height / 2, -item.position.y], item.color || '#a78362', item.id, item.rotation, item.rotationX, item.rotationZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorElevation);
    let dragging = false;
    let moved = false;
    let movedObject = false;
    let lastX = 0;
    let lastY = 0;
    let dragFurnitureId: string | null = null;
    let dragMesh: THREE.Mesh | null = null;
    let originalPosition: Point | null = null;
    let originalColor: THREE.Color | null = null;
    let dragOffset: Point | null = null;
    let currentPosition: Point | null = null;
    const updatePointerRay = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };
    const floorPoint = (event: PointerEvent): THREE.Vector3 | null => {
      updatePointerRay(event);
      return raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
    };
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      movedObject = false;
      lastX = event.clientX;
      lastY = event.clientY;
      dragFurnitureId = null;
      dragMesh = null;
      originalPosition = null;
      originalColor = null;
      dragOffset = null;
      currentPosition = null;
      canvas.setPointerCapture(event.pointerId);
      updatePointerRay(event);
      const hit = raycaster.intersectObjects(scene.children, true).find((intersection) => Boolean(intersection.object.userData.selectionId));
      const hitId = hit?.object.userData.selectionId as string | undefined;
      const furniture = hitId ? project.furniture.find((item) => item.id === hitId) : undefined;
      const ground = furniture ? floorPoint(event) : null;
      if (furniture && ground && hit) {
        dragFurnitureId = furniture.id;
        dragMesh = hit.object as THREE.Mesh;
        originalPosition = furniture.position;
        originalColor = dragMesh.material instanceof THREE.MeshStandardMaterial ? dragMesh.material.color.clone() : null;
        dragOffset = { x: furniture.position.x - ground.x, y: furniture.position.y + ground.z };
        currentPosition = furniture.position;
        canvas.style.cursor = 'grabbing';
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (dragFurnitureId && dragMesh && dragOffset) {
        const ground = floorPoint(event);
        if (ground) {
          const rawNext = { x: ground.x + dragOffset.x, y: -ground.z + dragOffset.y };
          const next = snapFurniturePosition(rawNext, 0.15 * (project.units === 'ft' ? 1 / 0.3048 : 1), project.units);
          if (originalPosition && Math.hypot(rawNext.x - originalPosition.x, rawNext.y - originalPosition.y) > 0.02) {
            movedObject = true;
            currentPosition = next;
            dragMesh.position.x = next.x;
            dragMesh.position.z = -next.y;
            if (dragMesh.material instanceof THREE.MeshStandardMaterial && originalColor) {
              const valid = canPlaceFurniture(project, dragFurnitureId, next);
              dragMesh.material.color.copy(valid ? originalColor : new THREE.Color('#e78383'));
            }
          }
        }
      } else if (event.buttons === 1) {
        hasCustomCamera = true;
        if (event.shiftKey) {
          camera.updateMatrixWorld();
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
          const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
          const worldPerPixel = (2 * radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, canvas.clientHeight);
          target.addScaledVector(right, -dx * worldPerPixel).addScaledVector(up, dy * worldPerPixel);
        } else {
          azimuth -= dx * 0.008;
          elevation = THREE.MathUtils.clamp(elevation + dy * 0.008, 0.18, 1.45);
        }
        updateCamera();
      }
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const clearDrag = () => {
      dragging = false;
      dragFurnitureId = null;
      dragMesh = null;
      originalPosition = null;
      originalColor = null;
      dragOffset = null;
      currentPosition = null;
      canvas.style.cursor = '';
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const furnitureId = dragFurnitureId;
      const nextPosition = currentPosition;
      const shouldMoveObject = movedObject;
      const shouldSelectByClick = !moved;
      const cameraChanged = moved && !dragFurnitureId;
      const mesh = dragMesh;
      const origin = originalPosition;
      const color = originalColor;
      if (mesh && origin) {
        mesh.position.x = origin.x;
        mesh.position.z = -origin.y;
        if (mesh.material instanceof THREE.MeshStandardMaterial && color) mesh.material.color.copy(color);
      }
      clearDrag();
      if (cameraChanged) onCameraChange(snapshotCamera());
      if (furnitureId) {
        onSelect(furnitureId);
        if (shouldMoveObject && nextPosition) onMoveFurniture(furnitureId, nextPosition);
      } else if (shouldSelectByClick) {
        updatePointerRay(event);
        const hit = raycaster.intersectObjects(scene.children, true).find((intersection) => Boolean(intersection.object.userData.selectionId));
        onSelect(hit?.object.userData.selectionId as string | undefined ?? null);
      }
    };
    const pointerCancel = (event: PointerEvent) => {
      if (!dragging) return;
      const cameraChanged = moved && !dragFurnitureId;
      if (dragMesh && originalPosition) {
        dragMesh.position.x = originalPosition.x;
        dragMesh.position.z = -originalPosition.y;
        if (dragMesh.material instanceof THREE.MeshStandardMaterial && originalColor) dragMesh.material.color.copy(originalColor);
      }
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      clearDrag();
      if (cameraChanged) onCameraChange(snapshotCamera());
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unitsPerMetre = project.units === 'ft' ? 1 / 0.3048 : 1;
      hasCustomCamera = true;
      radius = THREE.MathUtils.clamp(radius * (1 + event.deltaY * 0.001), 5 * unitsPerMetre, 60 * unitsPerMetre);
      updateCamera();
      onCameraChange(snapshotCamera());
    };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('wheel', wheel, { passive: false });

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!hasCustomCamera) radius = frameProjectCamera(project, camera.aspect, camera.fov).radius;
      updateCamera();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.userData.selectionId && mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissive.set(mesh.userData.selectionId === selectedId ? '#3b82f6' : '#000000');
          mesh.material.emissiveIntensity = mesh.userData.selectionId === selectedId ? 0.22 : 0;
        }
      });
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('wheel', wheel);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [project, selectedId, onSelect]);

  return <div ref={hostRef} className="scene-viewport" role="img" aria-label="3D scene viewport" />;
}

export default SceneViewport;
