import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import './style.css';

const settings = {
  lengthIndex: 1,
  widthIndex: 1,
  heightIndex: 1,
  difficultyIndex: 1,
  fixMode: false,
  lengths: [10.8, 12.8, 15.2],
  widths: [4.2, 5.0, 5.8],
  heights: [2.9, 3.45, 4.0],
  difficulties: [
    { label: 'Entspannt', reaction: 2.7, idle: 1.6, error: 0.30, speed: 0.92 },
    { label: 'Normal', reaction: 4.7, idle: 2.2, error: 0.15, speed: 1.0 },
    { label: 'Experte', reaction: 7.2, idle: 3.0, error: 0.055, speed: 1.09 },
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
const NOMINAL_EYE_HEIGHT = 1.47;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01030a);
scene.fog = new THREE.FogExp2(0x040916, 0.021);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 140);
camera.position.set(0, NOMINAL_EYE_HEIGHT, 0);

const player = new THREE.Group();
player.name = 'PlayerRig';
player.position.set(0, -0.18, COURT.playerZ);
player.add(camera);
scene.add(player);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor'],
}));

scene.add(new THREE.HemisphereLight(0x8fc6ff, 0x050710, 1.15));
const keyLight = new THREE.DirectionalLight(0xe8f6ff, 2.4);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 9;
keyLight.shadow.camera.bottom = -3;
scene.add(keyLight);

const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();
const inverseMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
let audioContext = null;
let lastWallSound = 0;
let playerLimitX = 1.8;
let playerMinY = -0.85;
let playerMaxY = 0.8;

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
    // Audio remains optional until the browser allows it.
  }
}

function pulseController(record, strength = 0.5, duration = 45) {
  const gamepad = record?.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] ?? gamepad?.vibrationActuator;
  actuator?.pulse?.(strength, duration).catch?.(() => {});
}

function disposeGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
  group.clear();
}

/* -------------------------------------------------------------------------- */
/* Background                                                                  */
/* -------------------------------------------------------------------------- */

function createNebulaSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vPosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 n = normalize(vPosition);
        float t = time * 0.015;
        float cloud = noise(n * 3.2 + vec3(t, -t * 0.6, t * 0.35));
        cloud += 0.5 * noise(n * 7.5 - vec3(t * 0.5, 0.0, t));
        cloud = smoothstep(0.62, 1.18, cloud);

        float band = pow(max(0.0, 1.0 - abs(n.y + 0.12)), 4.0);
        vec3 deep = vec3(0.002, 0.006, 0.025);
        vec3 cyan = vec3(0.02, 0.25, 0.42);
        vec3 magenta = vec3(0.34, 0.015, 0.24);
        float blend = 0.5 + 0.5 * sin(n.x * 4.0 + n.z * 3.0 + t);
        vec3 nebula = mix(cyan, magenta, blend) * cloud * band * 0.72;
        gl_FragColor = vec4(deep + nebula, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(58, 40, 28), material);
  sky.name = 'NebulaSky';
  scene.add(sky);
  return sky;
}

function createStarLayer(count, radiusMin, radiusMax, size, opacity, color) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = THREE.MathUtils.randFloat(radiusMin, radiusMax);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const layer = new THREE.Points(geometry, material);
  scene.add(layer);
  return layer;
}

