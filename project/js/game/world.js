// world.js — First-person block world with Three.js

// ── Constants ────────────────────────────────────────────────────────────────
const WORLD_SIZE  = 64;
const MAX_HEIGHT  = 12;
const WATER_LEVEL = 3;
const GRAVITY     = -22;
const JUMP_FORCE  = 8;
const MOVE_SPEED  = 5;
const REACH       = 5.5;
const MOUSE_SENS  = 0.002;

const BLOCK = { AIR:0, GRASS:1, DIRT:2, STONE:3, WOOD:4, LEAVES:5, SAND:6, WATER:7 };
const SOLID = new Set([BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.SAND]);

const BLOCK_COLOR = {
  [BLOCK.GRASS]:  0x5a9e32,
  [BLOCK.DIRT]:   0x8B5E3C,
  [BLOCK.STONE]:  0x888888,
  [BLOCK.WOOD]:   0x6B4226,
  [BLOCK.LEAVES]: 0x2d7a1a,
  [BLOCK.SAND]:   0xd4b96a,
  [BLOCK.WATER]:  0x3366cc,
};

// ── State ────────────────────────────────────────────────────────────────────
let scene, camera, renderer;
let highlightMesh;
const blockMap   = new Map();
const worldMeshes = [];

const player = { x:32, y:16, z:32, vx:0, vy:0, vz:0, yaw:0, pitch:0, onGround:false };
const keys   = {};
let   pointerLocked = false;
let   selectedBlock = BLOCK.DIRT;
let   lastTime      = 0;

// ── Noise / terrain ──────────────────────────────────────────────────────────
function heightNoise(x, z) {
  return (
    Math.sin(x*0.07) * Math.cos(z*0.07) * 3 +
    Math.sin(x*0.03) * Math.cos(z*0.03) * 5 +
    Math.sin(x*0.15) * Math.cos(z*0.15) * 1 +
    Math.sin((x+z)*0.05) * 2
  );
}
function terrainHeight(x, z) {
  return Math.max(1, Math.min(MAX_HEIGHT, Math.round(heightNoise(x,z) + MAX_HEIGHT/2)));
}

// ── World generation ─────────────────────────────────────────────────────────
function generateWorld() {
  blockMap.clear();
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = terrainHeight(x, z);
      for (let y = 0; y <= h; y++) {
        let t;
        if (y === h)       t = h <= WATER_LEVEL+1 ? BLOCK.SAND : BLOCK.GRASS;
        else if (y >= h-3) t = BLOCK.DIRT;
        else               t = BLOCK.STONE;
        blockMap.set(`${x},${y},${z}`, t);
      }
      if (h < WATER_LEVEL) {
        for (let y = h+1; y <= WATER_LEVEL; y++)
          blockMap.set(`${x},${y},${z}`, BLOCK.WATER);
      }
    }
  }

  // Trees
  let placed = 0;
  for (let i = 0; i < 300 && placed < 80; i++) {
    const tx = 3 + Math.floor(Math.random()*(WORLD_SIZE-6));
    const tz = 3 + Math.floor(Math.random()*(WORLD_SIZE-6));
    const h  = terrainHeight(tx, tz);
    if (h <= WATER_LEVEL+1) continue;
    const trunkH = 4 + Math.floor(Math.random()*3);
    const base   = h+1;
    for (let y = base; y < base+trunkH; y++) blockMap.set(`${tx},${y},${tz}`, BLOCK.WOOD);
    const top = base+trunkH-1;
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) {
      if ((dx*dx)/4+(dy*dy)/4+(dz*dz)/4<=1.0) {
        const k=`${tx+dx},${top+dy},${tz+dz}`;
        if (!blockMap.has(k)) blockMap.set(k, BLOCK.LEAVES);
      }
    }
    placed++;
  }

  // Spawn player on top of terrain at centre
  const cx = Math.floor(WORLD_SIZE/2);
  const cz = Math.floor(WORLD_SIZE/2);
  player.x = cx+0.5;
  player.y = terrainHeight(cx,cz)+2;
  player.z = cz+0.5;
}

// ── Visibility culling ───────────────────────────────────────────────────────
const DIRS6 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function isExposed(x, y, z) {
  for (const [dx,dy,dz] of DIRS6) {
    const n = blockMap.get(`${x+dx},${y+dy},${z+dz}`);
    if (!n || n===BLOCK.AIR || n===BLOCK.WATER) return true;
  }
  return false;
}

