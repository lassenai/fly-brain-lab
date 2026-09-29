// 초파리 뇌 걷기 — 3D 초파리(Fruitfly 3D Mesh) 시뮬레이터 + 실시간 발화 뇌. 뇌: MaleCNS 2026.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createBrainView} from './brain-view.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const state = { x: 0, y: 0, yaw: Math.PI / 2, v: 0, w: 0, legPhase: [0, 0], collected: 0, banana: { x: 0.5, y: 0.9 }, respawnAt: 0, pulse: 0 };
const lab = { antenna: 'normal', range: 1.25, light: 0.45 };
let activity = null, ready = false, cut = false, lastT = performance.now(), brainView = null, autoRotate = true;

// ---- Three.js 3D 무대 구축 (메탈골드 테마) ----
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a150d');
scene.fog = new THREE.Fog('#1a150d', 8, 25);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(0, 1.8, 2.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 0.8;
controls.maxDistance = 8.0;

// 조명 (따뜻한 골드 앰비언트)
scene.add(new THREE.HemisphereLight(0xfff8e7, 0x3d301c, 1.8));
const sun = new THREE.DirectionalLight(0xffecc4, 2.2);
sun.position.set(-3, 6, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// 바닥 & 그리드 (메탈골드 바닥 테마)
const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0x2b2214, roughness: 0.7, metalness: 0.25 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(24, 48, 0xd4af37, 0x4a3b22);
grid.position.y = 0.002;
scene.add(grid);

// ---- 3D fruitfly 메쉬 모델 (flybody/fruitfly.xml 파츠 구조 분석 기반 구축) ----
function createFruitFly3DMesh() {
  const flyGroup = new THREE.Group();
  
  // flybody 생체 파츠 메인 재질 (Thorax, Head, Abdomen, Wings, Legs)
  const matThorax = new THREE.MeshStandardMaterial({ color: 0x3a4356, roughness: 0.5, metalness: 0.3 });
  const matHead = new THREE.MeshStandardMaterial({ color: 0x2b3342, roughness: 0.4 });
  const matRedEye = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, emissive: 0xb45309, emissiveIntensity: 0.35 });
  const matAbdomen = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.1 });
  const matAbdomenStripe = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const matWingMembrane = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide });
  const matLeg = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });

  // 1. 가슴 (Thorax_body)
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), matThorax);
  thorax.scale.set(1.0, 0.92, 1.25);
  thorax.position.set(0, 0.14, 0);
  thorax.castShadow = true;
  flyGroup.add(thorax);

  // 2. 머리 (Head_body + Ocelli)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.14, 0.15);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 14), matHead);
  headMesh.scale.set(1.1, 0.9, 0.95);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // 붉은 복안 2개 (Head_red Compound Eyes)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), matRedEye);
  eyeL.position.set(0.056, 0.015, 0.02);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), matRedEye);
  eyeR.position.set(-0.056, 0.015, 0.02);
  headGroup.add(eyeR);

  // 더듬이 2개 (Antenna_left/right_body) + 냄새 자극 노드
  const antMatL = new THREE.MeshBasicMaterial({ color: 0xffd60a });
  const antMatR = new THREE.MeshBasicMaterial({ color: 0xffd60a });

  const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.08), matHead);
  antL.rotation.set(-0.4, 0.2, -0.3);
  antL.position.set(0.025, 0.04, 0.07);
  headGroup.add(antL);

  const antR = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.08), matHead);
  antR.rotation.set(-0.4, -0.2, 0.3);
  antR.position.set(-0.025, 0.04, 0.07);
  headGroup.add(antR);

  const antTipL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), antMatL);
  antTipL.position.set(0.04, 0.07, 0.1);
  headGroup.add(antTipL);

  const antTipR = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), antMatR);
  antTipR.position.set(-0.04, 0.07, 0.1);
  headGroup.add(antTipR);

  flyGroup.add(headGroup);

  // 3. 배 (Abdomen 1~8 Segments)
  const abdomenGroup = new THREE.Group();
  abdomenGroup.position.set(0, 0.13, -0.12);

  for (let s = 0; s < 6; s++) {
    const segMat = s % 2 === 0 ? matAbdomen : matAbdomenStripe;
    const radius = 0.125 * Math.sin(((s + 1) / 7) * Math.PI);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 0.045, 16), segMat);
    seg.rotation.x = -Math.PI / 2 + 0.15;
    seg.position.set(0, -s * 0.015, -s * 0.042);
    seg.castShadow = true;
    abdomenGroup.add(seg);
  }
  flyGroup.add(abdomenGroup);

  // 4. 날개 2개 (Wing_left/right_membrane)
  const wingGeo = new THREE.PlaneGeometry(0.14, 0.42);
  wingGeo.translate(0, 0.21, 0);

  const wingL = new THREE.Mesh(wingGeo, matWingMembrane);
  wingL.rotation.set(-Math.PI / 2 + 0.08, 0.35, -0.2);
  wingL.position.set(0.065, 0.22, -0.06);
  flyGroup.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, matWingMembrane);
  wingR.rotation.set(-Math.PI / 2 + 0.08, -0.35, 0.2);
  wingR.position.set(-0.065, 0.22, -0.06);
  flyGroup.add(wingR);

  // 5. 다리 6개 (T1, T2, T3 Legs: Coxa, Femur, Tibia, Tarsus)
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2); // 0:앞다리(T1), 1:중다리(T2), 2:뒷다리(T3)
    const legGroup = new THREE.Group();

    // Coxa + Femur (허벅지)
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, 0.15), matLeg);
    femur.position.set(side * 0.07, 0, 0);
    femur.rotation.z = -side * 0.82;
    femur.castShadow = true;
    legGroup.add(femur);

    // Tibia + Tarsus (정아리)
    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.003, 0.17), matLeg);
    tibia.position.set(side * 0.135, -0.085, 0);
    tibia.rotation.z = side * 0.35;
    tibia.castShadow = true;
    legGroup.add(tibia);

    legGroup.position.set(side * 0.05, 0.12, 0.09 - row * 0.095);
    flyGroup.add(legGroup);
    legs.push({ group: legGroup, side, row });
  }

  scene.add(flyGroup);
  flyGroup.scale.set(0.12, 0.12, 0.12);
  return { root: flyGroup, wingL, wingR, antTipL, antTipR, antMatL, antMatR, legs };
}

