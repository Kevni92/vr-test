import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import './style.css';

const settings = {
  lengthIndex: 1,
  widthIndex: 1,
  heightIndex: 1,
  difficultyIndex: 1,
  lengths: [10.8, 12.8, 15.2],
  widths: [4.2, 5.0, 5.8],
  heights: [2.9, 3.45, 4.0],
  difficulties: [
    { label: 'Entspannt', reaction: 2.8, idle: 1.7, error: 0.28, speed: 0.92 },
    { label: 'Normal', reaction: 4.8, idle: 2.2, error: 0.14, speed: 1.0 },
    { label: 'Experte', reaction: 7.1, idle: 3.0, error: 0.055, speed: 1.08 },
  ],
};

const COURT = {
  halfWidth: settings.widths[settings.widthIndex] / 2,
  floor: 0,
  ceiling: settings.heights[settings.heightIndex],
  nearEnd: settings.lengths[settings.lengthIndex] / 2,
  farEnd: -settings.lengths[settings.lengthIndex] / 2,
  playerZ: 4.35,
  botZ: -4.35,
};

const BALL_RADIUS = 0.115;
const PADDLE = { halfWidth: 0.34, halfHeight: 0.43, halfDepth: 0.075 };
const WIN_SCORE = 7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050d);
scene.fog = new THREE.FogExp2(0x06101f, 0.042);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.47, 0);

const player = new THREE.Group();
player.name = 'PlayerRig';
player.position.set(0, -0.18, COURT.playerZ);
player.add(camera);
scene.add(player);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor'],
}));

scene.add(new THREE.HemisphereLight(0x9bcfff, 0x080b16, 1.25));
const keyLight = new THREE.DirectionalLight(0xe9f7ff, 2.7);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -7;
keyLight.shadow.camera.right = 7;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -2;
scene.add(keyLight);

const neonBlue = new THREE.MeshStandardMaterial({
  color: 0x42d7ff,
  emissive: 0x0785b5,
  emissiveIntensity: 2.8,
  roughness: 0.28,
  metalness: 0.42,
});
const neonPink = new THREE.MeshStandardMaterial({
  color: 0xff4fa7,
  emissive: 0xa50d55,
  emissiveIntensity: 2.6,
  roughness: 0.3,
  metalness: 0.38,
});
const darkPanel = new THREE.MeshStandardMaterial({
  color: 0x050b18,
  roughness: 0.58,
  metalness: 0.66,
});
const darkPanel2 = new THREE.MeshStandardMaterial({
  color: 0x09172b,
  emissive: 0x020917,
  emissiveIntensity: 0.8,
  roughness: 0.5,
  metalness: 0.55,
});
const glassPanel = new THREE.MeshPhysicalMaterial({
  color: 0x153d72,
  transparent: true,
  opacity: 0.16,
  roughness: 0.12,
  metalness: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const channelGroup = new THREE.Group();
channelGroup.name = 'Channel';
scene.add(channelGroup);

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function addBox(parent, size, position, material, castShadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createChannel() {
  disposeObject(channelGroup);
  channelGroup.clear();

  const length = COURT.nearEnd - COURT.farEnd;
  addBox(channelGroup, [COURT.halfWidth * 2, 0.1, length], [0, -0.05, 0], darkPanel);
  addBox(channelGroup, [COURT.halfWidth * 2, 0.07, length], [0, COURT.ceiling + 0.035, 0], darkPanel2);
  addBox(channelGroup, [0.07, COURT.ceiling, length], [-COURT.halfWidth - 0.035, COURT.ceiling / 2, 0], glassPanel);
  addBox(channelGroup, [0.07, COURT.ceiling, length], [COURT.halfWidth + 0.035, COURT.ceiling / 2, 0], glassPanel);
  addBox(channelGroup, [COURT.halfWidth * 2, COURT.ceiling, 0.09], [0, COURT.ceiling / 2, COURT.farEnd], darkPanel);
  addBox(channelGroup, [COURT.halfWidth * 2, COURT.ceiling, 0.09], [0, COURT.ceiling / 2, COURT.nearEnd], darkPanel);

  const edgeZ = new THREE.BoxGeometry(0.03, 0.03, length - 0.12);
  const edgeX = new THREE.BoxGeometry(COURT.halfWidth * 2 - 0.12, 0.03, 0.03);
  [-COURT.halfWidth + 0.06, COURT.halfWidth - 0.06].forEach((x) => {
    [0.08, COURT.ceiling - 0.08].forEach((y) => {
      const rail = new THREE.Mesh(edgeZ, x < 0 ? neonBlue : neonPink);
      rail.position.set(x, y, 0);
      channelGroup.add(rail);
    });
  });

  const step = Math.max(0.85, length / 13);
  for (let z = COURT.farEnd + 0.55; z < COURT.nearEnd - 0.35; z += step) {
    const sideColor = z < 0 ? neonPink : neonBlue;
    const opposite = z < 0 ? neonBlue : neonPink;

    const floorStrip = new THREE.Mesh(edgeX, sideColor);
    floorStrip.position.set(0, 0.018, z);
    floorStrip.material = floorStrip.material.clone();
    floorStrip.material.transparent = true;
    floorStrip.material.opacity = 0.34;
    channelGroup.add(floorStrip);

    const ceilingStrip = floorStrip.clone();
    ceilingStrip.position.y = COURT.ceiling - 0.018;
    ceilingStrip.material = opposite.clone();
    ceilingStrip.material.transparent = true;
    ceilingStrip.material.opacity = 0.23;
    channelGroup.add(ceilingStrip);

    [-1, 1].forEach((side) => {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, COURT.ceiling * 0.88, 0.025),
        side < 0 ? neonBlue : neonPink,
      );
      rib.position.set(side * (COURT.halfWidth - 0.09), COURT.ceiling * 0.5, z);
      rib.material = rib.material.clone();
      rib.material.transparent = true;
      rib.material.opacity = 0.3;
      channelGroup.add(rib);
    });
  }

  for (let z = COURT.farEnd + 0.8; z < COURT.nearEnd - 0.5; z += step * 2) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.42),
      new THREE.MeshBasicMaterial({ color: z < 0 ? 0xff268d : 0x15cfff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    panel.position.set(-COURT.halfWidth + 0.045, COURT.ceiling * 0.55, z);
    panel.rotation.y = Math.PI / 2;
    channelGroup.add(panel);

    const mirror = panel.clone();
    mirror.position.x = COURT.halfWidth - 0.045;
    mirror.rotation.y = -Math.PI / 2;
    channelGroup.add(mirror);
  }

  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(Math.min(0.82, COURT.halfWidth * 0.32), 0.025, 10, 80),
    new THREE.MeshBasicMaterial({ color: 0xcaf4ff, transparent: true, opacity: 0.46 }),
  );
  centerRing.rotation.x = Math.PI / 2;
  centerRing.position.y = 0.025;
  channelGroup.add(centerRing);

  const portal = new THREE.Group();
  portal.position.set(0, COURT.ceiling * 0.52, COURT.farEnd + 0.12);
  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55 + index * 0.32, 0.018, 8, 80),
      new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xff4fa7 : 0x42d7ff,
        transparent: true,
        opacity: 0.22 - index * 0.035,
      }),
    );
    portal.add(ring);
  }
  channelGroup.add(portal);
  channelGroup.userData.portal = portal;
}