// ── Build / rebuild scene meshes ─────────────────────────────────────────────
function clearMeshes() {
  for (const m of worldMeshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  worldMeshes.length = 0;
}

function buildScene() {
  clearMeshes();
  const byType = {};
  for (const [key, type] of blockMap.entries()) {
    if (!type || type===BLOCK.AIR) continue;
    const [x,y,z] = key.split(',').map(Number);
    if (!isExposed(x,y,z)) continue;
    if (!byType[type]) byType[type]=[];
    byType[type].push(x,y,z);
  }

  const geo   = new THREE.BoxGeometry(1,1,1);
  const dummy = new THREE.Object3D();

  for (const [typeStr, coords] of Object.entries(byType)) {
    const type  = parseInt(typeStr);
    const count = coords.length/3;
    const mat   = new THREE.MeshLambertMaterial({
      color:       BLOCK_COLOR[type],
      transparent: type===BLOCK.WATER,
      opacity:     type===BLOCK.WATER ? 0.55 : 1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow    = type!==BLOCK.WATER && type!==BLOCK.LEAVES;
    mesh.receiveShadow = true;
    for (let i=0;i<count;i++) {
      dummy.position.set(coords[i*3], coords[i*3+1], coords[i*3+2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    worldMeshes.push(mesh);
  }
}

// ── Raycast (DDA step) ───────────────────────────────────────────────────────
function raycast() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let px=player.x, py=player.y+1.62, pz=player.z;
  const step=0.04;
  let prevBx=null, prevBy=null, prevBz=null;
  for (let d=0; d<REACH; d+=step) {
    px+=dir.x*step; py+=dir.y*step; pz+=dir.z*step;
    const bx=Math.floor(px), by=Math.floor(py), bz=Math.floor(pz);
    const t=blockMap.get(`${bx},${by},${bz}`);
    if (t && t!==BLOCK.AIR && t!==BLOCK.WATER) {
      return { hit:true, bx, by, bz, px:prevBx, py:prevBy, pz:prevBz, type:t };
    }
    prevBx=bx; prevBy=by; prevBz=bz;
  }
  return { hit:false };
}

// ── Block break / place ──────────────────────────────────────────────────────
function breakBlock() {
  const r = raycast();
  if (!r.hit) return;
  blockMap.delete(`${r.bx},${r.by},${r.bz}`);
  buildScene();
  updateHighlight();
}

function placeBlock() {
  const r = raycast();
  if (!r.hit || r.px===null) return;
  // Don't place inside the player
  if (r.px===Math.floor(player.x) && r.py===Math.floor(player.y) && r.pz===Math.floor(player.z)) return;
  if (r.px===Math.floor(player.x) && r.py===Math.floor(player.y+1) && r.pz===Math.floor(player.z)) return;
  blockMap.set(`${r.px},${r.py},${r.pz}`, selectedBlock);
  buildScene();
  updateHighlight();
}

// ── Block highlight wireframe ─────────────────────────────────────────────────
function updateHighlight() {
  const r = raycast();
  if (r.hit) {
    highlightMesh.position.set(r.bx+0.5, r.by+0.5, r.bz+0.5);
    highlightMesh.visible = true;
  } else {
    highlightMesh.visible = false;
  }
}

// ── Collision ────────────────────────────────────────────────────────────────
function isSolid(x, y, z) {
  return SOLID.has(blockMap.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`));
}

function collidesWithWorld() {
  const hw=0.3, hh=1.8;
  for (let dx of [-hw, hw]) for (let dz of [-hw, hw]) for (let dy of [0, hh*0.5, hh]) {
    if (isSolid(player.x+dx, player.y+dy, player.z+dz)) return true;
  }
  return false;
}

// ── Player update ────────────────────────────────────────────────────────────
function updatePlayer(dt) {
  if (dt > 0.1) dt = 0.1; // cap delta

  // Movement direction from yaw
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  let mx=0, mz=0;
  if (keys['KeyW']||keys['ArrowUp'])    { mx+=sinY; mz+=cosY; }
  if (keys['KeyS']||keys['ArrowDown'])  { mx-=sinY; mz-=cosY; }
  if (keys['KeyA']||keys['ArrowLeft'])  { mx-=cosY; mz+=sinY; }
  if (keys['KeyD']||keys['ArrowRight']) { mx+=cosY; mz-=sinY; }
  const len=Math.sqrt(mx*mx+mz*mz);
  if (len>0) { mx/=len; mz/=len; }

  const speed = MOVE_SPEED * (keys['ShiftLeft']||keys['ShiftRight'] ? 1.8 : 1);
  player.vx = mx*speed;
  player.vz = mz*speed;

  // Gravity
  player.vy += GRAVITY*dt;

  // Jump
  if ((keys['Space']||keys['KeySpace']) && player.onGround) {
    player.vy=JUMP_FORCE;
    player.onGround=false;
  }

  // Move X
  player.x += player.vx*dt;
  if (collidesWithWorld()) { player.x -= player.vx*dt; player.vx=0; }

  // Move Z
  player.z += player.vz*dt;
  if (collidesWithWorld()) { player.z -= player.vz*dt; player.vz=0; }

  // Move Y
  player.y += player.vy*dt;
  if (collidesWithWorld()) {
    if (player.vy<0) { player.onGround=true; }
    player.y -= player.vy*dt;
    player.vy=0;
  } else {
    player.onGround=false;
  }

  // World bounds clamp
  player.x = Math.max(0.5, Math.min(WORLD_SIZE-0.5, player.x));
  player.z = Math.max(0.5, Math.min(WORLD_SIZE-0.5, player.z));
  if (player.y < -5) { player.y=terrainHeight(Math.floor(player.x),Math.floor(player.z))+2; player.vy=0; }

  // Update camera
  camera.position.set(player.x, player.y+1.62, player.z);
  camera.rotation.order='YXZ';
  camera.rotation.y=player.yaw;
  camera.rotation.x=player.pitch;
}

// ── Pointer lock ─────────────────────────────────────────────────────────────
function initPointerLock() {
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => {
    if (!pointerLocked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement===canvas;
    document.getElementById('lock-hint').style.display = pointerLocked ? 'none' : 'flex';
  });
  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
    player.yaw   -= e.movementX * MOUSE_SENS;
    player.pitch -= e.movementY * MOUSE_SENS;
    player.pitch  = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, player.pitch));
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!pointerLocked) return;
    if (e.button===0) breakBlock();
    if (e.button===2) placeBlock();
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function initToolbar() {
  document.querySelectorAll('.tool-slot').forEach(el => {
    el.addEventListener('click', () => {
      selectedBlock = parseInt(el.dataset.block);
      document.querySelectorAll('.tool-slot').forEach(e=>e.classList.remove('active'));
      el.classList.add('active');
    });
  });
  document.addEventListener('keydown', e => {
    const n = parseInt(e.key);
    if (n>=1 && n<=6) {
      selectedBlock = n;
      document.querySelectorAll('.tool-slot').forEach((el,i)=>{
        el.classList.toggle('active', i===n-1);
      });
    }
  });
}

// ── Input ────────────────────────────────────────────────────────────────────
function initInput() {
  document.addEventListener('keydown', e => { keys[e.code]=true; e.preventDefault(); });
  document.addEventListener('keyup',   e => { keys[e.code]=false; });
}

// ── Three.js init ─────────────────────────────────────────────────────────────
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 300);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfffbe0, 0.9);
  sun.position.set(50,80,30);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
  sun.shadow.camera.top=60;   sun.shadow.camera.bottom=-60;
  sun.shadow.camera.far=200;
  scene.add(sun);

  // Block highlight wireframe
  highlightMesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02,1.02,1.02)),
    new THREE.LineBasicMaterial({ color:0x000000, linewidth:2 })
  );
  highlightMesh.visible=false;
  scene.add(highlightMesh);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  initInput();
  initPointerLock();
  initToolbar();

  showLoading('Generating world…');
  setTimeout(() => {
    generateWorld();
    buildScene();
    hideLoading();
    lastTime = performance.now();
    animate();
  }, 50);
}

function animate() {
  requestAnimationFrame(animate);
  const now=performance.now(), dt=(now-lastTime)/1000;
  lastTime=now;
  if (pointerLocked) {
    updatePlayer(dt);
    updateHighlight();
  }
  renderer.render(scene, camera);
}

function showLoading(msg) { const el=document.getElementById('loading-screen'); if(el){el.querySelector('span').textContent=msg;el.style.display='flex';} }
function hideLoading()    { const el=document.getElementById('loading-screen'); if(el) el.style.display='none'; }

window.addEventListener('load', init);