function createPlanet() {
  const planet = new THREE.Group();
  planet.position.set(15, 8, -34);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 48, 28),
    new THREE.MeshStandardMaterial({
      color: 0x142044,
      emissive: 0x090a2b,
      emissiveIntensity: 1.3,
      roughness: 0.72,
      metalness: 0.12,
    }),
  );
  planet.add(body);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(4.7, 6.4, 72),
    new THREE.MeshBasicMaterial({
      color: 0x3d9dff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  halo.rotation.x = Math.PI * 0.5;
  halo.rotation.z = -0.35;
  planet.add(halo);
  scene.add(planet);
  return planet;
}

const nebulaSky = createNebulaSky();
const starLayers = [
  createStarLayer(700, 18, 34, 0.045, 0.30, 0xb9dcff),
  createStarLayer(420, 24, 46, 0.075, 0.20, 0xffb4df),
  createStarLayer(220, 30, 52, 0.11, 0.12, 0x86efff),
];
const distantPlanet = createPlanet();

/* -------------------------------------------------------------------------- */
/* Arena                                                                       */
/* -------------------------------------------------------------------------- */

const arenaGroup = new THREE.Group();
arenaGroup.name = 'ConnectedNeonArena';
scene.add(arenaGroup);

function createArena() {
  disposeGroup(arenaGroup);
  const width = COURT.halfWidth * 2;
  const height = COURT.ceiling;
  const length = COURT.nearEnd - COURT.farEnd;

  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050914,
    roughness: 0.34,
    metalness: 0.72,
    clearcoat: 0.7,
    clearcoatRoughness: 0.24,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0x040714,
    emissive: 0x020616,
    emissiveIntensity: 0.65,
    roughness: 0.48,
    metalness: 0.62,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0d294c,
    transparent: true,
    opacity: 0.10,
    roughness: 0.08,
    metalness: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, length), floorMaterial);
  floor.position.y = -0.055;
  floor.receiveShadow = true;
  arenaGroup.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.075, length), ceilingMaterial);
  ceiling.position.y = height + 0.0375;
  arenaGroup.add(ceiling);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), glassMaterial.clone());
  leftWall.position.set(-COURT.halfWidth, height * 0.5, 0);
  leftWall.rotation.y = Math.PI * 0.5;
  arenaGroup.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.material = glassMaterial.clone();
  rightWall.position.x = COURT.halfWidth;
  rightWall.rotation.y = -Math.PI * 0.5;
  arenaGroup.add(rightWall);

  const endGeometry = new THREE.PlaneGeometry(width, height);
  const farWall = new THREE.Mesh(endGeometry, glassMaterial.clone());
  farWall.position.set(0, height * 0.5, COURT.farEnd);
  arenaGroup.add(farWall);

  const nearWall = new THREE.Mesh(endGeometry.clone(), glassMaterial.clone());
  nearWall.position.set(0, height * 0.5, COURT.nearEnd);
  nearWall.rotation.y = Math.PI;
  arenaGroup.add(nearWall);

  const boxGeometry = new THREE.BoxGeometry(width, height, length);
  const edges = new THREE.EdgesGeometry(boxGeometry, 1);
  boxGeometry.dispose();

  const coreMaterial = new THREE.LineBasicMaterial({
    color: 0x33d9ff,
    transparent: true,
    opacity: 0.88,
    depthTest: true,
  });
  const glowMaterial = new THREE.LineBasicMaterial({
    color: 0xff43ac,
    transparent: true,
    opacity: 0.22,
    depthTest: true,
  });

  const core = new THREE.LineSegments(edges, coreMaterial);
  core.position.y = height * 0.5;
  arenaGroup.add(core);

  const glow = new THREE.LineSegments(edges.clone(), glowMaterial);
  glow.position.y = height * 0.5;
  glow.scale.set(1.006, 1.006, 1.006);
  arenaGroup.add(glow);

  const innerEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width - 0.16, height - 0.16, length - 0.16), 1);
  const innerMaterial = new THREE.LineBasicMaterial({
    color: 0x8cefff,
    transparent: true,
    opacity: 0.20,
  });
  const inner = new THREE.LineSegments(innerEdges, innerMaterial);
  inner.position.y = height * 0.5;
  arenaGroup.add(inner);

  const farPortal = new THREE.Group();
  farPortal.position.set(0, height * 0.5, COURT.farEnd - 0.06);
  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(width * 0.13 + index * 0.31, width * 0.43), 0.018, 8, 96),
      new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0x40dbff : 0xff4fa7,
        transparent: true,
        opacity: 0.15 - index * 0.02,
        depthWrite: false,
      }),
    );
    farPortal.add(ring);
  }
  arenaGroup.add(farPortal);

  arenaGroup.userData.coreMaterial = coreMaterial;
  arenaGroup.userData.glowMaterial = glowMaterial;
  arenaGroup.userData.innerMaterial = innerMaterial;
  arenaGroup.userData.portal = farPortal;
}

/* -------------------------------------------------------------------------- */
/* Paddles, bot and ball                                                       */
/* -------------------------------------------------------------------------- */

