// world.js — 3D block world with Three.js
// Uses visibility culling + InstancedMesh for smooth performance

const WORLD_SIZE  = 64;
const MAX_HEIGHT  = 12;
const WATER_LEVEL = 3;

const BLOCK = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5, SAND: 6, WATER: 7 };

const BLOCK_COLOR = {
  [BLOCK.GRASS]:  0x5a9e32,
  [BLOCK.DIRT]:   0x8B5E3C,
  [BLOCK.STONE]:  0x888888,
  [BLOCK.WOOD]:   0x6B4226,
  [BLOCK.LEAVES]: 0x2d7a1a,
  [BLOCK.SAND]:   0xd4b96a,
  [BLOCK.WATER]:  0x3366cc,
};

let scene, camera, renderer, controls;
const blockMap = new Map();

// ── Noise: layered sine waves for natural-looking hills ───────────────────
function heightNoise(x, z) {
  return (
    Math.sin(x * 0.07)  * Math.cos(z * 0.07)  * 3  +
    Math.sin(x * 0.03)  * Math.cos(z * 0.03)  * 5  +
    Math.sin(x * 0.15)  * Math.cos(z * 0.15)  * 1  +
    Math.sin((x + z) * 0.05) * 2
  );
}

function terrainHeight(x, z) {
  const raw = heightNoise(x, z) + MAX_HEIGHT / 2;
  return Math.max(1, Math.min(MAX_HEIGHT, Math.round(raw)));
}

// ── Visibility culling: skip blocks fully surrounded by solid blocks ───────
const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function isExposed(x, y, z) {
  for (const [dx, dy, dz] of DIRS) {
    const n = blockMap.get(`${x+dx},${y+dy},${z+dz}`);
    if (n === undefined || n === BLOCK.AIR || n === BLOCK.WATER) return true;
  }
  return false;
}

// ── World generation ──────────────────────────────────────────────────────
function generateWorld() {
  blockMap.clear();

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = terrainHeight(x, z);

      for (let y = 0; y <= h; y++) {
        let type;
        if (y === h)        type = h <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
        else if (y >= h-3)  type = BLOCK.DIRT;
        else                type = BLOCK.STONE;
        blockMap.set(`${x},${y},${z}`, type);
      }

      // Fill low areas with water
      if (h < WATER_LEVEL) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          blockMap.set(`${x},${y},${z}`, BLOCK.WATER);
        }
      }
    }
  }

  // Trees
  let placed = 0;
  for (let i = 0; i < 300 && placed < 90; i++) {
    const tx = 3 + Math.floor(Math.random() * (WORLD_SIZE - 6));
    const tz = 3 + Math.floor(Math.random() * (WORLD_SIZE - 6));
    const h  = terrainHeight(tx, tz);
    if (h <= WATER_LEVEL + 1) continue;

    const trunkH = 4 + Math.floor(Math.random() * 3);
    const base   = h + 1;

    for (let y = base; y < base + trunkH; y++) {
      blockMap.set(`${tx},${y},${tz}`, BLOCK.WOOD);
    }

    const top = base + trunkH - 1;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if ((dx*dx)/4 + (dy*dy)/4 + (dz*dz)/4 <= 1.0) {
            const key = `${tx+dx},${top+dy},${tz+dz}`;
            if (!blockMap.has(key)) blockMap.set(key, BLOCK.LEAVES);
          }
        }
      }
    }
    placed++;
  }
}

// ── Build InstancedMesh — only for visible (exposed) blocks ───────────────
function buildScene() {
  // Count exposed blocks per type
  const visibleBlocks = [];
  for (const [key, type] of blockMap.entries()) {
    if (type === BLOCK.AIR) continue;
    const [x, y, z] = key.split(',').map(Number);
    if (isExposed(x, y, z)) visibleBlocks.push([x, y, z, type]);
  }

  // Group by type
  const byType = {};
  for (const [x, y, z, type] of visibleBlocks) {
    if (!byType[type]) byType[type] = [];
    byType[type].push([x, y, z]);
  }

  const geo   = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();

  for (const [typeStr, positions] of Object.entries(byType)) {
    const type = parseInt(typeStr);
    const mat  = new THREE.MeshLambertMaterial({
      color:       BLOCK_COLOR[type],
      transparent: type === BLOCK.WATER,
      opacity:     type === BLOCK.WATER ? 0.6 : 1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
    mesh.castShadow    = type !== BLOCK.WATER && type !== BLOCK.LEAVES;
    mesh.receiveShadow = true;

    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
}

// ── Three.js setup ────────────────────────────────────────────────────────
function init() {
  const cx = WORLD_SIZE / 2;
  const cz = WORLD_SIZE / 2;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(cx, 20, cz + 32);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfffbe0, 0.9);
  sun.position.set(50, 80, 30);
  sun.castShadow             = true;
  sun.shadow.mapSize.width   = 1024;
  sun.shadow.mapSize.height  = 1024;
  sun.shadow.camera.near     = 1;
  sun.shadow.camera.far      = 200;
  sun.shadow.camera.left     = -70;
  sun.shadow.camera.right    = 70;
  sun.shadow.camera.top      = 70;
  sun.shadow.camera.bottom   = -70;
  scene.add(sun);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(cx, MAX_HEIGHT / 2, cz);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance   = 4;
  controls.maxDistance   = 90;
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Show loading, then generate off the hot path
  showLoading('Generating world…');
  setTimeout(() => {
    generateWorld();
    buildScene();
    hideLoading();
    animate();
  }, 50);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ── Loading screen ────────────────────────────────────────────────────────
function showLoading(msg) {
  const el = document.getElementById('loading-screen');
  if (el) { el.textContent = msg; el.style.display = 'flex'; }
}
function hideLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = 'none';
}

window.addEventListener('load', init);