function createStarfield() {
  const count = 950;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = THREE.MathUtils.randFloat(10, 26);
    const angle = Math.random() * Math.PI * 2;
    const height = THREE.MathUtils.randFloat(-7, 11);
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = height;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xbadfff,
    size: 0.035,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'Starfield';
  scene.add(points);
  return points;
}

const starfield = createStarfield();

function createPaddle(color, emissive) {
  const root = new THREE.Group();
  root.name = 'Paddle';

  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x111725, roughness: 0.42, metalness: 0.72 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.34, 18), gripMaterial);
  handle.position.y = 0;
  handle.castShadow = true;
  root.add(handle);

  const hitSurface = new THREE.Group();
  hitSurface.name = 'HitSurface';
  hitSurface.position.set(0, 0.33, 0);
  root.add(hitSurface);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 2.15,
    roughness: 0.24,
    metalness: 0.52,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.029, 14, 56), rimMaterial);
  rim.scale.y = 1.25;
  rim.castShadow = true;
  hitSurface.add(rim);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 48),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.44,
      roughness: 0.18,
      metalness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  face.scale.y = 1.25;
  hitSurface.add(face);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 12), rimMaterial);
  core.position.y = -0.31;
  hitSurface.add(core);

  return { root, hitSurface };
}

const desktopPaddleAnchor = new THREE.Group();
desktopPaddleAnchor.position.set(0.52, 1.0, -0.75);
player.add(desktopPaddleAnchor);

const playerPaddle = createPaddle(0x43ddff, 0x0785b0);
playerPaddle.root.rotation.set(0, 0, -0.05);
desktopPaddleAnchor.add(playerPaddle.root);

const bot = new THREE.Group();
scene.add(bot);

const botBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.27, 0.38, 0.78, 24),
  new THREE.MeshStandardMaterial({ color: 0x401130, emissive: 0x620d42, emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.68 }),
);
botBody.position.y = 0.95;
botBody.castShadow = true;
bot.add(botBody);

const botHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 28, 18),
  new THREE.MeshStandardMaterial({ color: 0x131725, roughness: 0.18, metalness: 0.78 }),
);
botHead.position.y = 1.52;
botHead.castShadow = true;
bot.add(botHead);

const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.08), neonPink);
visor.position.set(0, 1.54, 0.205);
bot.add(visor);

const botPaddle = createPaddle(0xff4fa7, 0x9b0a50);
botPaddle.root.position.set(0.55, 0.96, 0.36);
botPaddle.root.rotation.y = Math.PI;
bot.add(botPaddle.root);

const ballMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0x75dfff,
  emissiveIntensity: 2.5,
  roughness: 0.16,
  metalness: 0.08,
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 18), ballMaterial);
ball.castShadow = true;
scene.add(ball);

const ballGlow = new THREE.PointLight(0x52d9ff, 2.5, 2.8, 2);
ball.add(ballGlow);

const trailPoints = Array.from({ length: 26 }, () => new THREE.Vector3());
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x6fe6ff, transparent: true, opacity: 0.5 });
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

const burstEffects = [];
function spawnBurst(position, color) {
  const count = 18;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2.4),
      THREE.MathUtils.randFloatSpread(2.0),
      THREE.MathUtils.randFloatSpread(2.4),
    ));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  burstEffects.push({ points, velocities, life: 0.28, maxLife: 0.28 });
}

