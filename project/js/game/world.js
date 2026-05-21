// Initialize Three.js scene, camera, and renderer
let scene, camera, renderer, controls;
let world = {}; // Store block types at each (x, y, z)
const WORLD_SIZE = 64;
const CUBE_SIZE = 1;
const MAX_HEIGHT = 10; // Max height for terrain

// Block types (colors)
const blockColors = {
  0: 0x000000, // Air (invisible)
  1: 0x8B4513, // Dirt
  2: 0x808080, // Stone
  3: 0x1E90FF, // Water
  4: 0x00FF00, // Grass
};

function initThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Position camera higher and further back for better view
  camera.position.set(WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE * 1.5);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const container = document.getElementById('game-container');
  container.innerHTML = ''; // Clear container
  container.appendChild(renderer.domElement);

  // Add OrbitControls (for mouse movement)
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera from going below ground

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 50);
  scene.add(directionalLight);

  // Initialize world with terrain
  initWorld();

  // Start animation loop
  animate();
}

// Generate terrain height at (x, z)
function generateTerrainHeight(x, z) {
  // Simple noise: combine multiple sine waves for smoother terrain
  const scale = 0.1;
  const noise1 = Math.sin(x * scale) * Math.cos(z * scale);
  const noise2 = Math.sin(x * scale * 0.5) * Math.cos(z * scale * 0.5) * 2;
  const noise3 = Math.sin(x * scale * 2) * Math.cos(z * scale * 2) * 0.5;
  let height = (noise1 + noise2 + noise3) * 2 + MAX_HEIGHT / 2;

  // Clamp height between 0 and MAX_HEIGHT
  height = Math.max(0, Math.min(MAX_HEIGHT, height));
  return Math.floor(height);
}

function initWorld() {
  // Clear existing world data
  world = {};

  // Generate terrain
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const height = generateTerrainHeight(x, z);
      for (let y = 0; y <= height; y++) {
        // Grass on top, dirt below
        world[`${x},${y},${z}`] = y === height ? 4 : 1;
      }
    }
  }
  renderWorld();
}

function renderWorld() {
  // Clear existing cubes
  while (scene.children.length > 2) {
    scene.remove(scene.children[0]);
  }

  // Render all non-air blocks
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let z = 0; z < WORLD_SIZE; z++) {
        const blockType = world[`${x},${y},${z}`];
        if (blockType !== 0) { // Skip air
          const cube = new THREE.Mesh(
            new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
            new THREE.MeshPhongMaterial({ color: blockColors[blockType] })
          );
          cube.position.set(x, y, z);
          scene.add(cube);
        }
      }
    }
  }
}

function placeBlock(x, y, z, blockType) {
  world[`${x},${y},${z}`] = blockType;
  renderWorld();
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle mouse click to place/remove blocks
function onMouseClick(event) {
  if (!controls) return;

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const blockPos = intersect.object.position;
    // Place a block next to the clicked block
    placeBlock(
      Math.floor(blockPos.x + 1),
      Math.floor(blockPos.y),
      Math.floor(blockPos.z),
      1 // Dirt
    );
  }
}

window.addEventListener('click', onMouseClick, false);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  renderer.render(scene, camera);
}

// Initialize and start the game
window.addEventListener('load', () => {
  initThreeJS();
});