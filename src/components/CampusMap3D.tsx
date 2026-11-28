import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Compass, Eye, Pause, Play, RotateCcw } from 'lucide-react';
import { CAMPUS_ZONES, CampusItem, CampusZoneId } from '../types/reclaim';

interface CampusMap3DProps {
  items: CampusItem[];
  onInspectZoneItems: (zoneId: CampusZoneId) => void;
  onSelectItemForClaim: (item: CampusItem) => void;
}

// Module-scope scratch objects (zero per-frame GC allocation)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpMat4 = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createProceduralLawnTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6c9c66';
  ctx.fillRect(0, 0, size, size);

  // Subtle organic turf variation (seeded deterministic pattern)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.5;
    ctx.fillStyle = rand() > 0.48 ? 'rgba(54, 98, 56, 0.30)' : 'rgba(142, 189, 130, 0.28)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createStonePavingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b4c1cf';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(100, 116, 139, 0.52)';
  ctx.lineWidth = 2;
  const step = 32;
  for (let y = 0; y < size; y += step) {
    const offset = (y / step) % 2 === 0 ? 0 : step / 2;
    for (let x = -step; x < size + step; x += step) {
      ctx.strokeRect(x + offset, y, step, step);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.14)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds composite 5-10 part procedural university buildings pivoted at bottom-center (y = 0).
 */
function createCampusBuildingGroup(
  zoneId: CampusZoneId,
  materials: {
    sandstone: THREE.MeshStandardMaterial;
    limestone: THREE.MeshStandardMaterial;
    brick: THREE.MeshStandardMaterial;
    slateMetal: THREE.MeshStandardMaterial;
    roofTrim: THREE.MeshStandardMaterial;
    glass: THREE.MeshPhysicalMaterial;
    plinth: THREE.MeshStandardMaterial;
    copper: THREE.MeshStandardMaterial;
    shadowMat: THREE.MeshBasicMaterial;
  }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `building-${zoneId}`;

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    cast = true
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Grounding contact shadow disc
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 28), materials.shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.055;
  group.add(shadowDisc);

  if (zoneId === 'main-library') {
    // 1. Foundation plinth + steps
    addBox(12.2, 0.7, 9.2, 0, 0.35, 0, materials.plinth);
    addBox(6.4, 0.35, 1.4, 0, 0.18, 5.1, materials.plinth);
    // 2. Main sandstone reading hall
    addBox(11.0, 4.4, 7.6, 0, 2.9, 0, materials.sandstone);
    // 3. Cornice overhang
    addBox(11.6, 0.45, 8.2, 0, 5.3, 0, materials.roofTrim);
    // 4. Recessed glazed facade band
    addBox(9.2, 2.5, 7.8, 0, 3.0, 0, materials.glass, false);
    // 5. Classical portico columns (4 distinct cylinders)
    const colGeo = new THREE.CylinderGeometry(0.24, 0.28, 4.2, 12);
    for (const cx of [-3.0, -1.0, 1.0, 3.0]) {
      const col = new THREE.Mesh(colGeo, materials.limestone);
      col.position.set(cx, 2.8, 4.4);
      col.castShadow = true;
      group.add(col);
    }
    // 6. Portico pediment lintel
    addBox(7.2, 0.65, 1.5, 0, 5.1, 4.4, materials.limestone);
    // 7. Rooftop octagonal drum + copper-slate cupola dome (LatheGeometry)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 1.2, 8), materials.limestone);
    drum.position.set(0, 6.1, -0.2);
    drum.castShadow = true;
    group.add(drum);
    const domePoints = [
      new THREE.Vector2(2.05, 0),
      new THREE.Vector2(1.9, 0.7),
      new THREE.Vector2(1.3, 1.45),
      new THREE.Vector2(0.45, 1.85),
      new THREE.Vector2(0.05, 2.15),
    ];
    const dome = new THREE.Mesh(new THREE.LatheGeometry(domePoints, 16), materials.copper);
    dome.position.set(0, 6.7, -0.2);
    dome.castShadow = true;
    group.add(dome);
  } else if (zoneId === 'science-hall') {
    // 1. Modern podium
    addBox(13.0, 0.6, 8.6, 0, 0.3, 0, materials.plinth);
    // 2. Twin laboratory wings
    addBox(4.4, 4.8, 7.4, -3.7, 3.0, 0, materials.limestone);
    addBox(4.4, 4.8, 7.4, 3.7, 3.0, 0, materials.limestone);
    // 3. Central cantilevered glass atrium bridge
    addBox(3.4, 4.1, 6.2, 0, 2.65, 0.2, materials.glass, false);
    addBox(3.6, 0.35, 6.6, 0, 4.85, 0.2, materials.slateMetal);
    // 4. Horizontal lab window bands
    addBox(4.56, 0.9, 5.8, -3.7, 2.2, 0, materials.glass, false);
    addBox(4.56, 0.9, 5.8, -3.7, 4.0, 0, materials.glass, false);
    addBox(4.56, 0.9, 5.8, 3.7, 2.2, 0, materials.glass, false);
    addBox(4.56, 0.9, 5.8, 3.7, 4.0, 0, materials.glass, false);
    // 5. Observatory dome on east wing
    const obsBase = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.75, 0.85, 18), materials.slateMetal);
    obsBase.position.set(3.7, 5.8, -0.8);
    group.add(obsBase);
    const obsDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.roofTrim
    );
    obsDome.position.set(3.7, 6.2, -0.8);
    obsDome.castShadow = true;
    group.add(obsDome);
  } else if (zoneId === 'student-union') {
    // 1. Stone patio plinth
    addBox(12.0, 0.5, 9.2, 0, 0.25, 0, materials.plinth);
    // 2. Warm collegiate brick volume
    addBox(10.6, 3.8, 7.4, 0, 2.4, -0.3, materials.brick);
    // 3. Pitched gabled roof via ExtrudeGeometry
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-5.7, 0);
    gableShape.lineTo(0, 2.4);
    gableShape.lineTo(5.7, 0);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: 7.8,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    gableGeo.translate(0, 0, -3.9);
    const gableRoof = new THREE.Mesh(gableGeo, materials.slateMetal);
    gableRoof.position.set(0, 4.3, -0.3);
    gableRoof.castShadow = true;
    group.add(gableRoof);
    // 4. Front dining pavilion glass & awning
    addBox(6.8, 2.4, 2.0, 0, 1.7, 3.5, materials.glass, false);
    addBox(7.4, 0.28, 2.5, 0, 3.0, 3.6, materials.roofTrim);
    // 5. Entry side brick piers
    addBox(0.7, 3.0, 0.7, -3.5, 1.75, 4.4, materials.brick);
    addBox(0.7, 3.0, 0.7, 3.5, 1.75, 4.4, materials.brick);
  } else if (zoneId === 'engineering-lab') {
    // 1. Concrete workshop slab
    addBox(12.6, 0.55, 8.6, 0, 0.275, 0, materials.plinth);
    // 2. Main steel-and-limestone maker studio
    addBox(11.4, 4.0, 7.4, 0, 2.55, 0, materials.limestone);
    // 3. Sawtooth north-light roof bays (3 extruded wedges)
    const tooth = new THREE.Shape();
    tooth.moveTo(0, 0);
    tooth.lineTo(3.4, 0);
    tooth.lineTo(3.4, 1.55);
    tooth.closePath();
    const toothGeo = new THREE.ExtrudeGeometry(tooth, { depth: 7.2, bevelEnabled: false });
    toothGeo.translate(0, 0, -3.6);
    for (let i = 0; i < 3; i++) {
      const bay = new THREE.Mesh(toothGeo, materials.slateMetal);
      bay.position.set(-5.1 + i * 3.4, 4.55, 0);
      bay.castShadow = true;
      group.add(bay);
    }
    // 4. Tall industrial glazing along front facade
    addBox(9.8, 2.6, 7.56, 0, 2.5, 0, materials.glass, false);
    // 5. Brushed aluminum canopy & framing ribs
    addBox(4.6, 0.24, 1.9, 0, 3.2, 4.4, materials.slateMetal);
    for (const rx of [-3.6, 0, 3.6]) {
      addBox(0.32, 4.1, 7.72, rx, 2.6, 0, materials.slateMetal);
    }
  } else if (zoneId === 'athletics-complex') {
    // 1. Terrace foundation
    addBox(14.0, 0.55, 9.2, 0, 0.275, 0, materials.plinth);
    // 2. Arena body
    addBox(12.8, 3.6, 7.8, 0, 2.35, 0, materials.sandstone);
    // 3. Curved barrel-vault roof
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(4.1, 4.1, 13.0, 18, 1, false, 0, Math.PI),
      materials.slateMetal
    );
    vault.rotation.z = Math.PI / 2;
    vault.rotation.y = Math.PI / 2;
    vault.scale.set(1, 0.45, 1);
    vault.position.set(0, 4.15, 0);
    vault.castShadow = true;
    group.add(vault);
    // 4. Exterior structural buttresses
    for (const bx of [-5.2, -2.6, 0, 2.6, 5.2]) {
      addBox(0.45, 3.8, 8.4, bx, 2.45, 0, materials.limestone);
    }
    // 5. Clerestory window strip
    addBox(11.8, 1.1, 7.96, 0, 3.1, 0, materials.glass, false);
  } else {
    // commons-quad: Central Clock Tower Landmark + Octagonal Stone Pavilion
    shadowDisc.scale.set(0.85, 0.85, 1);
    const baseOct = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.42, 8), materials.plinth);
    baseOct.position.y = 0.21;
    baseOct.receiveShadow = true;
    group.add(baseOct);

    // Tall signature Collegiate Clock Tower (tall landmark framed in initial spawn camera)
    addBox(2.8, 1.4, 2.8, 0, 1.1, 0, materials.limestone);
    addBox(2.2, 7.8, 2.2, 0, 5.7, 0, materials.sandstone);
    // Clock faces (high-contrast metallic bezel + glass face)
    addBox(2.38, 1.5, 1.5, 0, 8.2, 0, materials.glass, false);
    addBox(1.5, 1.5, 2.38, 0, 8.2, 0, materials.glass, false);
    // Belfry cornice & bronze spire
    addBox(2.7, 0.45, 2.7, 0, 9.8, 0, materials.roofTrim);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.55, 3.6, 4), materials.copper);
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 11.8;
    spire.castShadow = true;
    group.add(spire);
    // Animated golden spire finial landmark
    const finial = new THREE.Group();
    finial.name = 'clock-finial';
    finial.position.y = 14.0;
    const finialMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.24,
      metalness: 0.85,
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), finialMat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.14), finialMat);
    bar.position.y = 0.28;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), finialMat);
    tip.position.y = 0.65;
    finial.add(rod, bar, tip);
    group.add(finial);
    // Quad stone benches around the clock tower
    for (const [bx, bz, rot] of [
      [-3.5, 0, Math.PI / 2],
      [3.5, 0, Math.PI / 2],
      [0, 3.5, 0],
      [0, -3.5, 0],
    ]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.65), materials.limestone);
      bench.position.set(bx, 0.64, bz);
      bench.rotation.y = rot;
      bench.castShadow = true;
      group.add(bench);
    }
  }

  return group;
}