function updateBursts(delta) {
  for (let effectIndex = burstEffects.length - 1; effectIndex >= 0; effectIndex -= 1) {
    const effect = burstEffects[effectIndex];
    effect.life -= delta;
    const attribute = effect.points.geometry.getAttribute('position');
    for (let index = 0; index < effect.velocities.length; index += 1) {
      attribute.array[index * 3] += effect.velocities[index].x * delta;
      attribute.array[index * 3 + 1] += effect.velocities[index].y * delta;
      attribute.array[index * 3 + 2] += effect.velocities[index].z * delta;
      effect.velocities[index].multiplyScalar(0.94);
    }
    attribute.needsUpdate = true;
    effect.points.material.opacity = Math.max(0, effect.life / effect.maxLife);
    if (effect.life <= 0) {
      scene.remove(effect.points);
      effect.points.geometry.dispose();
      effect.points.material.dispose();
      burstEffects.splice(effectIndex, 1);
    }
  }
}

function createScoreboard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), material);
  scene.add(mesh);
  return { canvas, texture, mesh };
}
const scoreboard = createScoreboard();

const state = {
  playerScore: 0,
  botScore: 0,
  rally: 0,
  rallyTime: 0,
  status: 'Menü',
  ballActive: false,
  serveTimer: 1.25,
  matchOver: false,
  hitCooldown: 0,
  botHitCooldown: 0,
  playerPaddleConnected: false,
  botPaddleTarget: new THREE.Vector3(0.55, 1.28, 0.36),
  botPaddleWorldVelocity: new THREE.Vector3(),
  playerPaddleWorldVelocity: new THREE.Vector3(),
  menuOpen: true,
  gameStarted: false,
  calibrating: false,
  calibrated: false,
  paddleOffset: new THREE.Quaternion(),
  hoveredButton: null,
};

const ballVelocity = new THREE.Vector3();
const previousPlayerPaddlePosition = new THREE.Vector3();
const previousBotPaddlePosition = new THREE.Vector3();
const currentPlayerPaddlePosition = new THREE.Vector3();
const currentBotPaddlePosition = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();
const inverseMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
let audioContext = null;
let lastWallSound = 0;
let playerLimitX = 1.8;

const scorePlayerEl = document.querySelector('#score-player');
const scoreBotEl = document.querySelector('#score-bot');
const statusEl = document.querySelector('#game-status');
const pauseButton = document.querySelector('#pause-button');

function updateCourtFromSettings() {
  const length = settings.lengths[settings.lengthIndex];
  COURT.halfWidth = settings.widths[settings.widthIndex] / 2;
  COURT.ceiling = settings.heights[settings.heightIndex];
  COURT.nearEnd = length / 2;
  COURT.farEnd = -length / 2;
  COURT.playerZ = COURT.nearEnd - 2.05;
  COURT.botZ = COURT.farEnd + 2.05;
  playerLimitX = Math.max(1.0, COURT.halfWidth - 0.68);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimitX, playerLimitX);
  player.position.z = COURT.playerZ;
  bot.position.z = COURT.botZ;
  scoreboard.mesh.position.set(0, Math.min(COURT.ceiling - 0.42, 2.72), -0.2);
  createChannel();
  resetBall(1.2);
}

function updateScoreboard() {
  const ctx = scoreboard.canvas.getContext('2d');
  ctx.clearRect(0, 0, scoreboard.canvas.width, scoreboard.canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, scoreboard.canvas.width, 0);
  gradient.addColorStop(0, 'rgba(4, 19, 38, 0.92)');
  gradient.addColorStop(0.5, 'rgba(11, 16, 34, 0.95)');
  gradient.addColorStop(1, 'rgba(42, 8, 33, 0.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scoreboard.canvas.width, scoreboard.canvas.height);
  ctx.strokeStyle = 'rgba(123, 226, 255, 0.7)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, scoreboard.canvas.width - 6, scoreboard.canvas.height - 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#91ecff';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText('DU', 275, 54);
  ctx.fillStyle = '#ff88c2';
  ctx.fillText('BOT', 749, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 112px system-ui, sans-serif';
  ctx.fillText(String(state.playerScore), 275, 139);
  ctx.fillText(String(state.botScore), 749, 139);
  ctx.fillStyle = '#c9dbef';
  ctx.font = '650 30px system-ui, sans-serif';
  ctx.fillText(`${state.status} · Rally ${state.rally}`, 512, 225);
  scoreboard.texture.needsUpdate = true;
  scorePlayerEl.textContent = state.playerScore;
  scoreBotEl.textContent = state.botScore;
  statusEl.textContent = `${state.status} · Rally ${state.rally}`;
}

function sound(frequency, duration = 0.06, volume = 0.05) {
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio is optional and may be blocked before the first interaction.
  }
}

function resetBall(delay = 1.2) {
  state.ballActive = false;
  state.serveTimer = delay;
  state.rally = 0;
  state.rallyTime = 0;
  ball.position.set(0, Math.min(1.42, COURT.ceiling * 0.48), 0);
  ballVelocity.set(0, 0, 0);
  trailPoints.forEach((point) => point.copy(ball.position));
}

function launchServe() {
  const direction = (state.playerScore + state.botScore) % 2 === 0 ? 1 : -1;
  ball.position.set(
    THREE.MathUtils.randFloatSpread(Math.min(0.5, COURT.halfWidth * 0.22)),
    THREE.MathUtils.randFloat(COURT.ceiling * 0.34, COURT.ceiling * 0.56),
    0,
  );
  ballVelocity.set(
    THREE.MathUtils.randFloatSpread(1.1),
    THREE.MathUtils.randFloatSpread(0.48),
    direction * THREE.MathUtils.randFloat(4.65, 5.2),
  );
  state.ballActive = true;
  state.status = 'Spielen';
  sound(520, 0.08, 0.045);
  updateScoreboard();
}

function restartMatch() {
  state.playerScore = 0;
  state.botScore = 0;
  state.matchOver = false;
  state.status = 'Neues Match';
  resetBall(1.05);
  updateScoreboard();
}

function scorePoint(side) {
  if (side === 'player') state.playerScore += 1;
  else state.botScore += 1;
  const lead = Math.abs(state.playerScore - state.botScore);
  const winner = state.playerScore >= WIN_SCORE || state.botScore >= WIN_SCORE;
  if (winner && lead >= 2) {
    state.matchOver = true;
    state.ballActive = false;
    state.status = state.playerScore > state.botScore ? 'Sieg! A öffnet Menü' : 'Bot gewinnt · A öffnet Menü';
    sound(state.playerScore > state.botScore ? 880 : 180, 0.35, 0.08);
  } else {
    state.status = side === 'player' ? 'Punkt für dich' : 'Punkt für den Bot';
    resetBall(1.3);
    sound(side === 'player' ? 720 : 220, 0.16, 0.065);
  }
  updateScoreboard();
}

function pulseController(record, strength = 0.55, duration = 55) {
  const gamepad = record?.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] ?? gamepad?.vibrationActuator;
  actuator?.pulse?.(strength, duration).catch?.(() => {});
}

