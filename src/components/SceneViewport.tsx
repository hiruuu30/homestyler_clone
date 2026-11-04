import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { frameProjectCamera } from '../domain/camera';
import type { DesignProject, Point } from '../domain/types';

export type SceneViewportProps = {
  project: DesignProject;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onMoveFurniture: (id: string, position: Point) => void;
};

function materialColor(project: DesignProject, id: string, fallback: string): string {
  return project.materials.find((material) => material.id === id)?.color ?? fallback;
}

function polygonShape(points: readonly Point[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.y);
    else shape.lineTo(point.x, -point.y);
  });
  shape.closePath();
  return shape;
}

function addBox(
  scene: THREE.Scene,
  dimensions: [number, number, number],
  position: [number, number, number],
  color: string,
  id: string,
  rotation = 0,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(...dimensions);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = -rotation * (Math.PI / 180);
  mesh.userData.selectionId = id;
  scene.add(mesh);
  return mesh;
}

export function SceneViewport({ project, selectedId, onSelect, onMoveFurniture }: SceneViewportProps) {
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
    const floorElevation = project.levels.find((level) => level.id === project.activeLevelId)?.elevation ?? 0;
    const initialFrame = frameProjectCamera(project, host.clientWidth / Math.max(1, host.clientHeight), camera.fov);
    const target = new THREE.Vector3(initialFrame.targetX, initialFrame.targetY, initialFrame.targetZ);
    let radius = initialFrame.radius;
    let azimuth = Math.PI / 4;
    let elevation = 0.82;
    const updateCamera = () => {
      camera.position.set(
        target.x + radius * Math.cos(elevation) * Math.sin(azimuth),
        target.y + radius * Math.sin(elevation),
        target.z + radius * Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.lookAt(target);
    };
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
      const geometry = new THREE.ShapeGeometry(polygonShape(room.points));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: materialColor(project, room.floorMaterialId, '#c9b8a0'), side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = floorElevation + 0.01;
      mesh.userData.selectionId = room.id;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    project.walls.forEach((wall) => {
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.y - wall.start.y;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      addBox(
        scene,
        [length, wall.height, wall.thickness],
        [(wall.start.x + wall.end.x) / 2, floorElevation + wall.height / 2, -(wall.start.y + wall.end.y) / 2],
        materialColor(project, wall.materialId, '#d2d0ca'),
        wall.id,
        -angle * (180 / Math.PI),
      ).castShadow = true;
    });

    project.furniture.forEach((item) => {
      const mesh = addBox(scene, [item.width, item.height, item.depth], [item.position.x, floorElevation + item.height / 2, -item.position.y], item.color || '#a78362', item.id, item.rotation);
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
          const next = { x: ground.x + dragOffset.x, y: -ground.z + dragOffset.y };
          if (originalPosition && Math.hypot(next.x - originalPosition.x, next.y - originalPosition.y) > 0.02) {
            movedObject = true;
            currentPosition = next;
            dragMesh.position.x = next.x;
            dragMesh.position.z = -next.y;
          }
        }
      } else if (event.buttons === 1) {
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
      clearDrag();
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
      if (dragMesh && originalPosition) {
        dragMesh.position.x = originalPosition.x;
        dragMesh.position.z = -originalPosition.y;
      }
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      clearDrag();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      radius = THREE.MathUtils.clamp(radius * (1 + event.deltaY * 0.001), 5, 60);
      updateCamera();
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
      radius = frameProjectCamera(project, camera.aspect, camera.fov).radius;
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
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [project, selectedId, onSelect]);

  return <div ref={hostRef} className="scene-viewport" role="img" aria-label="3D scene viewport" />;
}

export default SceneViewport;