const fly3D = createFruitFly3DMesh();

// ---- 3D 바나나 모델 ----
const bananaGroup = new THREE.Group();
const bMat = new THREE.MeshStandardMaterial({ color: 0x6b7036, emissive: 0x484c24, emissiveIntensity: 0.4, roughness: 0.4 });
const bCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.16, 0.05, 0),
  new THREE.Vector3(-0.06, 0.03, 0),
  new THREE.Vector3(0.06, 0.05, 0),
  new THREE.Vector3(0.15, 0.12, 0)
]);
const bMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 24, 0.028, 10, false), bMat);
bMesh.castShadow = true;
bananaGroup.add(bMesh);

const bGlow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ color: 0x6b7036, transparent: true, opacity: 0.18, depthWrite: false }));
bGlow.rotation.x = -Math.PI / 2;
bGlow.position.y = 0.004;
bananaGroup.add(bGlow);

scene.add(bananaGroup);

function placeBanana3D(x, z) {
  state.banana = { x, y: -z };
  bananaGroup.position.set(x, 0, z);
  bananaGroup.visible = true;
  state.pulse = 1;
}
placeBanana3D(0.5, -0.9);

// 3D 무대 클릭으로 바나나 위치 지정
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('pointerup', e => {
  if (!ready) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(floor);
  if (intersects.length > 0) {
    const pt = intersects[0].point;
    if (Math.hypot(pt.x, pt.z) < 5.5) {
      placeBanana3D(pt.x, pt.z);
    }
  }
});

// Resize 3D 뷰어
function resizeRenderer() {
  const width = canvas.parentElement.clientWidth;
  const height = canvas.parentElement.clientHeight || width;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);
setTimeout(resizeRenderer, 100);