function getStickAxes(gamepad) {
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  if (gamepad.axes.length >= 4) return { x: gamepad.axes[2] ?? 0, y: gamepad.axes[3] ?? 0 };
  return { x: gamepad.axes[0] ?? 0, y: gamepad.axes[1] ?? 0 };
}

function createTextTexture(text, width = 1024, height = 256, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }
  if (options.border) {
    context.strokeStyle = options.border;
    context.lineWidth = options.borderWidth ?? 5;
    context.strokeRect(3, 3, width - 6, height - 6);
  }
  context.fillStyle = options.color ?? '#ffffff';
  context.font = options.font ?? '700 66px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { canvas, context, texture };
}

function makeLabel(text, width, height, options = {}) {
  const textTexture = createTextTexture(text, 1024, 256, options);
  const material = new THREE.MeshBasicMaterial({ map: textTexture.texture, transparent: true, toneMapped: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 41;
  mesh.userData.textTexture = textTexture;
  return mesh;
}

function setLabelText(mesh, text, options = {}) {
  const { canvas, context, texture } = mesh.userData.textTexture;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (options.border) {
    context.strokeStyle = options.border;
    context.lineWidth = options.borderWidth ?? 5;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  }
  context.fillStyle = options.color ?? '#ffffff';
  context.font = options.font ?? '700 66px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
}

const menuRoot = new THREE.Group();
menuRoot.name = 'PauseMenu';
scene.add(menuRoot);
const menuButtons = [];

const menuBackdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(3.0, 2.45),
  new THREE.MeshBasicMaterial({ color: 0x030817, transparent: true, opacity: 0.96, depthTest: false }),
);
menuBackdrop.position.z = -0.035;
menuBackdrop.renderOrder = 35;
menuRoot.add(menuBackdrop);

const menuGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(3.08, 2.53),
  new THREE.MeshBasicMaterial({ color: 0x18cfff, transparent: true, opacity: 0.16, depthTest: false }),
);
menuGlow.position.z = -0.055;
menuGlow.renderOrder = 34;
menuRoot.add(menuGlow);

const menuTitle = makeLabel('NEON CHANNEL', 2.55, 0.34, { color: '#d9f8ff', font: '900 92px system-ui, sans-serif' });
menuTitle.position.set(0, 0.91, 0);
menuRoot.add(menuTitle);
const menuSubtitle = makeLabel('R2 zeigt & klickt · A öffnet dieses Menü', 2.25, 0.18, { color: '#78dfff', font: '650 44px system-ui, sans-serif' });
menuSubtitle.position.set(0, 0.66, 0);
menuRoot.add(menuSubtitle);

function createMenuButton(label, x, y, width, action, accent = 0x17304d) {
  const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.96, depthTest: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.25), material);
  panel.position.set(x, y, 0);
  panel.renderOrder = 39;
  panel.userData.menuAction = action;
  panel.userData.baseColor = accent;
  const text = makeLabel(label, width * 0.92, 0.16, { color: '#ffffff', font: '750 56px system-ui, sans-serif' });
  text.position.z = 0.006;
  panel.add(text);
  panel.userData.labelMesh = text;
  menuRoot.add(panel);
  menuButtons.push(panel);
  return panel;
}

const rowLabels = {};
function createSettingRow(key, y) {
  createMenuButton('−', -1.07, y, 0.34, `${key}:down`, 0x163252);
  rowLabels[key] = makeLabel('', 1.45, 0.2, { color: '#e9f9ff', font: '750 58px system-ui, sans-serif' });
  rowLabels[key].position.set(0, y, 0.004);
  menuRoot.add(rowLabels[key]);
  createMenuButton('+', 1.07, y, 0.34, `${key}:up`, 0x4b1941);
}

