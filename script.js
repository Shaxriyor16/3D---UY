// script.js (module)
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('container');

// SCENE, CAMERA, RENDERER
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f4f6);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / (window.innerHeight - 56), 0.1, 2000);
camera.position.set(6, 6, 8);

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight - 56);
renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
container.appendChild(renderer.domElement);

// LIGHTS
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
hemi.position.set(0, 20, 0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
dir.castShadow = true;
scene.add(dir);

// ROOM: floor + walls (simple)
const floorGeo = new THREE.PlaneGeometry(12, 8);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, side: THREE.BackSide });
const wallGeo1 = new THREE.PlaneGeometry(12, 4);
const wall1 = new THREE.Mesh(wallGeo1, wallMat);
wall1.position.set(0, 2, -4);
scene.add(wall1);

const wallGeo2 = new THREE.PlaneGeometry(8, 4);
const wall2 = new THREE.Mesh(wallGeo2, wallMat);
wall2.rotation.y = Math.PI / 2;
wall2.position.set(-6, 2, 0);
scene.add(wall2);

// grid helper
const grid = new THREE.GridHelper(12, 24, 0xcccccc, 0xeeeeee);
grid.position.y = 0.001;
scene.add(grid);

// CONTROLS
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1, 0);
orbit.update();

const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', function (event) {
  orbit.enabled = !event.value;
});
scene.add(transform);

// objects store
const objects = [];
const loader = new GLTFLoader();

// Helper: create primitive furniture if GLB not available
function createPrimitive(type = 'sofa', pos = [0, 0.5, 0]) {
  let mesh;
  if (type === 'sofa' || type === 'box_sofa') {
    const g = new THREE.BoxGeometry(2, 0.8, 0.9);
    const m = new THREE.MeshStandardMaterial({ color: 0x8b5cf6 });
    mesh = new THREE.Mesh(g, m);
    mesh.name = 'Sofa';
  } else if (type === 'chair' || type === 'box_chair') {
    const g = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const m = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    mesh = new THREE.Mesh(g, m);
    mesh.name = 'Kreslo';
  } else {
    const g = new THREE.BoxGeometry(1.2, 0.6, 1.2);
    const m = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    mesh = new THREE.Mesh(g, m);
    mesh.name = 'Stol';
  }
  mesh.castShadow = true;
  mesh.position.set(...pos);
  mesh.userData.type = type;
  scene.add(mesh);
  objects.push(mesh);
  return mesh;
}

// Load GLB model from URL (models/ folder)
async function loadModel(url, pos = [0, 0.5, 0]) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const root = gltf.scene || gltf.scenes[0];
      root.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      root.position.set(...pos);
      // normalize size small models
      let box = new THREE.Box3().setFromObject(root);
      let size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 1.4 / maxDim; // tweak
        root.scale.setScalar(scale);
      }
      scene.add(root);
      root.userData.modelUrl = url;
      objects.push(root);
      resolve(root);
    }, undefined, (err) => {
      console.warn('Model load fail', url, err);
      reject(err);
    });
  });
}

