import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import './style.css';

const COURT = {
  halfWidth: 2.5,
  floor: 0,
  ceiling: 3.45,
  nearEnd: 6.35,
  farEnd: -6.35,
  playerZ: 4.35,
  botZ: -4.35,
};

const BALL_RADIUS = 0.115;
const PADDLE = { halfWidth: 0.34, halfHeight: 0.43, halfDepth: 0.075 };
const PLAYER_LIMIT_X = 1.82;
const WIN_SCORE = 7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712);
scene.fog = new THREE.FogExp2(0x071020, 0.045);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
camera.position.set(0, 1.65, 0);

const player = new THREE.Group();
player.name = 'PlayerRig';
player.position.set(0, 0, COURT.playerZ);
player.add(camera);
scene.add(player);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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

scene.add(new THREE.HemisphereLight(0x9dc8ff, 0x101529, 1.65));
const keyLight = new THREE.DirectionalLight(0xeaf5ff, 2.4);
keyLight.position.set(2.5, 5.5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 7;
keyLight.shadow.camera.bottom = -2;
scene.add(keyLight);

const neonBlue = new THREE.MeshStandardMaterial({
  color: 0x42d7ff,
  emissive: 0x087fa5,
  emissiveIntensity: 2.2,
  roughness: 0.36,
  metalness: 0.28,
});
const neonPink = new THREE.MeshStandardMaterial({
  color: 0xff4fa7,
  emissive: 0xa50d55,
  emissiveIntensity: 2.1,
  roughness: 0.36,
  metalness: 0.25,
});
const darkPanel = new THREE.MeshStandardMaterial({
  color: 0x081326,
  roughness: 0.72,
  metalness: 0.38,
});
const glassPanel = new THREE.MeshPhysicalMaterial({
  color: 0x16325b,
  transparent: true,
  opacity: 0.27,
  roughness: 0.18,
  metalness: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function addBox(size, position, material, castShadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createChannel() {
  addBox([COURT.halfWidth * 2, 0.08, 12.8], [0, -0.04, 0], darkPanel);
  addBox([COURT.halfWidth * 2, 0.06, 12.8], [0, COURT.ceiling + 0.03, 0], darkPanel);
  addBox([0.08, COURT.ceiling, 12.8], [-COURT.halfWidth - 0.04, COURT.ceiling / 2, 0], glassPanel);
  addBox([0.08, COURT.ceiling, 12.8], [COURT.halfWidth + 0.04, COURT.ceiling / 2, 0], glassPanel);
  addBox([COURT.halfWidth * 2, COURT.ceiling, 0.08], [0, COURT.ceiling / 2, COURT.farEnd], darkPanel);
  addBox([COURT.halfWidth * 2, COURT.ceiling, 0.08], [0, COURT.ceiling / 2, COURT.nearEnd], darkPanel);

  const railGeometryZ = new THREE.BoxGeometry(0.025, 0.025, 12.55);
  const railGeometryX = new THREE.BoxGeometry(COURT.halfWidth * 2, 0.025, 0.025);
  [-COURT.halfWidth + 0.06, COURT.halfWidth - 0.06].forEach((x) => {
    [0.08, COURT.ceiling - 0.08].forEach((y) => {
      const rail = new THREE.Mesh(railGeometryZ, x < 0 ? neonBlue : neonPink);
      rail.position.set(x, y, 0);
      scene.add(rail);
    });
  });

  for (let z = -5.5; z <= 5.5; z += 1.1) {
    const floorLine = new THREE.Mesh(railGeometryX, z < 0 ? neonPink : neonBlue);
    floorLine.position.set(0, 0.012, z);
    floorLine.material = floorLine.material.clone();
    floorLine.material.transparent = true;
    floorLine.material.opacity = 0.28;
    scene.add(floorLine);

    const ceilingLine = floorLine.clone();
    ceilingLine.position.y = COURT.ceiling - 0.012;
    scene.add(ceilingLine);
  }

  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.018, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0xbcecff, transparent: true, opacity: 0.5 }),
  );
  centerRing.rotation.x = Math.PI / 2;
  centerRing.position.y = 0.018;
  scene.add(centerRing);
}
createChannel();

function createPaddle(color, emissive) {
  const root = new THREE.Group();
  root.name = 'Paddle';

  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x151b28, roughness: 0.48, metalness: 0.65 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.36, 18), gripMaterial);
  handle.position.y = 0.01;
  handle.castShadow = true;
  root.add(handle);

  const hitSurface = new THREE.Group();
  hitSurface.name = 'HitSurface';
  hitSurface.position.set(0, 0.34, -0.08);
  root.add(hitSurface);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 1.75,
    roughness: 0.28,
    metalness: 0.5,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.028, 14, 56), rimMaterial);
  rim.scale.y = 1.25;
  rim.castShadow = true;
  hitSurface.add(rim);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 48),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.5,
      roughness: 0.22,
      metalness: 0.1,
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
desktopPaddleAnchor.position.set(0.52, 1.05, -0.8);
player.add(desktopPaddleAnchor);