createSettingRow('length', 0.34);
createSettingRow('width', 0.04);
createSettingRow('height', -0.26);
createSettingRow('difficulty', -0.56);
const startButton = createMenuButton('SPIEL STARTEN', 0, -0.96, 2.15, 'start', 0x0f708f);
const restartButton3D = createMenuButton('NEUES MATCH', 0, -1.25, 1.55, 'restart', 0x4d1740);
restartButton3D.visible = false;

function updateMenuLabels() {
  setLabelText(rowLabels.length, `Raumtiefe  ${settings.lengths[settings.lengthIndex].toFixed(1)} m`, { color: '#e9f9ff', font: '750 58px system-ui, sans-serif' });
  setLabelText(rowLabels.width, `Raumbreite  ${settings.widths[settings.widthIndex].toFixed(1)} m`, { color: '#e9f9ff', font: '750 58px system-ui, sans-serif' });
  setLabelText(rowLabels.height, `Raumhöhe  ${settings.heights[settings.heightIndex].toFixed(2)} m`, { color: '#e9f9ff', font: '750 58px system-ui, sans-serif' });
  setLabelText(rowLabels.difficulty, `KI  ${settings.difficulties[settings.difficultyIndex].label}`, { color: '#ffd4eb', font: '750 58px system-ui, sans-serif' });
  setLabelText(startButton.userData.labelMesh, state.gameStarted ? 'WEITERSPIELEN' : 'SPIEL STARTEN', { color: '#ffffff', font: '800 58px system-ui, sans-serif' });
  restartButton3D.visible = state.gameStarted;
}

function positionMenuInFront() {
  camera.getWorldPosition(tempVector);
  camera.getWorldQuaternion(tempQuaternion);
  const forward = tempVector2.set(0, 0, -1).applyQuaternion(tempQuaternion).normalize();
  menuRoot.position.copy(tempVector).addScaledVector(forward, 2.75);
  menuRoot.position.y = tempVector.y + 0.02;
  menuRoot.quaternion.copy(tempQuaternion);
}

function openMenu() {
  state.menuOpen = true;
  state.status = state.gameStarted ? 'Pause' : 'Startmenü';
  menuRoot.visible = true;
  positionMenuInFront();
  updateMenuLabels();
  updateScoreboard();
  pauseButton.textContent = 'Menü geöffnet';
}

function closeMenu() {
  state.menuOpen = false;
  menuRoot.visible = false;
  state.hoveredButton = null;
  menuButtons.forEach((button) => button.material.color.setHex(button.userData.baseColor));
  if (!state.gameStarted) {
    state.gameStarted = true;
    restartMatch();
  } else {
    state.status = state.ballActive ? 'Spielen' : 'Bereit';
    updateScoreboard();
  }
  pauseButton.textContent = 'Pause / Einstellungen';
}

function cycleSetting(key, direction) {
  if (key === 'length') settings.lengthIndex = THREE.MathUtils.clamp(settings.lengthIndex + direction, 0, settings.lengths.length - 1);
  if (key === 'width') settings.widthIndex = THREE.MathUtils.clamp(settings.widthIndex + direction, 0, settings.widths.length - 1);
  if (key === 'height') settings.heightIndex = THREE.MathUtils.clamp(settings.heightIndex + direction, 0, settings.heights.length - 1);
  if (key === 'difficulty') settings.difficultyIndex = THREE.MathUtils.clamp(settings.difficultyIndex + direction, 0, settings.difficulties.length - 1);
  updateCourtFromSettings();
  updateMenuLabels();
  sound(410 + direction * 45, 0.045, 0.035);
}

function activateMenuAction(action) {
  if (!action) return;
  if (action === 'start') {
    closeMenu();
    return;
  }
  if (action === 'restart') {
    restartMatch();
    closeMenu();
    return;
  }
  const [key, change] = action.split(':');
  cycleSetting(key, change === 'up' ? 1 : -1);
}

function setMenuHover(button) {
  if (state.hoveredButton === button) return;
  if (state.hoveredButton) state.hoveredButton.material.color.setHex(state.hoveredButton.userData.baseColor);
  state.hoveredButton = button;
  if (button) button.material.color.setHex(0x238eb2);
}

const controllerModelFactory = new XRControllerModelFactory();
const controllers = [];
let rightControllerRecord = null;
let playerPaddleAnchor = null;

function desiredCalibrationQuaternion() {
  return tempQuaternion2.setFromEuler(new THREE.Euler(0, Math.PI, 0));
}

function applyCalibrationPreview() {
  if (!playerPaddleAnchor) return;
  playerPaddleAnchor.parent.getWorldQuaternion(tempQuaternion);
  const desired = desiredCalibrationQuaternion();
  playerPaddleAnchor.quaternion.copy(tempQuaternion.invert().multiply(desired));
}

function startCalibration() {
  if (!playerPaddleAnchor || state.menuOpen) return;
  state.calibrating = true;
  state.status = 'R2 halten · Controller bequem ausrichten';
  applyCalibrationPreview();
  updateScoreboard();
}

function finishCalibration() {
  if (!state.calibrating || !playerPaddleAnchor) return;
  state.calibrating = false;
  state.calibrated = true;
  state.paddleOffset.copy(playerPaddleAnchor.quaternion);
  state.status = 'Schläger justiert';
  pulseController(rightControllerRecord, 0.75, 90);
  sound(760, 0.1, 0.05);
  updateScoreboard();
}

