import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import './style.css';

const SHAPES = [
  { id: 'cube', label: 'Würfel', color: 0x5cc8ff },
  { id: 'cuboid', label: 'Quader', color: 0x7c9cff },
  { id: 'sphere', label: 'Kugel', color: 0xff6fb5 },
  { id: 'cylinder', label: 'Zylinder', color: 0xffb45c },
  { id: 'pyramid', label: 'Pyramide', color: 0x6fffc1 },
  { id: 'prism', label: 'Dreiecksprisma', color: 0xc892ff },
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x091426);
scene.fog = new THREE.Fog(0x091426, 10, 28);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.65, 3.2);

const player = new THREE.Group();
player.add(camera);
scene.add(player);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor'],
}));

scene.add(new THREE.HemisphereLight(0xbad8ff, 0x1f2735, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(4, 8, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x132238, roughness: 0.92, metalness: 0.02 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(30, 60, 0x5b83aa, 0x27415e);
grid.position.y = 0.002;
scene.add(grid);

const buildObjects = new THREE.Group();
buildObjects.name = 'BuildObjects';
scene.add(buildObjects);

const state = {
  shapeIndex: 0,
  scaleIndex: 1,
  scales: [0.55, 0.8, 1.1, 1.45],
  distance: 1.5,
  previewRotation: new THREE.Euler(0, 0, 0, 'YXZ'),
  menuOpen: false,
  menuAxisReady: true,
  hovered: null,
  grabbed: null,
  grabbedController: null,
  history: [],
};

const raycaster = new THREE.Raycaster();
raycaster.far = 6;
const tempMatrix = new THREE.Matrix4();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const clock = new THREE.Clock();

function geometryFor(id) {
  switch (id) {
    case 'cuboid': return new THREE.BoxGeometry(0.9, 0.45, 0.45);
    case 'sphere': return new THREE.SphereGeometry(0.42, 32, 20);
    case 'cylinder': return new THREE.CylinderGeometry(0.36, 0.36, 0.8, 28);
    case 'pyramid': return new THREE.ConeGeometry(0.52, 0.85, 4);
    case 'prism': {
      const shape = new THREE.Shape();
      shape.moveTo(-0.45, -0.35);
      shape.lineTo(0.45, -0.35);
      shape.lineTo(0, 0.45);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
      geometry.center();
      return geometry;
    }
    default: return new THREE.BoxGeometry(0.65, 0.65, 0.65);
  }
}

function materialFor(shape, preview = false) {
  return new THREE.MeshStandardMaterial({
    color: shape.color,
    roughness: 0.52,
    metalness: 0.08,
    transparent: preview,
    opacity: preview ? 0.42 : 1,
    depthWrite: !preview,
    emissive: 0x000000,
  });
}

function createShapeMesh(shape, preview = false) {
  const mesh = new THREE.Mesh(geometryFor(shape.id), materialFor(shape, preview));
  mesh.castShadow = !preview;
  mesh.receiveShadow = !preview;
  mesh.userData.buildObject = !preview;
  mesh.userData.shapeId = shape.id;
  return mesh;
}

let preview = createShapeMesh(SHAPES[state.shapeIndex], true);
preview.name = 'Preview';
scene.add(preview);

function replacePreview() {
  const next = createShapeMesh(SHAPES[state.shapeIndex], true);
  next.position.copy(preview.position);
  next.quaternion.copy(preview.quaternion);
  next.scale.copy(preview.scale);
  scene.remove(preview);
  preview.geometry.dispose();
  preview.material.dispose();
  preview = next;
  preview.name = 'Preview';
  scene.add(preview);
  updateDesktopShapeSelection();
}

function createTextTexture(text, color = '#ffffff', background = 'rgba(0,0,0,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = '700 46px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabel(text, width = 0.36, height = 0.09) {
  const material = new THREE.MeshBasicMaterial({
    map: createTextTexture(text),
    transparent: true,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 20;
  return mesh;
}

const menu = new THREE.Group();
menu.visible = false;
menu.name = 'BuildMenu';
scene.add(menu);

const menuBackground = new THREE.Mesh(
  new THREE.PlaneGeometry(1.36, 0.72),
  new THREE.MeshBasicMaterial({ color: 0x081422, transparent: true, opacity: 0.94, depthTest: false }),
);
menuBackground.position.z = -0.025;
menuBackground.renderOrder = 10;
menu.add(menuBackground);

const titleLabel = createLabel('BAUMENÜ · STICK WÄHLT · R2 BESTÄTIGT', 1.06, 0.085);
titleLabel.position.set(0, 0.27, 0);
menu.add(titleLabel);

const menuPanels = SHAPES.map((shape, index) => {
  const group = new THREE.Group();
  const column = index % 3;
  const row = Math.floor(index / 3);
  group.position.set((column - 1) * 0.4, 0.08 - row * 0.28, 0);

  const panelMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a2d45,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.23), panelMaterial);
  panel.renderOrder = 11;
  group.add(panel);

  const icon = createShapeMesh(shape, true);
  icon.material.transparent = false;
  icon.material.opacity = 1;
  icon.material.depthTest = false;
  icon.scale.setScalar(0.16);
  icon.position.y = 0.025;
  icon.renderOrder = 12;
  group.add(icon);

  const label = createLabel(shape.label, 0.3, 0.06);
  label.position.y = -0.072;
  group.add(label);

  menu.add(group);
  return { group, panelMaterial };
});

function refreshMenu() {
  menu.visible = state.menuOpen;
  menuPanels.forEach(({ group, panelMaterial }, index) => {
    const selected = index === state.shapeIndex;
    panelMaterial.color.setHex(selected ? 0x176d91 : 0x1a2d45);
    group.scale.setScalar(selected ? 1.08 : 1);
  });
}

function toggleMenu(force) {
  state.menuOpen = typeof force === 'boolean' ? force : !state.menuOpen;
  refreshMenu();
}

function changeShape(delta) {
  state.shapeIndex = (state.shapeIndex + delta + SHAPES.length) % SHAPES.length;
  replacePreview();
  refreshMenu();
}

function cycleScale() {
  state.scaleIndex = (state.scaleIndex + 1) % state.scales.length;
}

function placePreview() {
  if (!preview.visible) return;
  const object = createShapeMesh(SHAPES[state.shapeIndex]);
  object.position.copy(preview.position);
  object.quaternion.copy(preview.quaternion);
  object.scale.copy(preview.scale);
  object.userData.createdAt = performance.now();
  buildObjects.add(object);
  state.history.push(object);
}

function undoLast() {
  while (state.history.length) {
    const object = state.history.pop();
    if (object.parent) {
      object.parent.remove(object);
      object.geometry.dispose();
      object.material.dispose();
      if (state.hovered === object) state.hovered = null;
      return;
    }
  }
}

function removeObject(object) {
  if (!object || !object.userData.buildObject || object === state.grabbed) return;
  object.parent?.remove(object);
  object.geometry.dispose();
  object.material.dispose();
  state.history = state.history.filter((entry) => entry !== object);
  if (state.hovered === object) state.hovered = null;
}

function setHovered(next) {
  if (state.hovered === next) return;
  if (state.hovered?.material?.emissive) state.hovered.material.emissive.setHex(0x000000);
  state.hovered = next;
  if (state.hovered?.material?.emissive) state.hovered.material.emissive.setHex(0x17415a);
}

function rayFromController(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
}

function grabHovered(controller) {
  if (!state.hovered || state.grabbed) return;
  state.grabbed = state.hovered;
  state.grabbedController = controller;
  controller.attach(state.grabbed);
  setHovered(null);
}

function releaseGrab() {
  if (!state.grabbed) return;
  buildObjects.attach(state.grabbed);
  state.grabbed = null;
  state.grabbedController = null;
}

const controllerModelFactory = new XRControllerModelFactory();
const controllers = [];

function addController(index) {
  const target = renderer.xr.getController(index);
  const grip = renderer.xr.getControllerGrip(index);
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x77ddff, transparent: true, opacity: 0.75 }),
  );
  ray.name = 'PointerRay';
  ray.scale.z = 2;
  target.add(ray);

  grip.add(controllerModelFactory.createControllerModel(grip));
  player.add(target, grip);

  const record = { target, grip, inputSource: null, previousButtons: [], handedness: 'none' };
  controllers.push(record);

  target.addEventListener('connected', (event) => {
    record.inputSource = event.data;
    record.handedness = event.data.handedness;
    ray.visible = event.data.targetRayMode === 'tracked-pointer';
  });
  target.addEventListener('disconnected', () => {
    record.inputSource = null;
    record.previousButtons = [];
    if (state.grabbedController === target) releaseGrab();
  });
  target.addEventListener('selectstart', () => {
    if (record.handedness !== 'right') return;
    if (state.menuOpen) toggleMenu(false);
    else placePreview();
  });
  target.addEventListener('squeezestart', () => {
    if (record.handedness === 'right') grabHovered(target);
  });
  target.addEventListener('squeezeend', () => {
    if (state.grabbedController === target) releaseGrab();
  });
}

addController(0);
addController(1);

function getController(handedness) {
  return controllers.find((record) => record.handedness === handedness && record.inputSource);
}

function buttonPressed(gamepad, index) {
  return Boolean(gamepad.buttons[index]?.pressed);
}

function risingEdge(record, gamepad, index) {
  return buttonPressed(gamepad, index) && !record.previousButtons[index];
}

function thumbstickAxes(gamepad) {
  if (gamepad.axes.length >= 4) return [gamepad.axes[2], gamepad.axes[3]];
  return [gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0];
}

function updateControllerInput(delta) {
  for (const record of controllers) {
    const gamepad = record.inputSource?.gamepad;
    if (!gamepad) continue;

    const [stickX, stickY] = thumbstickAxes(gamepad);
    if (record.handedness === 'right') {
      const hasFaceButtons = gamepad.buttons.length > 4;
      const menuButton = hasFaceButtons ? 4 : 3;
      if (risingEdge(record, gamepad, menuButton)) toggleMenu();
      if (risingEdge(record, gamepad, 5)) cycleScale();

      if (state.menuOpen) {
        if (Math.abs(stickX) < 0.35) state.menuAxisReady = true;
        if (state.menuAxisReady && Math.abs(stickX) > 0.7) {
          changeShape(stickX > 0 ? 1 : -1);
          state.menuAxisReady = false;
        }
      } else if (state.grabbed) {
        state.grabbed.rotateY(-stickX * delta * 2.1);
        state.grabbed.rotateX(-stickY * delta * 2.1);
      } else {
        state.previewRotation.y -= stickX * delta * 1.9;
        state.distance = THREE.MathUtils.clamp(state.distance - stickY * delta * 1.35, 0.45, 4.5);
      }
    }

    if (record.handedness === 'left') {
      if (risingEdge(record, gamepad, 4)) removeObject(state.hovered);
      if (risingEdge(record, gamepad, 5)) undoLast();

      const deadzone = 0.18;
      const moveX = Math.abs(stickX) > deadzone ? stickX : 0;
      const moveZ = Math.abs(stickY) > deadzone ? stickY : 0;
      if (moveX || moveZ) {
        const activeCamera = renderer.xr.getCamera(camera);
        activeCamera.getWorldDirection(tempVector);
        tempVector.y = 0;
        tempVector.normalize();
        tempVector2.crossVectors(tempVector, camera.up).normalize();
        player.position.addScaledVector(tempVector, -moveZ * delta * 1.5);
        player.position.addScaledVector(tempVector2, -moveX * delta * 1.5);
      }
    }

    record.previousButtons = gamepad.buttons.map((button) => button.pressed);
  }
}

function updatePreview() {
  preview.visible = !state.menuOpen && !state.grabbed;
  if (!preview.visible) return;

  const right = getController('right');
  if (right) {
    rayFromController(right.target);
    preview.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, state.distance);
  } else {
    camera.getWorldPosition(tempVector);
    camera.getWorldDirection(tempVector2);
    preview.position.copy(tempVector).addScaledVector(tempVector2, 2.1);
  }

  preview.quaternion.setFromEuler(state.previewRotation);
  preview.scale.setScalar(state.scales[state.scaleIndex]);
}