const playerPaddle = createPaddle(0x43ddff, 0x0785b0);
playerPaddle.root.rotation.set(0, 0, -0.08);
desktopPaddleAnchor.add(playerPaddle.root);

const bot = new THREE.Group();
bot.position.set(0, 0, COURT.botZ);
scene.add(bot);

const botBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.27, 0.38, 0.78, 24),
  new THREE.MeshStandardMaterial({ color: 0x401130, emissive: 0x620d42, emissiveIntensity: 0.7, roughness: 0.34, metalness: 0.62 }),
);
botBody.position.y = 1.05;
botBody.castShadow = true;
bot.add(botBody);

const botHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 28, 18),
  new THREE.MeshStandardMaterial({ color: 0x15192a, roughness: 0.22, metalness: 0.72 }),
);
botHead.position.y = 1.63;
botHead.castShadow = true;
bot.add(botHead);

const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.09, 0.08),
  neonPink,
);
visor.position.set(0, 1.65, 0.205);
bot.add(visor);

const botPaddle = createPaddle(0xff4fa7, 0x9b0a50);
botPaddle.root.position.set(0.55, 1.02, 0.36);
botPaddle.root.rotation.y = Math.PI;
bot.add(botPaddle.root);

const ballMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0x75dfff,
  emissiveIntensity: 2.2,
  roughness: 0.2,
  metalness: 0.08,
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 18), ballMaterial);
ball.castShadow = true;
scene.add(ball);

const ballGlow = new THREE.PointLight(0x52d9ff, 2.2, 2.4, 2);
ball.add(ballGlow);

const trailPoints = Array.from({ length: 14 }, () => new THREE.Vector3());
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trail = new THREE.Line(
  trailGeometry,
  new THREE.LineBasicMaterial({ color: 0x6fe6ff, transparent: true, opacity: 0.6 }),
);
scene.add(trail);

function createScoreboard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), material);
  mesh.position.set(0, 2.93, -0.2);
  scene.add(mesh);
  return { canvas, texture };
}
const scoreboard = createScoreboard();

const state = {
  playerScore: 0,
  botScore: 0,
  rally: 0,
  status: 'Bereit',
  ballActive: false,
  serveTimer: 1.25,
  matchOver: false,
  hitCooldown: 0,
  botHitCooldown: 0,
  playerPaddleConnected: false,
  botPaddleTarget: new THREE.Vector3(0.55, 1.34, 0.36),
  botPaddleWorldVelocity: new THREE.Vector3(),
  playerPaddleWorldVelocity: new THREE.Vector3(),
};

const ballVelocity = new THREE.Vector3();
const previousPlayerPaddlePosition = new THREE.Vector3();
const previousBotPaddlePosition = new THREE.Vector3();
const currentPlayerPaddlePosition = new THREE.Vector3();
const currentBotPaddlePosition = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const inverseMatrix = new THREE.Matrix4();
const clock = new THREE.Clock();
let audioContext = null;
let lastWallSound = 0;