function attachPlayerPaddle(grip) {
  playerPaddleAnchor = new THREE.Group();
  playerPaddleAnchor.name = 'CalibratedPaddleAnchor';
  grip.add(playerPaddleAnchor);
  playerPaddleAnchor.add(playerPaddle.root);
  playerPaddle.root.position.set(0, -0.03, -0.08);
  playerPaddle.root.rotation.set(0, 0, 0);
  if (state.calibrated) playerPaddleAnchor.quaternion.copy(state.paddleOffset);
  else playerPaddleAnchor.rotation.set(-0.18, Math.PI, 0.02);
  state.playerPaddleConnected = true;
}

function restoreDesktopPaddle() {
  desktopPaddleAnchor.add(playerPaddle.root);
  playerPaddle.root.position.set(0, 0, 0);
  playerPaddle.root.rotation.set(0, 0, -0.05);
  playerPaddleAnchor = null;
  state.playerPaddleConnected = false;
}

function rayFromController(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  raycaster.far = 5;
}

function updateMenuPointer(record) {
  if (record !== rightControllerRecord) return;
  record.ray.visible = state.menuOpen;
  if (!state.menuOpen) {
    setMenuHover(null);
    return;
  }
  rayFromController(record.target);
  const hit = raycaster.intersectObjects(menuButtons.filter((button) => button.visible), false)[0];
  setMenuHover(hit?.object ?? null);
  record.ray.scale.z = hit ? hit.distance : 3.2;
}

function clickMenuFromController(record) {
  if (record !== rightControllerRecord || !state.menuOpen) return;
  updateMenuPointer(record);
  if (state.hoveredButton) activateMenuAction(state.hoveredButton.userData.menuAction);
}

function addController(index) {
  const target = renderer.xr.getController(index);
  const grip = renderer.xr.getControllerGrip(index);
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x7ce9ff, transparent: true, opacity: 0.95 }),
  );
  ray.scale.z = 3;
  ray.visible = false;
  target.add(ray);
  grip.add(controllerModelFactory.createControllerModel(grip));
  player.add(target, grip);

  const record = { target, grip, ray, inputSource: null, handedness: 'none', previousButtons: [] };
  controllers.push(record);

  target.addEventListener('connected', (event) => {
    record.inputSource = event.data;
    record.handedness = event.data.handedness;
    if (record.handedness === 'right') {
      rightControllerRecord = record;
      attachPlayerPaddle(grip);
    }
  });

  target.addEventListener('disconnected', () => {
    if (record.handedness === 'right') {
      rightControllerRecord = null;
      restoreDesktopPaddle();
    }
    record.inputSource = null;
    record.handedness = 'none';
    record.previousButtons = [];
  });

  target.addEventListener('selectstart', () => {
    if (record.handedness !== 'right') return;
    if (state.menuOpen) clickMenuFromController(record);
    else startCalibration();
  });

  target.addEventListener('selectend', () => {
    if (record.handedness === 'right') finishCalibration();
  });
}
addController(0);
addController(1);

function updateControllerInput(delta) {
  controllers.forEach((record) => {
    const gamepad = record.inputSource?.gamepad;
    if (!gamepad) return;
    const buttons = gamepad.buttons;
    const wasPressed = (index) => Boolean(record.previousButtons[index]);
    const isPressed = (index) => Boolean(buttons[index]?.pressed);

    if (record.handedness === 'left' && !state.menuOpen) {
      const stick = getStickAxes(gamepad);
      const input = Math.abs(stick.x) > 0.12 ? stick.x : 0;
      player.position.x = THREE.MathUtils.clamp(player.position.x + input * 2.35 * delta, -playerLimitX, playerLimitX);
    }

    if (record.handedness === 'right' && isPressed(4) && !wasPressed(4)) {
      if (!state.menuOpen) openMenu();
    }

    record.previousButtons = buttons.map((button) => button.pressed);
    updateMenuPointer(record);
  });
}

function updatePaddleVelocities(delta) {
  playerPaddle.hitSurface.getWorldPosition(currentPlayerPaddlePosition);
  botPaddle.hitSurface.getWorldPosition(currentBotPaddlePosition);
  if (delta > 0.0001) {
    state.playerPaddleWorldVelocity.subVectors(currentPlayerPaddlePosition, previousPlayerPaddlePosition).divideScalar(delta);
    state.botPaddleWorldVelocity.subVectors(currentBotPaddlePosition, previousBotPaddlePosition).divideScalar(delta);
    if (state.playerPaddleWorldVelocity.length() > 10) state.playerPaddleWorldVelocity.setLength(10);
    if (state.botPaddleWorldVelocity.length() > 8) state.botPaddleWorldVelocity.setLength(8);
  }
  previousPlayerPaddlePosition.copy(currentPlayerPaddlePosition);
  previousBotPaddlePosition.copy(currentBotPaddlePosition);
}

function predictBotTarget() {
  const difficulty = settings.difficulties[settings.difficultyIndex];
  let targetX = 0.45;
  let targetY = Math.min(1.28, COURT.ceiling * 0.48);
  if (state.ballActive && ballVelocity.z < -0.2) {
    const paddleZ = COURT.botZ + 0.36;
    const travelTime = Math.max(0, (paddleZ - ball.position.z) / ballVelocity.z);
    targetX = ball.position.x + ballVelocity.x * travelTime;
    targetY = ball.position.y + ballVelocity.y * travelTime;
    const error = Math.sin(performance.now() * 0.0017 + state.rally) * difficulty.error;
    targetX += error;
    targetY += error * 0.45;
  }
  state.botPaddleTarget.set(
    THREE.MathUtils.clamp(targetX, -Math.max(0.8, COURT.halfWidth - 0.78), Math.max(0.8, COURT.halfWidth - 0.78)),
    THREE.MathUtils.clamp(targetY - 0.32, 0.48, COURT.ceiling - 0.7),
    0.36,
  );
}