// Raycaster to pick objects
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null;

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(objects, true); // intersect children too
  if (hits.length > 0) {
    // find top parent (object in objects array)
    let obj = hits[0].object;
    while (obj && !objects.includes(obj)) {
      obj = obj.parent;
    }
    if (obj) selectObject(obj);
  } else {
    deselect();
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// select / deselect
function selectObject(obj) {
  selected = obj;
  transform.attach(obj);
}
function deselect() {
  transform.detach();
  selected = null;
}

// UI hooks
document.getElementById('addBtn').addEventListener('click', async () => {
  const sel = document.getElementById('modelSelect').value;
  if (sel.startsWith('models/') && sel.endsWith('.glb')) {
    try {
      await loadModel(sel, [Math.random() * 2 - 1, 0.5, Math.random() * 2 - 1]);
    } catch (e) {
      // fallback to primitive
      createPrimitive('sofa', [Math.random() * 2 - 1, 0.5, Math.random() * 2 - 1]);
      alert('Model yuklanmadi — primitive qo‘yildi. Model faylini models/ papkaga joylang yoki URL ni tekshiring.');
    }
  } else {
    // primitive options
    if (sel.includes('sofa')) createPrimitive('sofa', [Math.random() * 2 - 1, 0.5, Math.random() * 2 - 1]);
    else if (sel.includes('chair')) createPrimitive('chair', [Math.random() * 2 - 1, 0.5, Math.random() * 2 - 1]);
    else createPrimitive('table', [Math.random() * 2 - 1, 0.5, Math.random() * 2 - 1]);
  }
});

document.getElementById('deleteBtn').addEventListener('click', () => {
  if (!selected) return alert('Obyekt tanlanmagan');
  const idx = objects.indexOf(selected);
  if (idx !== -1) objects.splice(idx, 1);
  scene.remove(selected);
  transform.detach();
  selected = null;
});

// mode buttons
const modeTranslate = document.getElementById('modeTranslate');
const modeRotate = document.getElementById('modeRotate');
const modeScale = document.getElementById('modeScale');
const modes = [modeTranslate, modeRotate, modeScale];
function setActiveMode(name) {
  modes.forEach(m => m.classList.remove('active'));
  if (name === 'translate') { modeTranslate.classList.add('active'); transform.setMode('translate'); }
  if (name === 'rotate') { modeRotate.classList.add('active'); transform.setMode('rotate'); }
  if (name === 'scale') { modeScale.classList.add('active'); transform.setMode('scale'); }
}
modeTranslate.addEventListener('click', () => setActiveMode('translate'));
modeRotate.addEventListener('click', () => setActiveMode('rotate'));
modeScale.addEventListener('click', () => setActiveMode('scale'));
setActiveMode('translate'); // default

// floor / wall color controls
document.getElementById('floorColor').addEventListener('input', (e) => {
  floor.material.color.set(e.target.value);
});
document.getElementById('wallColor').addEventListener('input', (e) => {
  wall1.material.color.set(e.target.value);
  wall2.material.color.set(e.target.value);
});

// save / load layout (LocalStorage)
function saveLayout() {
  const arr = objects.map(o => {
    const box = new THREE.Box3().setFromObject(o);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return {
      modelUrl: o.userData.modelUrl || null,
      type: o.userData.type || null,
      name: o.name || '',
      pos: [o.position.x, o.position.y, o.position.z],
      rot: [o.rotation.x, o.rotation.y, o.rotation.z],
      scale: [o.scale.x, o.scale.y, o.scale.z]
    };
  });
  localStorage.setItem('roomLayout', JSON.stringify(arr));
  localStorage.setItem('floorColor', floor.material.color.getHexString());
  localStorage.setItem('wallColor', wall1.material.color.getHexString());
  alert('Saqlandi!');
}

async function loadLayout() {
  const raw = localStorage.getItem('roomLayout');
  if (!raw) return alert('Hech nima topilmadi');
  // clear existing
  objects.forEach(o => scene.remove(o));
  objects.length = 0;
  const arr = JSON.parse(raw);
  for (const item of arr) {
    if (item.modelUrl) {
      try {
        const m = await loadModel(item.modelUrl, item.pos);
        m.rotation.set(...item.rot);
        m.scale.set(...item.scale);
      } catch (e) {
        // fallback primitive
        createPrimitive(item.type || 'sofa', item.pos);
      }
    } else {
      createPrimitive(item.type || 'sofa', item.pos);
    }
  }
  // colors
  const fcol = localStorage.getItem('floorColor');
  const wcol = localStorage.getItem('wallColor');
  if (fcol) floor.material.color.set('#' + fcol);
  if (wcol) { wall1.material.color.set('#' + wcol); wall2.material.color.set('#' + wcol); }
  alert('Yuklandi!');
}
document.getElementById('saveBtn').addEventListener('click', saveLayout);
document.getElementById('loadBtn').addEventListener('click', loadLayout);

// responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / (window.innerHeight - 56);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight - 56);
});

// initial sample objects
createPrimitive('sofa', [-1.5, 0.5, 0]);
createPrimitive('chair', [1.2, 0.5, -0.5]);
createPrimitive('table', [0, 0.5, 1.5]);

// animate
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