export const CampusMap3D: React.FC<CampusMap3DProps> = ({
  items,
  onInspectZoneItems,
  onSelectItemForClaim,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [selectedZone, setSelectedZone] = useState<CampusZoneId>('commons-quad');
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [dockOpen, setDockOpen] = useState(true);
  const [hoveredZone, setHoveredZone] = useState<CampusZoneId | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(false);

  // Refs bridging React state into the single-mount Three.js lifecycle without tearing down the canvas
  const itemsRef = useRef<CampusItem[]>(items);
  const filterRef = useRef(filterType);
  const autoOrbitRef = useRef(autoOrbit);
  const selectZoneRef = useRef<(zone: CampusZoneId) => void>(() => {});
  const focusZoneRef = useRef<(zone: CampusZoneId | 'overview') => void>(() => {});
  const rebuildBeaconsRef = useRef<() => void>(() => {});

  itemsRef.current = items;
  filterRef.current = filterType;
  autoOrbitRef.current = autoOrbit;
  selectZoneRef.current = (zone: CampusZoneId) => setSelectedZone(zone);

  const zoneCounts = useMemo(() => {
    const map: Record<CampusZoneId, { lost: number; found: number }> = {
      'main-library': { lost: 0, found: 0 },
      'science-hall': { lost: 0, found: 0 },
      'student-union': { lost: 0, found: 0 },
      'engineering-lab': { lost: 0, found: 0 },
      'athletics-complex': { lost: 0, found: 0 },
      'commons-quad': { lost: 0, found: 0 },
    };
    for (const item of items) {
      if (item.status === 'returned' || item.status === 'archived') continue;
      if (item.type === 'lost') map[item.campusZone].lost += 1;
      else map[item.campusZone].found += 1;
    }
    return map;
  }, [items]);

  const selectedZoneMeta = useMemo(
    () => CAMPUS_ZONES.find((z) => z.id === selectedZone) ?? CAMPUS_ZONES[0],
    [selectedZone]
  );

  const selectedZoneItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.campusZone === selectedZone &&
        i.status !== 'archived' &&
        (filterType === 'all' || i.type === filterType)
    );
  }, [items, selectedZone, filterType]);

  // Keyboard shortcut 'H' to toggle Zen/Cinema mode dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Re-sync 3D item beacons whenever items or filter changes
  useEffect(() => {
    rebuildBeaconsRef.current();
  }, [items, filterType]);

  // Mount Three.js scene strictly ONCE
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isSoftwareGl && !prefersReducedMotion) {
      autoOrbitRef.current = true;
      setAutoOrbit(true);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 680;
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color('#cce3fc');
    scene.background = skyColor;
    scene.fog = new THREE.Fog('#cce3fc', 68, 152);

    // Mandatory studio environment reflections (RoomEnvironment) on every device
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 220);
    const overviewCamPos = new THREE.Vector3(34, 28, 44);
    const overviewTarget = new THREE.Vector3(0, 2, 2);
    camera.position.copy(overviewCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(overviewTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.minPolarAngle = 0.25;
    controls.minDistance = 14;
    controls.maxDistance = 82;
    controls.update();

    // Balanced 3-point warm/cool outdoor campus lighting rig (1 shadow caster)
    const hemiLight = new THREE.HemisphereLight('#c5e0ff', '#4b6148', 0.62);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff0d1', 1.85);
    sunLight.position.set(28, 42, 24);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 115;
    const d = 40;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#b5d0f2', 0.42);
    rimLight.position.set(-28, 18, -26);
    scene.add(rimLight);

    // Procedural Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const lawnTex = createProceduralLawnTexture(maxAniso);
    const pavingTex = createStonePavingTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    // Extended outdoor ground plane (no floating box walls)
    const groundGeo = new THREE.CircleGeometry(150, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      map: lawnTex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone walkways & central quad courtyard (offset Y >= 0.025 to prevent Z-fighting)
    const walkwayMat = new THREE.MeshStandardMaterial({
      map: pavingTex,
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const centralPlaza = new THREE.Mesh(new THREE.CircleGeometry(9.2, 32), walkwayMat);
    centralPlaza.rotation.x = -Math.PI / 2;
    centralPlaza.position.y = 0.03;
    centralPlaza.receiveShadow = true;
    scene.add(centralPlaza);

    // Connect each building to the Commons Quad with stone paths
    const addWalkway = (from: [number, number], to: [number, number], widthVal = 2.4) => {
      const dx = to[0] - from[0];
      const dz = to[1] - from[1];
      const len = Math.hypot(dx, dz);
      const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(widthVal, len), walkwayMat);
      pathMesh.rotation.x = -Math.PI / 2;
      pathMesh.rotation.z = -Math.atan2(dx, dz);
      pathMesh.position.set((from[0] + to[0]) / 2, 0.028, (from[1] + to[1]) / 2);
      pathMesh.receiveShadow = true;
      scene.add(pathMesh);
    };

    for (const z of CAMPUS_ZONES) {
      if (z.id !== 'commons-quad') {
        addWalkway([0, 0], [z.position[0], z.position[2]], 2.6);
      }
    }
    addWalkway([-16, -12], [16, -14], 2.0);
    addWalkway([-18, 14], [18, 12], 2.0);

    // Shared architectural PBR materials (varied roughness >= 0.25 between adjacent parts)
    const materials = {
      sandstone: new THREE.MeshStandardMaterial({ color: '#e6dcc8', roughness: 0.84, metalness: 0.04 }),
      limestone: new THREE.MeshStandardMaterial({ color: '#eef3f9', roughness: 0.78, metalness: 0.05 }),
      brick: new THREE.MeshStandardMaterial({ color: '#c85a3a', roughness: 0.86, metalness: 0.02 }),
      slateMetal: new THREE.MeshStandardMaterial({ color: '#1e2c4a', roughness: 0.34, metalness: 0.62 }),
      roofTrim: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.45, metalness: 0.28 }),
      copper: new THREE.MeshStandardMaterial({ color: '#0ea5a4', roughness: 0.28, metalness: 0.64 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#1a4bff',
        roughness: 0.12,
        metalness: 0.35,
        clearcoat: 0.9,
        opacity: 0.86,
        transparent: true,
      }),
      plinth: new THREE.MeshStandardMaterial({ color: '#9fb0c6', roughness: 0.88, metalness: 0.03 }),
      shadowMat: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.62,
      }),
    };

    // Build all 6 campus buildings + dedicated proxy raycast hitboxes
    const interactables: THREE.Object3D[] = [];
    const zoneRings = new Map<CampusZoneId, THREE.Mesh>();
    let clockFinialRef: THREE.Object3D | null = null;

    for (const zone of CAMPUS_ZONES) {
      const building = createCampusBuildingGroup(zone.id, materials);
      building.position.set(zone.position[0], 0, zone.position[2]);
      scene.add(building);

      if (zone.id === 'commons-quad') {
        clockFinialRef = building.getObjectByName('clock-finial') || null;
      }

      // Subtle selection halo ring flush on ground
      const ringGeo = new THREE.RingGeometry(6.8, 7.45, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#1a4bff',
        transparent: true,
        opacity: zone.id === 'commons-quad' ? 0.75 : 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(zone.position[0], 0.06, zone.position[2]);
      scene.add(ring);
      zoneRings.set(zone.id, ring);

      // Simplified invisible proxy hitbox for high-performance raycasting
      const hitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(6.6, 6.6, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.set(zone.position[0], 5, zone.position[2]);
      hitProxy.userData.zoneId = zone.id;
      scene.add(hitProxy);
      interactables.push(hitProxy);
    }

    // Perimeter campus tree grove via InstancedMesh (56 multi-part trees with scale & tint variation)
    const treePositions: [number, number][] = [];
    let tSeed = 4201;
    const tRand = () => {
      tSeed = (tSeed * 48271) % 2147483647;
      return (tSeed - 1) / 2147483646;
    };
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2 + (tRand() - 0.5) * 0.12;
      const radius = 34 + tRand() * 24;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      if (Math.hypot(tx, tz - 26) < 12) continue; // Keep clear of athletics complex
      treePositions.push([tx, tz]);
    }
    // Add a few inner courtyard accent trees away from buildings
    treePositions.push([-8.5, -5.5], [8.5, -6], [-9.5, 6.5], [9.5, 6], [-10, 20], [10, 20]);

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5344', roughness: 0.92, metalness: 0.0 });
    const crownLowerGeo = new THREE.IcosahedronGeometry(1.55, 1);
    const crownUpperGeo = new THREE.IcosahedronGeometry(1.1, 1);
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.02 });

    const trunksMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    const crownsLower = new THREE.InstancedMesh(crownLowerGeo, foliageMat, treePositions.length);
    const crownsUpper = new THREE.InstancedMesh(crownUpperGeo, foliageMat, treePositions.length);
    trunksMesh.castShadow = !isSoftwareGl;
    crownsLower.castShadow = !isSoftwareGl;
    crownsUpper.castShadow = !isSoftwareGl;

    treePositions.forEach(([tx, tz], idx) => {
      const s = 0.85 + tRand() * 0.3; // ±15% scale variation
      _tmpQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, tRand() * Math.PI * 2);

      _tmpScale.set(s, s, s);
      _tmpMat4.compose(_tmpVecA.set(tx, 1.1 * s, tz), _tmpQuat, _tmpScale);
      trunksMesh.setMatrixAt(idx, _tmpMat4);

      _tmpMat4.compose(_tmpVecA.set(tx, 2.75 * s, tz), _tmpQuat, _tmpScale);
      crownsLower.setMatrixAt(idx, _tmpMat4);

      _tmpMat4.compose(_tmpVecA.set(tx + 0.15 * s, 3.85 * s, tz - 0.1 * s), _tmpQuat, _tmpScale);
      crownsUpper.setMatrixAt(idx, _tmpMat4);

      const hue = 0.29 + (tRand() - 0.5) * 0.06;
      const sat = 0.36 + tRand() * 0.14;
      const lit = 0.26 + tRand() * 0.10;
      _tmpColor.setHSL(hue, sat, lit);
      crownsLower.setColorAt(idx, _tmpColor);
      _tmpColor.offsetHSL(0.01, 0.04, 0.05);
      crownsUpper.setColorAt(idx, _tmpColor);
    });

    trunksMesh.instanceMatrix.needsUpdate = true;
    crownsLower.instanceMatrix.needsUpdate = true;
    crownsUpper.instanceMatrix.needsUpdate = true;
    if (crownsLower.instanceColor) crownsLower.instanceColor.needsUpdate = true;
    if (crownsUpper.instanceColor) crownsUpper.instanceColor.needsUpdate = true;
    trunksMesh.computeBoundingSphere();
    crownsLower.computeBoundingSphere();
    crownsUpper.computeBoundingSphere();
    scene.add(trunksMesh, crownsLower, crownsUpper);

    // Animated Expanding Radar Ring on Active Building
    const radarRingMat = new THREE.MeshBasicMaterial({
      color: '#1a4bff',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const radarRing = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.55, 36), radarRingMat);
    radarRing.rotation.x = -Math.PI / 2;
    radarRing.position.set(0, 0.075, 0);
    scene.add(radarRing);

    // Stylized Procedural Drifting Campus Clouds (6 composite 3-puff clouds)
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
    });
    const cloudPuffGeo = new THREE.IcosahedronGeometry(1, 1);
    const driftingClouds: { group: THREE.Group; speed: number }[] = [];
    const cloudSeeds: [number, number, number, number, number][] = [
      [-44, 24, -36, 1.8, 1.35],
      [-12, 27, -46, 2.2, 1.05],
      [26, 25, -32, 1.7, 1.55],
      [48, 28, -14, 2.0, 1.15],
      [-34, 26, 18, 1.6, 1.4],
      [18, 29, 28, 2.1, 0.95],
    ];
    for (const [cx, cy, cz, scale, speed] of cloudSeeds) {
      const cGroup = new THREE.Group();
      const puff1 = new THREE.Mesh(cloudPuffGeo, cloudMat);
      puff1.scale.set(2.2, 0.95, 1.4);
      const puff2 = new THREE.Mesh(cloudPuffGeo, cloudMat);
      puff2.position.set(-1.35, -0.15, 0.25);
      puff2.scale.set(1.35, 0.72, 1.05);
      const puff3 = new THREE.Mesh(cloudPuffGeo, cloudMat);
      puff3.position.set(1.45, -0.1, -0.2);
      puff3.scale.set(1.45, 0.78, 1.1);
      cGroup.add(puff1, puff2, puff3);
      cGroup.scale.setScalar(scale);
      cGroup.position.set(cx, cy, cz);
      scene.add(cGroup);
      driftingClouds.push({ group: cGroup, speed });
    }

    // Dynamic 3D Item Beacon Layer (rebuilt cleanly when items/filter change)
    const beaconGroup = new THREE.Group();
    scene.add(beaconGroup);

    const lostBeaconMat = new THREE.MeshStandardMaterial({
      color: '#ff4d2e',
      emissive: '#c81e1e',
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.25,
    });
    const foundBeaconMat = new THREE.MeshStandardMaterial({
      color: '#1a4bff',
      emissive: '#102a99',
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.3,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.36,
      metalness: 0.65,
    });
    const beaconDiamondGeo = new THREE.OctahedronGeometry(0.74, 0);
    const beaconStemGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
    const beaconCapGeo = new THREE.TorusGeometry(0.48, 0.075, 8, 16);

    const animatedBeacons: {
      diamond: THREE.Mesh;
      ring: THREE.Mesh;
      phase: number;
    }[] = [];

    // Continuous 3D animation loop paced safely via afterDraw on software WebGL
    let frameId = 0;
    let disposed = false;
    const startTs = performance.now();
    let lastTs = startTs;

    // Smooth camera transition targets (exponential damping)
    let transitionActive = false;
    const camGoalPos = new THREE.Vector3().copy(overviewCamPos);
    const camGoalTarget = new THREE.Vector3().copy(overviewTarget);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepSceneAnimations(delta: number, elapsed: number) {
      // 1. Floating & spinning 3D lost/found diamond beacons
      for (let i = 0; i < animatedBeacons.length; i++) {
        const b = animatedBeacons[i];
        const bob = Math.sin(elapsed * 2.5 + b.phase);
        b.diamond.position.y = 2.08 + bob * 0.34;
        b.diamond.rotation.y = elapsed * 1.45 + b.phase;
        const rScale = 1 + bob * 0.16;
        b.ring.scale.set(rScale, rScale, 1);
      }

      // 2. Expanding selection radar ripple on active building
      const cycle = (elapsed * 0.45) % 1;
      const pulseScale = 1 + cycle * 0.48;
      radarRing.scale.set(pulseScale, pulseScale, 1);
      radarRingMat.opacity = (1 - cycle) * 0.62;

      // 3. Drifting campus clouds across horizon
      for (let i = 0; i < driftingClouds.length; i++) {
        const c = driftingClouds[i];
        c.group.position.x += c.speed * delta;
        if (c.group.position.x > 74) c.group.position.x = -74;
      }

      // 4. Slowly spinning golden clock tower weathervane finial
      if (clockFinialRef) {
        clockFinialRef.rotation.y = elapsed * 0.85;
      }

      // 5. Optional gentle ambient auto-orbit when not manually dragging or flying to a building
      if (autoOrbitRef.current && !transitionActive) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.8;
      } else {
        controls.autoRotate = false;
      }

      // 6. Smooth damped camera fly-to transition
      if (transitionActive) {
        const alpha = isSoftwareGl ? 0.42 : 1 - Math.exp(-6.2 * delta);
        camera.position.lerp(camGoalPos, alpha);
        controls.target.lerp(camGoalTarget, alpha);
        if (
          camera.position.distanceTo(camGoalPos) < 0.08 &&
          controls.target.distanceTo(camGoalTarget) < 0.08
        ) {
          camera.position.copy(camGoalPos);
          controls.target.copy(camGoalTarget);
          transitionActive = false;
        }
      }
    }

    function renderOnce() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min((now - lastTs) / 1000, 0.12);
      lastTs = now;
      const elapsed = (now - startTs) / 1000;

      if (!prefersReducedMotion) {
        stepSceneAnimations(delta, elapsed);
      } else if (transitionActive) {
        camera.position.copy(camGoalPos);
        controls.target.copy(camGoalTarget);
        transitionActive = false;
      }

      controls.update();
      renderer.render(scene, camera);

      if (prefersReducedMotion) return;
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    const rebuildBeacons = () => {
      while (beaconGroup.children.length > 0) {
        beaconGroup.remove(beaconGroup.children[0]);
      }
      animatedBeacons.length = 0;

      const activeItems = itemsRef.current.filter(
        (i) =>
          i.status !== 'returned' &&
          i.status !== 'archived' &&
          (filterRef.current === 'all' || i.type === filterRef.current)
      );

      let phaseCounter = 0;
      for (const zone of CAMPUS_ZONES) {
        const zItems = activeItems.filter((i) => i.campusZone === zone.id);
        zItems.forEach((item, idx) => {
          const pin = new THREE.Group();
          const angle = (idx / Math.max(zItems.length, 1)) * Math.PI * 2 + 0.5;
          const spread = zItems.length > 1 ? 2.4 : 0;
          const baseHeight = zone.id === 'commons-quad' ? 14.5 : 7.8;

          const stem = new THREE.Mesh(beaconStemGeo, stemMat);
          stem.position.y = 0.9;
          pin.add(stem);

          const diamond = new THREE.Mesh(
            beaconDiamondGeo,
            item.type === 'lost' ? lostBeaconMat : foundBeaconMat
          );
          diamond.position.y = 2.08;
          diamond.scale.set(0.88, 1.3, 0.88);
          pin.add(diamond);

          const ring = new THREE.Mesh(
            beaconCapGeo,
            item.type === 'lost' ? lostBeaconMat : foundBeaconMat
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.06;
          pin.add(ring);

          pin.position.set(
            zone.position[0] + Math.cos(angle) * spread,
            baseHeight,
            zone.position[2] + Math.sin(angle) * spread
          );
          beaconGroup.add(pin);
          animatedBeacons.push({ diamond, ring, phase: phaseCounter * 0.9 });
          phaseCounter += 1;
        });
      }

      if (prefersReducedMotion) renderOnce();
    };

    rebuildBeaconsRef.current = rebuildBeacons;
    rebuildBeacons();

    const updateZoneHighlights = (activeId: CampusZoneId) => {
      for (const [zid, ring] of zoneRings.entries()) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = zid === activeId ? 0.78 : 0.16;
      }
      const meta = CAMPUS_ZONES.find((z) => z.id === activeId);
      if (meta) {
        radarRing.position.set(meta.position[0], 0.075, meta.position[2]);
      }
    };

    focusZoneRef.current = (target: CampusZoneId | 'overview') => {
      if (target === 'overview') {
        camGoalPos.copy(overviewCamPos);
        camGoalTarget.copy(overviewTarget);
      } else {
        const meta = CAMPUS_ZONES.find((z) => z.id === target);
        if (!meta) return;
        camGoalPos.set(meta.cameraOffset[0], meta.cameraOffset[1], meta.cameraOffset[2]);
        camGoalTarget.set(meta.position[0], 2.5, meta.position[2]);
        updateZoneHighlights(target);
      }
      transitionActive = true;
      if (prefersReducedMotion) renderOnce();
    };

    // Cancel camera glide immediately when user manually drags
    controls.addEventListener('start', () => {
      transitionActive = false;
    });
    controls.addEventListener('change', () => {
      if (prefersReducedMotion) renderOnce();
    });

    // Raycasting on dedicated proxy array
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastHoverTs = 0;

    const getHitZone = (e: PointerEvent): CampusZoneId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      if (hits.length > 0) {
        return (hits[0].object.userData.zoneId as CampusZoneId) || null;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 6) return;
      const hit = getHitZone(e);
      if (hit) {
        selectZoneRef.current(hit);
        focusZoneRef.current(hit);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTs < 60) return;
      lastHoverTs = now;
      const hit = getHitZone(e);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      setHoveredZone(hit);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(320, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (prefersReducedMotion) renderOnce();
      }
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      envTarget.dispose();
      lawnTex.dispose();
      pavingTex.dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectZoneButton = (zoneId: CampusZoneId) => {
    setSelectedZone(zoneId);
    focusZoneRef.current(zoneId);
  };

  return (
    <section
      aria-label="Interactive 3D Campus Lost and Found Map"
      className="relative w-full h-[calc(100vh-64px)] min-h-[540px] overflow-hidden bg-[#cce3fc]"
      data-testid="campus-3d-viewport"
      data-selected-zone={selectedZone}
    >
      {/* Dedicated isolated WebGL canvas container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {webglUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-[#0B1437]">3D Campus View Unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">
              WebGL rendering is disabled in this browser. You can still browse all campus zones and
              search reports in the Search &amp; Matches directory.
            </p>
            <button
              type="button"
              onClick={() => onInspectZoneItems(selectedZone)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#1A4BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143CD6]"
            >
              Open Campus Directory
            </button>
          </div>
        </div>
      )}

      {/* Minimal Top-Left Spec Badge (solid rgba surface, no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 max-w-sm">
        <div className="pointer-events-auto rounded-lg border border-blue-200/90 bg-white/95 px-3.5 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Compass className="h-3.5 w-3.5 text-[#1A4BFF]" aria-hidden="true" />
            <span>3D Campus Directory</span>
            <span aria-hidden="true">·</span>
            <span>Drag to orbit, click a building</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <h1 className="text-base font-extrabold text-[#0B1437]">{selectedZoneMeta.name}</h1>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
              {zoneCounts[selectedZone].lost} lost · {zoneCounts[selectedZone].found} found
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Beacons: <span className="font-bold text-[#FF4D2E]">Coral = Lost</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-bold text-[#1A4BFF]">Cobalt = Found</span>
          </p>
          {hoveredZone && hoveredZone !== selectedZone && (
            <p className="mt-0.5 text-xs font-medium text-[#1A4BFF]">
              Click to inspect {CAMPUS_ZONES.find((z) => z.id === hoveredZone)?.name}
            </p>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Mid-Screen Occlusion, Solid Surface, No Backdrop Blur) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center px-4">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          aria-expanded={dockOpen}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-blue-200/90 bg-white px-3.5 py-1 text-xs font-semibold text-[#0B1437] shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#1A4BFF]"
        >
          {dockOpen ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show Campus Controls</span>
            </>
          )}
        </button>

        {dockOpen && (
          <div className="pointer-events-auto w-full max-w-[960px] rounded-xl border border-blue-200/90 bg-white/95 p-3 shadow-md">
            {/* Row 1: Building Quick-Jump Tabs + Filter + Auto-Orbit + Reset Camera */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Campus buildings">
                {CAMPUS_ZONES.map((zone) => {
                  const counts = zoneCounts[zone.id];
                  const isActive = zone.id === selectedZone;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSelectZoneButton(zone.id)}
                      className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#1A4BFF] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {zone.shortName}{' '}
                      <span className="font-mono tabular-nums opacity-85">
                        ({counts.lost + counts.found})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                  {(['all', 'lost', 'found'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                        filterType === t
                          ? 'bg-[#0B1437] text-white shadow-xs'
                          : 'text-slate-600 hover:text-[#0B1437]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAutoOrbit((v) => !v)}
                  aria-pressed={autoOrbit}
                  className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    autoOrbit
                      ? 'border-[#1A4BFF] bg-[#EEF2FF] text-[#1A4BFF]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {autoOrbit ? (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Orbit</span>
                </button>

                <button
                  type="button"
                  onClick={() => focusZoneRef.current('overview')}
                  aria-label="Reset camera to full campus overview"
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Overview</span>
                </button>
              </div>
            </div>

            {/* Row 2: Selected Building Items Strip */}
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">
                  <strong className="font-bold text-[#0B1437]">{selectedZoneMeta.name}</strong>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{selectedZoneMeta.subtitle}</span>
                </p>

                {selectedZoneItems.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    No matching reports in this zone for the current filter.
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {selectedZoneItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItemForClaim(item)}
                        className="group inline-flex items-center gap-1.5 text-left text-xs text-[#0B1437] hover:text-[#1A4BFF]"
                      >
                        <span
                          className={`font-mono text-[11px] font-bold uppercase ${
                            item.type === 'lost' ? 'text-[#FF4D2E]' : 'text-[#1A4BFF]'
                          }`}
                        >
                          [{item.type}]
                        </span>
                        <span className="font-semibold underline-offset-2 group-hover:underline">
                          {item.itemName}
                        </span>
                        <span className="text-slate-400">({item.dateOccurred})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onInspectZoneItems(selectedZone)}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0B1437] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1A4BFF]"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Filter in Search ({selectedZoneItems.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