function updateBot(delta) {
  predictBotTarget();
  const difficulty = settings.difficulties[settings.difficultyIndex];
  const response = state.ballActive && ballVelocity.z < 0 ? difficulty.reaction : difficulty.idle;
  botPaddle.root.position.lerp(state.botPaddleTarget, 1 - Math.exp(-response * delta));
  botPaddle.root.rotation.y = Math.PI + THREE.MathUtils.clamp(ballVelocity.x * 0.035, -0.24, 0.24);
  const bodyOffset = botPaddle.root.position.x * 0.42;
  botBody.position.x = THREE.MathUtils.damp(botBody.position.x, bodyOffset, 2.4, delta);
  botHead.position.x = THREE.MathUtils.damp(botHead.position.x, bodyOffset, 2.8, delta);
  visor.position.x = botHead.position.x;
  botBody.rotation.z = THREE.MathUtils.damp(botBody.rotation.z, -botPaddle.root.position.x * 0.06, 3.2, delta);
}

function collideWithPaddle(paddleSurface, paddleVelocity, side) {
  const cooldownKey = side === 'player' ? 'hitCooldown' : 'botHitCooldown';
  if (state[cooldownKey] > 0) return false;
  if (side === 'player' && ballVelocity.z <= 0) return false;
  if (side === 'bot' && ballVelocity.z >= 0) return false;

  paddleSurface.updateWorldMatrix(true, false);
  inverseMatrix.copy(paddleSurface.matrixWorld).invert();
  const localBall = tempVector.copy(ball.position).applyMatrix4(inverseMatrix);
  const ellipse = (localBall.x * localBall.x) / ((PADDLE.halfWidth + BALL_RADIUS) ** 2)
    + (localBall.y * localBall.y) / ((PADDLE.halfHeight + BALL_RADIUS) ** 2);
  if (ellipse > 1 || Math.abs(localBall.z) > PADDLE.halfDepth + BALL_RADIUS) return false;

  paddleSurface.getWorldQuaternion(tempQuaternion);
  const normal = tempVector2.set(0, 0, 1).applyQuaternion(tempQuaternion).normalize();
  if (side === 'player' && normal.z > 0) normal.negate();
  if (side === 'bot' && normal.z < 0) normal.negate();

  const relativeVelocity = ballVelocity.clone().sub(paddleVelocity);
  const approach = relativeVelocity.dot(normal);
  if (approach < 0) relativeVelocity.addScaledVector(normal, -2 * approach);
  ballVelocity.copy(relativeVelocity).addScaledVector(paddleVelocity, side === 'player' ? 0.54 : 0.2);
  ballVelocity.x += localBall.x * 3.1;
  ballVelocity.y += localBall.y * 2.25;

  const difficulty = settings.difficulties[settings.difficultyIndex];
  const minimumForwardSpeed = Math.min(9.4, (5.05 + state.rally * 0.13) * (side === 'bot' ? difficulty.speed : 1));
  if (side === 'player') ballVelocity.z = -Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed);
  else ballVelocity.z = Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed * 0.96);

  const speed = THREE.MathUtils.clamp(ballVelocity.length(), 5.1, 13.8);
  ballVelocity.setLength(speed);
  ball.position.addScaledVector(normal, BALL_RADIUS + 0.035);
  state[cooldownKey] = 0.14;
  state.rally += 1;
  state.status = side === 'player' ? 'Starker Return' : 'Bot-Return';
  spawnBurst(ball.position, side === 'player' ? 0x42d7ff : 0xff4fa7);
  sound(side === 'player' ? 680 : 430, 0.055, 0.055);
  if (side === 'player') pulseController(rightControllerRecord);
  updateScoreboard();
  return true;
}

function updateTrail() {
  for (let index = trailPoints.length - 1; index > 0; index -= 1) {
    trailPoints[index].lerp(trailPoints[index - 1], 0.62);
  }
  trailPoints[0].copy(ball.position);
  trailGeometry.setFromPoints(trailPoints);
}

function updateBallVisuals(delta) {
  const speed = ballVelocity.length();
  const normalized = THREE.MathUtils.clamp((speed - 4.8) / 8.5, 0, 1);
  const hue = THREE.MathUtils.lerp(0.54, 0.94, normalized);
  ballMaterial.color.setHSL(hue, 0.95, 0.68);
  ballMaterial.emissive.setHSL(hue, 1, 0.47);
  ballMaterial.emissiveIntensity = 2.2 + normalized * 3.4;
  ballGlow.color.setHSL(hue, 1, 0.58);
  ballGlow.intensity = 2.2 + normalized * 4.8;
  ballGlow.distance = 2.5 + normalized * 2.4;
  trailMaterial.color.setHSL(hue, 1, 0.62);
  trailMaterial.opacity = 0.28 + normalized * 0.62;
  trail.scale.setScalar(1 + normalized * 0.055);
  ball.scale.setScalar(1 + Math.sin(performance.now() * 0.012) * normalized * 0.06);

  if (state.ballActive && !state.menuOpen) {
    state.rallyTime += delta;
    const acceleration = 0.015 + state.rally * 0.0015;
    const maxSpeed = 10.3 + settings.difficultyIndex * 1.2 + Math.min(2.0, state.rallyTime * 0.025);
    const nextSpeed = Math.min(maxSpeed, speed + acceleration * delta);
    if (speed > 0.001) ballVelocity.setLength(nextSpeed);
  }
}