function updateHover() {
  if (state.menuOpen || state.grabbed) {
    setHovered(null);
    return;
  }
  const right = getController('right');
  if (!right) return;
  rayFromController(right.target);
  const intersections = raycaster.intersectObjects(buildObjects.children, false);
  setHovered(intersections[0]?.object ?? null);
}

function updateMenuPose() {
  if (!state.menuOpen) return;
  const activeCamera = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
  activeCamera.getWorldPosition(tempVector);
  activeCamera.getWorldDirection(tempVector2);
  activeCamera.getWorldQuaternion(tempQuaternion);
  menu.position.copy(tempVector).addScaledVector(tempVector2, 1.15);
  menu.position.y -= 0.08;
  menu.quaternion.copy(tempQuaternion);
}

function updateDesktopShapeSelection() {
  const select = document.querySelector('#shape-select');
  if (select) select.value = SHAPES[state.shapeIndex].id;
}

const shapeSelect = document.querySelector('#shape-select');
for (const shape of SHAPES) {
  const option = document.createElement('option');
  option.value = shape.id;
  option.textContent = shape.label;
  shapeSelect.appendChild(option);
}
shapeSelect.addEventListener('change', () => {
  const index = SHAPES.findIndex((shape) => shape.id === shapeSelect.value);
  if (index >= 0) {
    state.shapeIndex = index;
    replacePreview();
  }
});
document.querySelector('#rotate-left').addEventListener('click', () => { state.previewRotation.y += Math.PI / 8; });
document.querySelector('#rotate-right').addEventListener('click', () => { state.previewRotation.y -= Math.PI / 8; });
document.querySelector('#scale-button').addEventListener('click', cycleScale);
document.querySelector('#place-button').addEventListener('click', placePreview);
updateDesktopShapeSelection();

addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyM') toggleMenu();
  if (event.code === 'ArrowRight') changeShape(1);
  if (event.code === 'ArrowLeft') changeShape(-1);
  if (event.code === 'Space') placePreview();
  if (event.code === 'KeyQ') state.previewRotation.y += Math.PI / 12;
  if (event.code === 'KeyE') state.previewRotation.y -= Math.PI / 12;
  if (event.code === 'KeyR') cycleScale();
  if (event.code === 'KeyZ') undoLast();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.xr.addEventListener('sessionstart', () => {
  document.querySelector('.intro').style.display = 'none';
  document.querySelector('#desktop-toolbar').style.display = 'none';
});
renderer.xr.addEventListener('sessionend', () => {
  document.querySelector('.intro').style.display = '';
  document.querySelector('#desktop-toolbar').style.display = '';
  toggleMenu(false);
  releaseGrab();
});

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  updateControllerInput(delta);
  updatePreview();
  updateHover();
  updateMenuPose();
  renderer.render(scene, camera);
});