// ---- 자극 계산 ----
function stimulus() {
  const s = { visual_left: lab.light * .65, visual_right: lab.light * .65, olfactory_left: 0, olfactory_right: 0, mechanosensory_left: 0, mechanosensory_right: 0 };
  const b = bananaGroup.visible ? state.banana : null;
  if (b) {
    const dx = b.x - state.x, dy = b.y - state.y, bearing = Math.atan2(dy, dx) - state.yaw;
    const st = .95 * Math.exp(-Math.hypot(dx, dy) / lab.range) * (.25 + .75 * (1 + Math.cos(bearing)) / 2);
    let l = st * (.5 + .5 * Math.sin(bearing)), r = st * (.5 - .5 * Math.sin(bearing));
    if (lab.antenna === 'noLeft') l = 0; else if (lab.antenna === 'noRight') r = 0; else if (lab.antenna === 'swap') [l, r] = [r, l];
    s.olfactory_left = l; s.olfactory_right = r;
  }
  for (const [name, side] of [['mechanosensory_left', .65], ['mechanosensory_right', -.65]]) {
    const a = state.yaw + side, qx = state.x + .22 * Math.cos(a), qy = state.y + .22 * Math.sin(a);
    s[name] = Math.max(0, Math.min(1, (Math.max(Math.abs(qx), Math.abs(qy)) - 2.8) / .3));
  }
  return s;
}

// ---- 워커 + 뇌 뷰어 ----
const worker = new Worker(new URL('./brain-worker.js', import.meta.url), { type: 'module' });
let brainReady = false, viewReady = false;
function maybeStart() {
  if (brainReady && viewReady && !ready) {
    ready = true;
    $('loading').hidden = true;
    $('loading').style.display = 'none';
    $('dot').classList.add('live');
    worker.postMessage({ type: 'stimulus', value: stimulus() });
    worker.postMessage({ type: 'start' });
  }
}

worker.onmessage = ({ data: m }) => {
  if (m.type === 'progress') {
    if (m.label === '뇌 배선') {
      const pct = m.total ? Math.round(100 * m.got / m.total) : 0;
      $('prog').value = pct;
      $('progText').textContent = `뇌 배선 ${(m.got / 1e6).toFixed(1)} / ${(m.total / 1e6).toFixed(1)} MB`;
    }
  } else if (m.type === 'ready') {
    brainReady = true;
    $('statusText').textContent = `작동 중 · 뉴런 ${m.neurons.toLocaleString()} · 운동뉴런 ${m.motor}`;
    maybeStart();
  } else if (m.type === 'activity') {
    activity = m;
    if (brainView && m.fireState) brainView.update(m.fireState);
  } else if (m.type === 'error') {
    $('loading').hidden = false;
    $('loading').firstElementChild.textContent = '오류: ' + m.message;
  }
};
worker.postMessage({ type: 'init', graphUrl: new URL('./brain/connectome.bin.gz', location.href).href, metaUrl: new URL('./brain/channels.json?v=3', location.href).href });

createBrainView($('brain'), {
  low: matchMedia('(max-width:900px)').matches,
  dir: './brain',
  autoRotate: true,
  shell: false,
  baseAlpha: .17,
  pointScale: matchMedia('(max-width:900px)').matches ? 1.0 : 1.45,
  groupGain: { 0: 1.2, 1: 1, 2: .22, 3: .9, 4: 1.3 },
  channelColors: { olfactory_left: 0xffb020, olfactory_right: 0xffb020, ALPN_left: 0xffd60a, ALPN_right: 0xffd60a, descending_left: 0xff7a3d, descending_right: 0xff7a3d, motor_left: 0xfff176, motor_right: 0xfff176 }
}).then(v => { brainView = v; viewReady = true; maybeStart(); }).catch(e => { $('loading').firstElementChild.textContent = '뇌 그림 오류: ' + e.message; });

setInterval(() => { if (ready) worker.postMessage({ type: 'stimulus', value: stimulus() }); }, 50);