function createPaddle(color, emissive) {
  const root = new THREE.Group();
  root.name = 'Paddle';

  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x111725,
    roughness: 0.42,
    metalness: 0.72,
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.34, 18), gripMaterial);
  handle.castShadow = true;
  root.add(handle);

  const hitSurface = new THREE.Group();
  hitSurface.name = 'HitSurface';
  hitSurface.position.set(0, 0.33, 0);
  root.add(hitSurface);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 2.2,
    roughness: 0.22,
    metalness: 0.54,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.029, 14, 64), rimMaterial);
  rim.scale.y = 1.25;
  rim.castShadow = true;
  hitSurface.add(rim);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 56),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.42,
      roughness: 0.16,
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
  new THREE.MeshStandardMaterial({
    color: 0x401130,
    emissive: 0x620d42,
    emissiveIntensity: 0.9,
    roughness: 0.28,
    metalness: 0.68,
  }),
);
botBody.position.y = 0.95;
botBody.castShadow = true;
bot.add(botBody);

const botHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 28, 18),
  new THREE.MeshStandardMaterial({
    color: 0x131725,
    roughness: 0.18,
    metalness: 0.78,
  }),
);
botHead.position.y = 1.52;
botHead.castShadow = true;
bot.add(botHead);

const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.09, 0.08),
  new THREE.MeshStandardMaterial({
    color: 0xff4fa7,
    emissive: 0xb30d5f,
    emissiveIntensity: 2.5,
    roughness: 0.22,
    metalness: 0.4,
  }),
);
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
  roughness: 0.14,
  metalness: 0.08,
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 20), ballMaterial);
ball.castShadow = true;
scene.add(ball);

const ballGlow = new THREE.PointLight(0x52d9ff, 2.5, 2.8, 2);
ball.add(ballGlow);

const trailPoints = Array.from({ length: 32 }, () => new THREE.Vector3());
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trailMaterial = new THREE.LineBasicMaterial({
  color: 0x6fe6ff,
  transparent: true,
  opacity: 0.45,
});
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

const burstEffects = [];
function spawnBurst(position, color) {
  const count = 20;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2.5),
      THREE.MathUtils.randFloatSpread(2.1),
      THREE.MathUtils.randFloatSpread(2.5),
    ));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.05,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  burstEffects.push({ points, velocities, life: 0.3, maxLife: 0.3 });
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

/* -------------------------------------------------------------------------- */
/* State and scoreboard                                                        */
/* -------------------------------------------------------------------------- */

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

const scorePlayerEl = document.querySelector('#score-player');
const scoreBotEl = document.querySelector('#score-bot');
const statusEl = document.querySelector('#game-status');
const pauseButton = document.querySelector('#pause-button');

function createScoreboard() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), material);
  scene.add(mesh);
  return { canvas, texture, mesh };
}

const scoreboard = createScoreboard();

function updateScoreboard() {
  const ctx = scoreboard.canvas.getContext('2d');
  const { width, height } = scoreboard.canvas;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, 'rgba(3, 24, 48, 0.94)');
  gradient.addColorStop(0.5, 'rgba(7, 10, 28, 0.96)');
  gradient.addColorStop(1, 'rgba(48, 4, 35, 0.94)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(110, 231, 255, 0.82)';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#91ecff';
  ctx.font = '800 68px system-ui, sans-serif';
  ctx.fillText('DU', 550, 108);
  ctx.fillStyle = '#ff88c2';
  ctx.fillText('BOT', 1498, 108);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 224px system-ui, sans-serif';
  ctx.fillText(String(state.playerScore), 550, 278);
  ctx.fillText(String(state.botScore), 1498, 278);

  ctx.fillStyle = '#d6e7f5';
  ctx.font = '700 58px system-ui, sans-serif';
  const mode = settings.fixMode ? 'FIX' : 'FREI';
  ctx.fillText(`${state.status} · Rally ${state.rally} · ${mode}`, 1024, 445);

  scoreboard.texture.needsUpdate = true;
  scorePlayerEl.textContent = state.playerScore;
  scoreBotEl.textContent = state.botScore;
  statusEl.textContent = `${state.status} · Rally ${state.rally}`;
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

/* -------------------------------------------------------------------------- */
/* High-resolution VR menu                                                     */
/* -------------------------------------------------------------------------- */

const MAX_ANISOTROPY = renderer.capabilities.getMaxAnisotropy();

function createTextTexture(text, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 2048;
  canvas.height = options.height ?? 512;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = MAX_ANISOTROPY;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  const record = { canvas, context, texture };
  drawTextTexture(record, text, options);
  return record;
}

function drawTextTexture(record, text, options = {}) {
  const { canvas, context, texture } = record;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (options.background) {
    context.fillStyle = options.background;
    const radius = options.radius ?? 48;
    const x = 8;
    const y = 8;
    const width = canvas.width - 16;
    const height = canvas.height - 16;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  }

  if (options.border) {
    context.strokeStyle = options.border;
    context.lineWidth = options.borderWidth ?? 10;
    context.beginPath();
    context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, options.radius ?? 48);
    context.stroke();
  }

  context.fillStyle = options.color ?? '#ffffff';
  context.font = options.font ?? '800 132px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = options.shadow ?? 'rgba(40, 220, 255, 0.36)';
  context.shadowBlur = options.shadowBlur ?? 18;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + (options.offsetY ?? 0));
  texture.needsUpdate = true;
}