const scorePlayerEl = document.querySelector('#score-player');
const scoreBotEl = document.querySelector('#score-bot');
const statusEl = document.querySelector('#game-status');

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
  ball.position.set(0, 1.5, 0);
  ballVelocity.set(0, 0, 0);
  trailPoints.forEach((point) => point.copy(ball.position));
}

function launchServe() {
  const direction = (state.playerScore + state.botScore) % 2 === 0 ? 1 : -1;
  ball.position.set(THREE.MathUtils.randFloatSpread(0.45), THREE.MathUtils.randFloat(1.25, 1.9), 0);
  ballVelocity.set(
    THREE.MathUtils.randFloatSpread(1.15),
    THREE.MathUtils.randFloatSpread(0.55),
    direction * THREE.MathUtils.randFloat(4.7, 5.25),
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
  resetBall(1.1);
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
    state.status = state.playerScore > state.botScore ? 'Sieg! A für Neustart' : 'Bot gewinnt · A für Neustart';
    sound(state.playerScore > state.botScore ? 880 : 180, 0.35, 0.08);
  } else {
    state.status = side === 'player' ? 'Punkt für dich' : 'Punkt für den Bot';
    resetBall(1.35);
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

const controllerModelFactory = new XRControllerModelFactory();
const controllers = [];
let rightControllerRecord = null;

function attachPlayerPaddle(grip) {
  grip.add(playerPaddle.root);
  playerPaddle.root.position.set(0, 0, -0.11);
  playerPaddle.root.rotation.set(0, 0, -0.08);
  state.playerPaddleConnected = true;
}

function restoreDesktopPaddle() {
  desktopPaddleAnchor.add(playerPaddle.root);
  playerPaddle.root.position.set(0, 0, 0);
  playerPaddle.root.rotation.set(0, 0, -0.08);
  state.playerPaddleConnected = false;
}

function addController(index) {
  const target = renderer.xr.getController(index);
  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  player.add(target, grip);

  const record = { target, grip, inputSource: null, handedness: 'none', previousButtons: [] };
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

    if (record.handedness === 'left') {
      const stick = getStickAxes(gamepad);
      const input = Math.abs(stick.x) > 0.12 ? stick.x : 0;
      player.position.x = THREE.MathUtils.clamp(player.position.x + input * 2.35 * delta, -PLAYER_LIMIT_X, PLAYER_LIMIT_X);
    }

    if (record.handedness === 'right' && isPressed(3) && !wasPressed(3)) {
      restartMatch();
    }

    record.previousButtons = buttons.map((button) => button.pressed);
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
  let targetX = 0.5;
  let targetY = 1.38;
  if (state.ballActive && ballVelocity.z < -0.2) {
    const paddleZ = COURT.botZ + 0.36;
    const travelTime = Math.max(0, (paddleZ - ball.position.z) / ballVelocity.z);
    targetX = ball.position.x + ballVelocity.x * travelTime;
    targetY = ball.position.y + ballVelocity.y * travelTime;
    const error = Math.sin(performance.now() * 0.0017 + state.rally) * 0.13;
    targetX += error;
    targetY += error * 0.45;
  }
  state.botPaddleTarget.set(
    THREE.MathUtils.clamp(targetX, -1.72, 1.72),
    THREE.MathUtils.clamp(targetY - 0.34, 0.55, 2.25),
    0.36,
  );
}

function updateBot(delta) {
  predictBotTarget();
  const response = state.ballActive && ballVelocity.z < 0 ? 4.8 : 2.1;
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
  ballVelocity.copy(relativeVelocity).addScaledVector(paddleVelocity, side === 'player' ? 0.52 : 0.2);

  ballVelocity.x += localBall.x * 3.1;
  ballVelocity.y += localBall.y * 2.25;
  const minimumForwardSpeed = Math.min(8.8, 5.2 + state.rally * 0.12);
  if (side === 'player') ballVelocity.z = -Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed);
  else ballVelocity.z = Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed * 0.96);

  const speed = THREE.MathUtils.clamp(ballVelocity.length(), 5.2, 10.8);
  ballVelocity.setLength(speed);
  ball.position.addScaledVector(normal, BALL_RADIUS + 0.035);
  state[cooldownKey] = 0.14;
  state.rally += 1;
  state.status = side === 'player' ? 'Starker Return' : 'Bot-Return';
  ballMaterial.emissive.setHex(side === 'player' ? 0x22cfff : 0xff2a95);
  ballGlow.color.setHex(side === 'player' ? 0x42d7ff : 0xff4fa7);
  sound(side === 'player' ? 660 : 440, 0.055, 0.055);
  if (side === 'player') pulseController(rightControllerRecord);
  updateScoreboard();
  return true;
}

