// world.js — 3D block world using Three.js + InstancedMesh for performance

const WORLD_SIZE = 64;
const MAX_HEIGHT  = 14;
const WATER_LEVEL = 3;

const BLOCK = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5, SAND: 6, WATER: 7 };

const BLOCK_COLOR = {
  [BLOCK.GRASS]:  0x5a9e32,
  [BLOCK.DIRT]:   0x8B5E3C,
  [BLOCK.STONE]:  0x888888,
  [BLOCK.WOOD]:   0x6B4226,
  [BLOCK.LEAVES]: 0x2d7a1a,
  [BLOCK.SAND]:   0xd4b96a,
  [BLOCK.WATER]:  0x2255aa,
};

let scene, camera, renderer, controls;
const blockMap = new Map();

// ── Layered sine-wave noise for smooth hills ──────────────────────────────
function heightNoise(x, z) {
  const a = Math.sin(x * 0.07)  * Math.cos(z * 0.07)  * 4;
  const b = Math.sin(x * 0.03)  * Math.cos(z * 0.03)  * 6;
  const c = Math.sin(x * 0.15)  * Math.cos(z * 0.15)  * 1.5;
  const d = Math.sin((x + z) * 0.05) * 2;
  return a + b + c + d;
}

function terrainHeight(x, z) {
  const raw = heightNoise(x, z) + MAX_HEIGHT / 2;
  return Math.max(1, Math.min(MAX_HEIGHT, Math.round(raw)));
}

// ── World generation ─────────────────────────────────────────────────────
function generateWorld() {
  blockMap.clear();

  // Terrain
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = terrainHeight(x, z);

      for (let y = 0; y <= h; y++) {
        let type;
        if (y === h) {
          type = h <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
        } else if (y >= h - 3) {
          type = BLOCK.DIRT;
        } else {
          type = BLOCK.STONE;
        }
        blockMap.set(`${x},${y},${z}`, type);
      }

      // Water fills low areas
      if (h < WATER_LEVEL) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          blockMap.set(`${x},${y},${z}`, BLOCK.WATER);
        }
      }
    }
  }

  // Trees — only on grass above water level
  let treeCount = 0;
  const attempts = 200;
  for (let i = 0; i < attempts && treeCount < 80; i++) {
    const tx = 3 + Math.floor(Math.random() * (WORLD_SIZE - 6));
    const tz = 3 + Math.floor(Math.random() * (WORLD_SIZE - 6));
    const h  = terrainHeight(tx, tz);
    if (h <= WATER_LEVEL + 1) continue;

    const trunkH = 4 + Math.floor(Math.random() * 3);
    const base   = h + 1;

    // Trunk
    for (let y = base; y < base + trunkH; y++) {
      blockMap.set(`${tx},${y},${tz}`, BLOCK.WOOD);
    }

    // Leaf canopy — ellipsoid shape
    const top = base + trunkH - 1;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const dist = (dx * dx) / 9 + (dy * dy) / 4 + (dz * dz) / 9;
          if (dist <= 1.0) {
            const key = `${tx + dx},${top + dy},${tz + dz}`;
            if (!blockMap.has(key)) {
              blockMap.set(key, BLOCK.LEAVES);
            }
          }
        }
      }
    }
    treeCount++;
  }
}

// ── Build scene using InstancedMesh (one draw call per block type) ────────
function buildScene() {
  // Count how many blocks of each type
  const counts = {};
  for (const type of blockMap.values()) {
    if (type === BLOCK.AIR) continue;
    counts[type] = (counts[type] || 0) + 1;
  }

  const geo   = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const iMeshes = {};

  for (const [typeStr, count] of Object.entries(counts)) {
    const type = parseInt(typeStr);
    const mat  = new THREE.MeshLambertMaterial({
      color:       BLOCK_COLOR[type],
      transparent: type === BLOCK.WATER,
      opacity:     type === BLOCK.WATER ? 0.65 : 1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow    = type !== BLOCK.WATER;
    mesh.receiveShadow = true;
    scene.add(mesh);
    iMeshes[type] = { mesh, idx: 0 };
  }

  for (const [key, type] of blockMap.entries()) {
    if (type === BLOCK.AIR) continue;
    const [x, y, z] = key.split(',').map(Number);
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    const entry = iMeshes[type];
    entry.mesh.setMatrixAt(entry.idx++, dummy.matrix);
  }

  for (const { mesh } of Object.values(iMeshes)) {
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// ── Three.js init ─────────────────────────────────────────────────────────
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

  // Camera
  const cx = WORLD_SIZE / 2;
  const cz = WORLD_SIZE / 2;
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(cx, 22, cz + 35);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfffbe0, 1.0);
  sun.position.set(60, 100, 40);
  sun.castShadow = true;
  scene.add(sun);

  // Horizon haze plane
  const hazeGeo = new THREE.PlaneGeometry(500, 500);
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.0 });
  const haze = new THREE.Mesh(hazeGeo, hazeMat);
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = -1;
  scene.add(haze);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(cx, MAX_HEIGHT / 2, cz);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.07;
  controls.maxPolarAngle  = Math.PI / 2 - 0.02;
  controls.minDistance    = 4;
  controls.maxDistance    = 100;
  controls.update();

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Generate and render world
  generateWorld();
  buildScene();

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('load', init);