function createLabel(text, width, height, options = {}) {
  const textTexture = createTextTexture(text, options);
  const material = new THREE.MeshBasicMaterial({
    map: textTexture.texture,
    transparent: true,
    toneMapped: false,
    depthTest: false,
    alphaTest: 0.015,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 82;
  mesh.userData.textTexture = textTexture;
  return mesh;
}

function setLabelText(mesh, text, options = {}) {
  drawTextTexture(mesh.userData.textTexture, text, options);
}

const menuRoot = new THREE.Group();
menuRoot.name = 'PauseMenu';
scene.add(menuRoot);

const menuButtons = [];
const menuBackdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(3.55, 3.24),
  new THREE.MeshBasicMaterial({
    color: 0x020717,
    transparent: true,
    opacity: 0.975,
    depthTest: false,
  }),
);
menuBackdrop.position.z = -0.05;
menuBackdrop.renderOrder = 70;
menuRoot.add(menuBackdrop);

const menuGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(3.68, 3.37),
  new THREE.MeshBasicMaterial({
    color: 0x20d9ff,
    transparent: true,
    opacity: 0.15,
    depthTest: false,
  }),
);
menuGlow.position.z = -0.075;
menuGlow.renderOrder = 69;
menuRoot.add(menuGlow);

const menuTitle = createLabel('NEON CHANNEL', 3.05, 0.42, {
  font: '900 170px system-ui, sans-serif',
  color: '#e7fbff',
  shadowBlur: 26,
});
menuTitle.position.set(0, 1.28, 0);
menuRoot.add(menuTitle);

const menuSubtitle = createLabel('Mit dem Zielpunkt auswählen · R2 klicken · A öffnet das Menü', 3.05, 0.22, {
  font: '750 72px system-ui, sans-serif',
  color: '#7fe8ff',
  shadowBlur: 10,
});
menuSubtitle.position.set(0, 0.98, 0);
menuRoot.add(menuSubtitle);

function createMenuButton(label, x, y, width, action, accent = 0x123756) {
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.32), panelMaterial);
  panel.position.set(x, y, 0);
  panel.renderOrder = 78;
  panel.userData.menuAction = action;
  panel.userData.baseColor = accent;
  panel.userData.hoverColor = 0x24a7ce;

  const labelMesh = createLabel(label, width * 0.94, 0.22, {
    font: '850 112px system-ui, sans-serif',
    color: '#ffffff',
    shadowBlur: 12,
  });
  labelMesh.position.z = 0.008;
  panel.add(labelMesh);
  panel.userData.labelMesh = labelMesh;

  menuRoot.add(panel);
  menuButtons.push(panel);
  return panel;
}

const rowLabels = {};
function createSettingRow(key, y) {
  createMenuButton('−', -1.33, y, 0.42, `${key}:down`, 0x103a5e);
  rowLabels[key] = createLabel('', 2.0, 0.25, {
    font: '800 106px system-ui, sans-serif',
    color: '#effcff',
    shadowBlur: 12,
  });
  rowLabels[key].position.set(0, y, 0.006);
  menuRoot.add(rowLabels[key]);
  createMenuButton('+', 1.33, y, 0.42, `${key}:up`, 0x57183f);
}