function updateTrail() {
  for (let index = trailPoints.length - 1; index > 0; index -= 1) {
    trailPoints[index].lerp(trailPoints[index - 1], 0.68);
  }
  trailPoints[0].copy(ball.position);
  trailGeometry.setFromPoints(trailPoints);
}

function wallBounce(axis, boundary, direction) {
  ball.position[axis] = boundary;
  ballVelocity[axis] = Math.abs(ballVelocity[axis]) * direction * 0.96;
  const now = performance.now();
  if (now - lastWallSound > 70) {
    sound(290, 0.035, 0.025);
    lastWallSound = now;
  }
}

function simulateBall(delta) {
  if (!state.ballActive) {
    if (!state.matchOver) {
      state.serveTimer -= delta;
      state.status = state.serveTimer > 0.75 ? 'Bereit' : 'Serve';
      if (state.serveTimer <= 0) launchServe();
    }
    return;
  }

  const maxTravel = Math.max(BALL_RADIUS * 0.7, 0.05);
  const steps = THREE.MathUtils.clamp(Math.ceil(ballVelocity.length() * delta / maxTravel), 1, 8);
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

  ballMaterial.emissive.lerp(new THREE.Color(0x75dfff), 0.035);
  ballGlow.color.lerp(new THREE.Color(0x52d9ff), 0.035);
}

const desktopPointer = { x: 0.52, y: 1.35 };
window.addEventListener('pointermove', (event) => {
  const normalizedX = event.clientX / innerWidth;
  const normalizedY = event.clientY / innerHeight;
  desktopPointer.x = THREE.MathUtils.lerp(-1.55, 1.55, normalizedX);
  desktopPointer.y = THREE.MathUtils.lerp(2.35, 0.65, normalizedY);
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
    player.position.x = Math.max(-PLAYER_LIMIT_X, player.position.x - 0.18);
  }
  if (event.code === 'KeyD' || event.code === 'ArrowRight') {
    player.position.x = Math.min(PLAYER_LIMIT_X, player.position.x + 0.18);
  }
  if (event.code === 'KeyR' || event.code === 'Space') restartMatch();
});

document.querySelector('#restart-button').addEventListener('click', restartMatch);

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('xr-active');
  audioContext?.resume?.();
  restartMatch();
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

resetBall(1.3);
updateScoreboard();
playerPaddle.hitSurface.getWorldPosition(previousPlayerPaddlePosition);
botPaddle.hitSurface.getWorldPosition(previousBotPaddlePosition);

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.035);
  updateControllerInput(delta);

  if (!renderer.xr.isPresenting) {
    desktopPaddleAnchor.position.x = THREE.MathUtils.damp(desktopPaddleAnchor.position.x, desktopPointer.x - player.position.x, 11, delta);
    desktopPaddleAnchor.position.y = THREE.MathUtils.damp(desktopPaddleAnchor.position.y, desktopPointer.y, 11, delta);
  }

  updateBot(delta);
  scene.updateMatrixWorld(true);
  updatePaddleVelocities(delta);
  state.hitCooldown = Math.max(0, state.hitCooldown - delta);
  state.botHitCooldown = Math.max(0, state.botHitCooldown - delta);
  simulateBall(delta);
  updateTrail();
  renderer.render(scene, camera);
});