function wallBounce(axis, boundary, direction) {
  ball.position[axis] = boundary;
  ballVelocity[axis] = Math.abs(ballVelocity[axis]) * direction * 0.97;
  const now = performance.now();
  if (now - lastWallSound > 70) {
    sound(285 + Math.random() * 30, 0.035, 0.025);
    lastWallSound = now;
  }
}

function simulateBall(delta) {
  if (state.menuOpen || !state.gameStarted) return;
  if (!state.ballActive) {
    if (!state.matchOver) {
      state.serveTimer -= delta;
      state.status = state.serveTimer > 0.75 ? 'Bereit' : 'Serve';
      if (state.serveTimer <= 0) launchServe();
    }
    return;
  }

  const maxTravel = Math.max(BALL_RADIUS * 0.7, 0.05);
  const steps = THREE.MathUtils.clamp(Math.ceil(ballVelocity.length() * delta / maxTravel), 1, 10);
  const stepDelta = delta / steps;

  for (let step = 0; step < steps; step += 1) {
    ball.position.addScaledVector(ballVelocity, stepDelta);
    const xLimit = COURT.halfWidth - BALL_RADIUS;
    if (ball.position.x > xLimit) wallBounce('x', xLimit, -1);
    if (ball.position.x < -xLimit) wallBounce('x', -xLimit, 1);
    const topLimit = COURT.ceiling - BALL_RADIUS;
    const bottomLimit = COURT.floor + BALL_RADIUS;
    if (ball.position.y > topLimit) wallBounce('y', topLimit, -1);
    if (ball.position.y < bottomLimit) wallBounce('y', bottomLimit, 1);
    collideWithPaddle(playerPaddle.hitSurface, state.playerPaddleWorldVelocity, 'player');
    collideWithPaddle(botPaddle.hitSurface, state.botPaddleWorldVelocity, 'bot');
    if (ball.position.z > COURT.nearEnd - 0.25) {
      scorePoint('bot');
      break;
    }
    if (ball.position.z < COURT.farEnd + 0.25) {
      scorePoint('player');
      break;
    }
  }
}

const desktopPointer = { x: 0.52, y: 1.3 };
window.addEventListener('pointermove', (event) => {
  const normalizedX = event.clientX / innerWidth;
  const normalizedY = event.clientY / innerHeight;
  desktopPointer.x = THREE.MathUtils.lerp(-1.55, 1.55, normalizedX);
  desktopPointer.y = THREE.MathUtils.lerp(2.15, 0.55, normalizedY);
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') player.position.x = Math.max(-playerLimitX, player.position.x - 0.18);
  if (event.code === 'KeyD' || event.code === 'ArrowRight') player.position.x = Math.min(playerLimitX, player.position.x + 0.18);
  if (event.code === 'Escape' || event.code === 'KeyM') openMenu();
  if (event.code === 'Space' && state.menuOpen) closeMenu();
  if (event.code === 'KeyR') restartMatch();
});

pauseButton.addEventListener('click', () => {
  if (state.menuOpen) closeMenu();
  else openMenu();
});

document.querySelector('#restart-button').addEventListener('click', restartMatch);

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('xr-active');
  audioContext?.resume?.();
  state.gameStarted = false;
  openMenu();
});
renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('xr-active');
  restoreDesktopPaddle();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

updateCourtFromSettings();
updateScoreboard();
updateMenuLabels();
menuRoot.visible = true;
positionMenuInFront();
playerPaddle.hitSurface.getWorldPosition(previousPlayerPaddlePosition);
botPaddle.hitSurface.getWorldPosition(previousBotPaddlePosition);

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.035);
  updateControllerInput(delta);

  if (!renderer.xr.isPresenting) {
    desktopPaddleAnchor.position.x = THREE.MathUtils.damp(desktopPaddleAnchor.position.x, desktopPointer.x - player.position.x, 11, delta);
    desktopPaddleAnchor.position.y = THREE.MathUtils.damp(desktopPaddleAnchor.position.y, desktopPointer.y, 11, delta);
    if (state.menuOpen) positionMenuInFront();
  }

  if (state.calibrating) applyCalibrationPreview();
  updateBot(delta);
  scene.updateMatrixWorld(true);
  updatePaddleVelocities(delta);
  state.hitCooldown = Math.max(0, state.hitCooldown - delta);
  state.botHitCooldown = Math.max(0, state.botHitCooldown - delta);
  simulateBall(delta);
  updateBallVisuals(delta);
  updateTrail();
  updateBursts(delta);

  starfield.rotation.y += delta * 0.006;
  starfield.position.z = Math.sin(performance.now() * 0.00008) * 0.35;
  const portal = channelGroup.userData.portal;
  if (portal) {
    portal.rotation.z += delta * 0.08;
    portal.children.forEach((ring, index) => {
      ring.rotation.z += delta * (index % 2 === 0 ? 0.2 : -0.16);
      ring.material.opacity = 0.1 + Math.sin(performance.now() * 0.0015 + index) * 0.035 + (0.11 - index * 0.018);
    });
  }

  renderer.render(scene, camera);
});