createSettingRow('length', 0.59);
createSettingRow('width', 0.22);
createSettingRow('height', -0.15);
createSettingRow('difficulty', -0.52);
const fixButton = createMenuButton('FIX-MODUS: AUS', 0, -0.90, 2.72, 'fix', 0x27305c);
const startButton = createMenuButton('SPIEL STARTEN', 0, -1.30, 2.72, 'start', 0x0a7697);
const restartButton3D = createMenuButton('NEUES MATCH', 0, -1.67, 2.1, 'restart', 0x57183f);
restartButton3D.visible = false;

function updateMenuLabels() {
  setLabelText(rowLabels.length, `RAUMTIEFE  ${settings.lengths[settings.lengthIndex].toFixed(1)} m`, {
    font: '800 106px system-ui, sans-serif',
    color: '#effcff',
  });
  setLabelText(rowLabels.width, `RAUMBREITE  ${settings.widths[settings.widthIndex].toFixed(1)} m`, {
    font: '800 106px system-ui, sans-serif',
    color: '#effcff',
  });
  setLabelText(rowLabels.height, `RAUMHÖHE  ${settings.heights[settings.heightIndex].toFixed(2)} m`, {
    font: '800 106px system-ui, sans-serif',
    color: '#effcff',
  });
  setLabelText(rowLabels.difficulty, `KI  ${settings.difficulties[settings.difficultyIndex].label.toUpperCase()}`, {
    font: '800 106px system-ui, sans-serif',
    color: '#ffd9ed',
  });
  setLabelText(fixButton.userData.labelMesh, `FIX-MODUS: ${settings.fixMode ? 'AN' : 'AUS'}`, {
    font: '850 112px system-ui, sans-serif',
    color: settings.fixMode ? '#96f8ff' : '#ffffff',
  });
  setLabelText(startButton.userData.labelMesh, state.gameStarted ? 'WEITERSPIELEN' : 'SPIEL STARTEN', {
    font: '850 112px system-ui, sans-serif',
    color: '#ffffff',
  });
  restartButton3D.visible = state.gameStarted;
}

function positionMenuInFront() {
  camera.getWorldPosition(tempVector);
  camera.getWorldQuaternion(tempQuaternion);
  const forward = tempVector2.set(0, 0, -1).applyQuaternion(tempQuaternion).normalize();
  const targetPosition = tempVector3.copy(tempVector).addScaledVector(forward, 2.65);
  targetPosition.y = THREE.MathUtils.clamp(tempVector.y, 1.15, Math.max(1.15, COURT.ceiling - 0.75));
  menuRoot.position.copy(targetPosition);
  menuRoot.lookAt(tempVector.x, targetPosition.y, tempVector.z);
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
  setMenuHover(null);
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
  if (action === 'fix') {
    settings.fixMode = !settings.fixMode;
    updateMenuLabels();
    updateScoreboard();
    sound(settings.fixMode ? 620 : 360, 0.08, 0.04);
    return;
  }
  const [key, change] = action.split(':');
  cycleSetting(key, change === 'up' ? 1 : -1);
}

function setMenuHover(button) {
  if (state.hoveredButton === button) return;
  if (state.hoveredButton) {
    state.hoveredButton.material.color.setHex(state.hoveredButton.userData.baseColor);
    state.hoveredButton.scale.setScalar(1);
  }
  state.hoveredButton = button;
  if (button) {
    button.material.color.setHex(button.userData.hoverColor);
    button.scale.setScalar(1.045);
    pulseController(rightControllerRecord, 0.18, 22);
  }
}

/* -------------------------------------------------------------------------- */
/* Controller input, exact pointer and calibration                             */
/* -------------------------------------------------------------------------- */

const controllerModelFactory = new XRControllerModelFactory();
const controllers = [];
let rightControllerRecord = null;
let playerPaddleAnchor = null;

function createPointerVisual(target) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -0.025),
    new THREE.Vector3(0, 0, -1),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0x8ceeff,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 95;
  line.visible = false;
  target.add(line);

  const reticle = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.025, 0.041, 40),
    new THREE.MeshBasicMaterial({
      color: 0x9af5ff,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  ring.renderOrder = 98;
  reticle.add(ring);

  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.011, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  dot.position.z = 0.001;
  dot.renderOrder = 99;
  reticle.add(dot);
  reticle.visible = false;
  target.add(reticle);

  return { line, reticle, ring, dot };
}

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
  playerPaddle.root.position.set(0, -0.05, -0.07);
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
  controller.updateWorldMatrix(true, false);
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  raycaster.far = 6;
}