// 조작 버튼 이벤트
$('clear').onclick = () => { bananaGroup.visible = false; };
for (const b of document.querySelectorAll('[data-antenna]')) b.onclick = () => { for (const o of document.querySelectorAll('[data-antenna]')) o.setAttribute('aria-pressed', String(o === b)); lab.antenna = b.dataset.antenna; };
$('cut').onclick = () => { cut = !cut; $('cut').setAttribute('aria-pressed', String(cut)); $('cut').textContent = cut ? '시냅스 켜기' : '시냅스 끄기'; worker.postMessage({ type: 'cut', value: cut }); };
$('rotate').onclick = () => {
  autoRotate = !autoRotate;
  $('rotate').setAttribute('aria-pressed', String(autoRotate));
  $('rotate').textContent = autoRotate ? '회전 멈춤' : '회전 시작';
  brainView?.setAutoRotate?.(autoRotate);
};
$('reset').onclick = () => {
  Object.assign(state, { x: 0, y: 0, yaw: Math.PI / 2, v: 0, w: 0, legPhase: [0, 0], collected: 0, respawnAt: 0, pulse: 1 });
  placeBanana3D(0.5, -0.9);
  worker.postMessage({ type: 'reset' });
  brainView?.resetView();
};

// ---- 3D 시뮬레이션 루프 ----
function step(dt) {
  if (!ready) return;
  const c = activity?.command || { forward: 0, turn: 0 };
  state.v += (c.forward * 1.5 - state.v) * Math.min(1, dt * 8);
  state.w += (c.turn - state.w) * Math.min(1, dt * 8);
  if (Math.abs(c.turn) < 0.03) state.w *= 0.82;

  state.yaw += state.w * dt;
  state.x += Math.cos(state.yaw) * state.v * dt;
  state.y += Math.sin(state.yaw) * state.v * dt;

  state.x = Math.max(-2.8, Math.min(2.8, state.x));
  state.y = Math.max(-2.8, Math.min(2.8, state.y));

  const mL = activity?.motorLeft || 0, mR = activity?.motorRight || 0;
  state.legPhase[0] += dt * (state.v * 16 + mL * 300);
  state.legPhase[1] += dt * (state.v * 16 + mR * 300);

  // 3D 위치 및 회전 업데이트 (Three.js Z-up / Y-up 좌표 매핑: z = -y, 머리가 전진 방향 100% 정면을 직시함)
  fly3D.root.position.set(state.x, 0, -state.y);
  fly3D.root.rotation.y = -state.yaw - Math.PI / 2;

  // 3D 삼각 걸음 애니메이션 (Leg Swinging)
  fly3D.legs.forEach((leg, idx) => {
    const ph = state.legPhase[leg.side < 0 ? 0 : 1] + (idx % 2 === 0 ? 0 : Math.PI);
    leg.group.rotation.x = Math.sin(ph) * 0.35;
    leg.group.rotation.y = Math.cos(ph) * 0.15;
  });

  // 날개 및 더듬이 3D 실시간 파동
  fly3D.wingL.rotation.z = -0.2 + Math.sin(performance.now() / 80) * 0.05;
  fly3D.wingR.rotation.z = 0.2 - Math.sin(performance.now() / 80) * 0.05;

  const s = stimulus();
  fly3D.antMatL.color.setHSL(0.12, 1.0, 0.2 + Math.min(1, s.olfactory_left) * 0.7);
  fly3D.antMatR.color.setHSL(0.12, 1.0, 0.2 + Math.min(1, s.olfactory_right) * 0.7);

  // 바나나 수집 검사
  if (bananaGroup.visible && Math.hypot(state.banana.x - state.x, state.banana.y - state.y) < 0.18) {
    state.collected++;
    bananaGroup.visible = false;
    state.respawnAt = performance.now() + 600;
  }
  if (!bananaGroup.visible && state.respawnAt && performance.now() > state.respawnAt) {
    const a = Math.random() * Math.PI * 2, d = 0.9 + Math.random() * 1.2;
    const px = Math.max(-2.4, Math.min(2.4, state.x + d * Math.cos(a)));
    const py = Math.max(-2.4, Math.min(2.4, state.y + d * Math.sin(a)));
    placeBanana3D(px, -py);
    state.respawnAt = 0;
  }

  // 3D 카메라 부드러운 추적
  const camTarget = new THREE.Vector3(state.x, 0.025, -state.y);
  controls.target.lerp(camTarget, 0.08);
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  step(dt);

  controls.update();
  renderer.render(scene, camera);
  if (brainView) brainView.render();
}

requestAnimationFrame(render);