function updateMenuPointer(record) {
  if (record !== rightControllerRecord) return;
  const { line, reticle, ring, dot } = record.pointer;
  line.visible = state.menuOpen;
  if (!state.menuOpen) {
    reticle.visible = false;
    setMenuHover(null);
    return;
  }

  rayFromController(record.target);
  const activeButtons = menuButtons.filter((button) => button.visible);
  const hit = raycaster.intersectObjects(activeButtons, false)[0];
  const distance = hit?.distance ?? 3.6;

  line.scale.z = distance;
  reticle.position.set(0, 0, -distance + 0.006);
  reticle.visible = Boolean(hit);
  ring.material.color.setHex(hit ? 0x67f4ff : 0xffffff);
  dot.material.color.setHex(hit ? 0xffffff : 0x67f4ff);
  line.material.color.setHex(hit ? 0x67f4ff : 0x5b8ca5);
  line.material.opacity = hit ? 1 : 0.62;
  setMenuHover(hit?.object ?? null);
}

function clickMenuFromController(record) {
  if (record !== rightControllerRecord || !state.menuOpen) return;
  updateMenuPointer(record);
  if (state.hoveredButton) {
    pulseController(record, 0.42, 40);
    activateMenuAction(state.hoveredButton.userData.menuAction);
  }
}

function addController(index) {
  const target = renderer.xr.getController(index);
  const grip = renderer.xr.getControllerGrip(index);
  const pointer = createPointerVisual(target);
  grip.add(controllerModelFactory.createControllerModel(grip));
  player.add(target, grip);

  const record = {
    target,
    grip,
    pointer,
    inputSource: null,
    handedness: 'none',
    previousButtons: [],
  };
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
    record.pointer.line.visible = false;
    record.pointer.reticle.visible = false;
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

function getStickAxes(gamepad) {
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  if (gamepad.axes.length >= 4) return { x: gamepad.axes[2] ?? 0, y: gamepad.axes[3] ?? 0 };
  return { x: gamepad.axes[0] ?? 0, y: gamepad.axes[1] ?? 0 };
}

function centeredPlayerY() {
  return COURT.ceiling * 0.5 - NOMINAL_EYE_HEIGHT;
}

function updatePlayerMovement(delta, stick = { x: 0, y: 0 }) {
  if (settings.fixMode) {
    player.position.x = THREE.MathUtils.damp(player.position.x, 0, 6.5, delta);
    player.position.y = THREE.MathUtils.damp(player.position.y, centeredPlayerY(), 6.5, delta);
    return;
  }

  const xInput = Math.abs(stick.x) > 0.12 ? stick.x : 0;
  const yInput = Math.abs(stick.y) > 0.12 ? -stick.y : 0;
  player.position.x = THREE.MathUtils.clamp(
    player.position.x + xInput * 2.35 * delta,
    -playerLimitX,
    playerLimitX,
  );
  player.position.y = THREE.MathUtils.clamp(
    player.position.y + yInput * 1.8 * delta,
    playerMinY,
    playerMaxY,
  );
}

function updateControllerInput(delta) {
  let leftStick = { x: 0, y: 0 };

  controllers.forEach((record) => {
    const gamepad = record.inputSource?.gamepad;
    if (!gamepad) return;

    const buttons = gamepad.buttons;
    const wasPressed = (index) => Boolean(record.previousButtons[index]);
    const isPressed = (index) => Boolean(buttons[index]?.pressed);

    if (record.handedness === 'left' && !state.menuOpen) {
      leftStick = getStickAxes(gamepad);
    }

    if (record.handedness === 'right' && isPressed(4) && !wasPressed(4)) {
      if (state.menuOpen) closeMenu();
      else openMenu();
    }

    record.previousButtons = buttons.map((button) => button.pressed);
    updateMenuPointer(record);
  });

  if (!state.menuOpen) updatePlayerMovement(delta, leftStick);
  else if (settings.fixMode) updatePlayerMovement(delta);
}

/* -------------------------------------------------------------------------- */
/* Arena sizing and game simulation                                            */
/* -------------------------------------------------------------------------- */

function updateCourtFromSettings() {
  const length = settings.lengths[settings.lengthIndex];
  COURT.halfWidth = settings.widths[settings.widthIndex] / 2;
  COURT.ceiling = settings.heights[settings.heightIndex];
  COURT.nearEnd = length / 2;
  COURT.farEnd = -length / 2;
  COURT.playerZ = COURT.nearEnd - 2.05;
  COURT.botZ = COURT.farEnd + 2.05;

  playerLimitX = Math.max(1.0, COURT.halfWidth - 0.68);
  playerMinY = 0.48 - NOMINAL_EYE_HEIGHT;
  playerMaxY = COURT.ceiling - 0.52 - NOMINAL_EYE_HEIGHT;

  player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimitX, playerLimitX);
  player.position.y = THREE.MathUtils.clamp(player.position.y, playerMinY, playerMaxY);
  if (settings.fixMode) {
    player.position.x = 0;
    player.position.y = centeredPlayerY();
  }

  player.position.z = COURT.playerZ;
  bot.position.z = COURT.botZ;
  scoreboard.mesh.position.set(0, Math.min(COURT.ceiling - 0.42, 2.72), -0.2);
  createArena();
  resetBall(1.2);
}

function updatePaddleVelocities(delta) {
  playerPaddle.hitSurface.getWorldPosition(currentPlayerPaddlePosition);
  botPaddle.hitSurface.getWorldPosition(currentBotPaddlePosition);
  if (delta > 0.0001) {
    state.playerPaddleWorldVelocity
      .subVectors(currentPlayerPaddlePosition, previousPlayerPaddlePosition)
      .divideScalar(delta);
    state.botPaddleWorldVelocity
      .subVectors(currentBotPaddlePosition, previousBotPaddlePosition)
      .divideScalar(delta);
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
  if (state.menuOpen) return;
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

  const relativeVelocity = tempVector3.copy(ballVelocity).sub(paddleVelocity);
  const approach = relativeVelocity.dot(normal);
  if (approach < 0) relativeVelocity.addScaledVector(normal, -2 * approach);
  ballVelocity.copy(relativeVelocity).addScaledVector(paddleVelocity, side === 'player' ? 0.54 : 0.2);
  ballVelocity.x += localBall.x * 3.1;
  ballVelocity.y += localBall.y * 2.25;

  const difficulty = settings.difficulties[settings.difficultyIndex];
  const minimumForwardSpeed = Math.min(9.5, (5.05 + state.rally * 0.13) * (side === 'bot' ? difficulty.speed : 1));
  if (side === 'player') ballVelocity.z = -Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed);
  else ballVelocity.z = Math.max(Math.abs(ballVelocity.z), minimumForwardSpeed * 0.96);

  const speed = THREE.MathUtils.clamp(ballVelocity.length(), 5.1, 14.2);
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
    trailPoints[index].lerp(trailPoints[index - 1], 0.61);
  }
  trailPoints[0].copy(ball.position);
  trailGeometry.setFromPoints(trailPoints);
}

function updateBallVisuals(delta) {
  const speed = ballVelocity.length();
  const normalized = THREE.MathUtils.clamp((speed - 4.8) / 9.2, 0, 1);
  const hue = THREE.MathUtils.lerp(0.54, 0.04, normalized);
  ballMaterial.color.setHSL(hue, 0.96, 0.68);
  ballMaterial.emissive.setHSL(hue, 1, 0.46);
  ballMaterial.emissiveIntensity = 2.3 + normalized * 3.8;
  ballGlow.color.setHSL(hue, 1, 0.58);
  ballGlow.intensity = 2.3 + normalized * 5.1;
  ballGlow.distance = 2.6 + normalized * 2.8;
  trailMaterial.color.setHSL(hue, 1, 0.62);
  trailMaterial.opacity = 0.30 + normalized * 0.66;
  trail.scale.setScalar(1 + normalized * 0.07);
  ball.scale.setScalar(1 + Math.sin(performance.now() * 0.013) * normalized * 0.065);

  if (state.ballActive && !state.menuOpen) {
    state.rallyTime += delta;
    const acceleration = 0.018 + state.rally * 0.0018;
    const maxSpeed = 10.5 + settings.difficultyIndex * 1.2 + Math.min(2.4, state.rallyTime * 0.032);
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

/* -------------------------------------------------------------------------- */
/* Desktop fallback                                                            */
/* -------------------------------------------------------------------------- */

const desktopPointer = { x: 0.52, y: 1.3 };
window.addEventListener('pointermove', (event) => {
  const normalizedX = event.clientX / innerWidth;
  const normalizedY = event.clientY / innerHeight;
  desktopPointer.x = THREE.MathUtils.lerp(-1.55, 1.55, normalizedX);
  desktopPointer.y = THREE.MathUtils.lerp(2.15, 0.55, normalizedY);
});

window.addEventListener('keydown', (event) => {
  if (!state.menuOpen && !settings.fixMode) {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') player.position.x = Math.max(-playerLimitX, player.position.x - 0.18);
    if (event.code === 'KeyD' || event.code === 'ArrowRight') player.position.x = Math.min(playerLimitX, player.position.x + 0.18);
    if (event.code === 'KeyW' || event.code === 'ArrowUp') player.position.y = Math.min(playerMaxY, player.position.y + 0.14);
    if (event.code === 'KeyS' || event.code === 'ArrowDown') player.position.y = Math.max(playerMinY, player.position.y - 0.14);
  }
  if (event.code === 'Escape' || event.code === 'KeyM') {
    if (state.menuOpen) closeMenu();
    else openMenu();
  }
  if (event.code === 'Space' && state.menuOpen) closeMenu();
  if (event.code === 'KeyR') restartMatch();
  if (event.code === 'KeyF') {
    settings.fixMode = !settings.fixMode;
    updateMenuLabels();
    updateScoreboard();
  }
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

/* -------------------------------------------------------------------------- */
/* Animation                                                                   */
/* -------------------------------------------------------------------------- */

function animateArena(time, delta) {
  const hue = (0.54 + time * 0.000025) % 1;
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.00115);
  arenaGroup.userData.coreMaterial?.color.setHSL(hue, 0.96, 0.62);
  if (arenaGroup.userData.coreMaterial) arenaGroup.userData.coreMaterial.opacity = 0.62 + pulse * 0.34;
  arenaGroup.userData.glowMaterial?.color.setHSL((hue + 0.28) % 1, 0.94, 0.59);
  if (arenaGroup.userData.glowMaterial) arenaGroup.userData.glowMaterial.opacity = 0.12 + pulse * 0.22;
  arenaGroup.userData.innerMaterial?.color.setHSL((hue + 0.12) % 1, 0.88, 0.72);
  if (arenaGroup.userData.innerMaterial) arenaGroup.userData.innerMaterial.opacity = 0.10 + (1 - pulse) * 0.20;

  const portal = arenaGroup.userData.portal;
  if (portal) {
    portal.rotation.z += delta * 0.06;
    portal.children.forEach((ring, index) => {
      ring.rotation.z += delta * (index % 2 === 0 ? 0.16 : -0.13);
      ring.material.opacity = 0.07 + Math.sin(time * 0.0012 + index) * 0.025 + (0.10 - index * 0.014);
    });
  }
}

updateCourtFromSettings();
updateScoreboard();
updateMenuLabels();
menuRoot.visible = true;
positionMenuInFront();
playerPaddle.hitSurface.getWorldPosition(previousPlayerPaddlePosition);
botPaddle.hitSurface.getWorldPosition(previousBotPaddlePosition);

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.035);
  const time = performance.now();

  updateControllerInput(delta);

  if (!renderer.xr.isPresenting) {
    desktopPaddleAnchor.position.x = THREE.MathUtils.damp(desktopPaddleAnchor.position.x, desktopPointer.x - player.position.x, 11, delta);
    desktopPaddleAnchor.position.y = THREE.MathUtils.damp(desktopPaddleAnchor.position.y, desktopPointer.y - player.position.y, 11, delta);
    if (state.menuOpen) positionMenuInFront();
    if (settings.fixMode) updatePlayerMovement(delta);
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
  animateArena(time, delta);

  nebulaSky.material.uniforms.time.value = time * 0.001;
  starLayers[0].rotation.y += delta * 0.0025;
  starLayers[1].rotation.y -= delta * 0.0017;
  starLayers[2].rotation.x += delta * 0.0008;
  distantPlanet.rotation.y += delta * 0.008;

  renderer.render(scene, camera);
});
