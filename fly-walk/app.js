import {setupWalkObservatory} from './observatory.js';
// 초파리 뇌 걷기 — 3D 경기장 + 실시간 3D 초파리 무대. 뇌: MaleCNS 2026 (워커 물통 모델).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBrainView } from './brain-view.js';

const $ = id => document.getElementById(id);
const container = $('c').parentElement;

// 2D Canvas 대신 Three.js WebGLRenderer 사용
const canvas2d = $('c');
canvas2d.style.display = 'none';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const W = 4.0;
const state = { x: 0, y: 0, yaw: Math.PI / 2, v: 0, w: 0, legPhase: [0, 0], collected: 0, banana: { x: 0.5, y: 0.9 }, respawnAt: 0, steps: [], stepAcc: 0, pulse: 0 };
const lab = { antenna: 'normal', range: 1.25, light: 0.45 };
let activity = null, ready = false, cut = false, lastT = performance.now(), brainView = null, autoRotate = true;
let paused=false,playbackRate=1,pendingSingleStep=false;

// ---- Three.js 3D 씬 구축 ----
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f5f2eb');
scene.fog = new THREE.Fog('#f5f2eb',8,25);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
camera.position.set(0, 3.4, 3.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 0.15, 0);

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);

// 조명
scene.add(new THREE.HemisphereLight(0xffffff,0xd0cbbd,1.8));
const sun = new THREE.DirectionalLight(0xfff8eb, 2.2);
sun.position.set(-2.5, 5, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const pointLight = new THREE.PointLight(0x6b7036, 1, 6);
pointLight.position.set(0, 1.2, 0);
scene.add(pointLight);

// 경기장 바닥 (3D Circle & Grid)
const floorGeo = new THREE.BoxGeometry(12, .08, 12);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e0d4, roughness: .9, metalness: .05 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12, 60, 0x9b9588, 0xd0c9bb);
grid.position.y = 0.001;
scene.add(grid);

const ringGeo = new THREE.RingGeometry(1.92, 1.98, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.002;
// The fly movement bounds remain unchanged; the floor now extends past them.
ring.visible=false;

// ---- DeepMind MuJoCo flybody 해부학 3D 초파리(Drosophila melanogaster) 메쉬 생성 ----
function create3DFly() {
  const flyGroup = new THREE.Group();

  // 1. 머리 캡슐 (Head Capsule & Proboscis)
  const headGroup = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(0.105, 20, 20);
  headGeo.scale(1.1, 0.9, 1.0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x6e5233, roughness: 0.45, metalness: 0.15 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // 주둥이 (Proboscis / Rostrum)
  const probGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.09, 12);
  const probMat = new THREE.MeshStandardMaterial({ color: 0x4a341e, roughness: 0.6 });
  const prob = new THREE.Mesh(probGeo, probMat);
  prob.position.set(0, -0.07, 0.08);
  prob.rotation.x = Math.PI / 6;
  headGroup.add(prob);

  // 정수리 단안 3개 (Ocelli)
  const ocelliMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
  for (const pos of [[0, 0.088, 0.02], [-0.018, 0.078, 0.01], [0.018, 0.078, 0.01]]) {
    const ocellus = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), ocelliMat);
    ocellus.position.set(...pos);
    headGroup.add(ocellus);
  }

  // 측면 붉은 복안 2개 (Compound Eyes - Drosophila Crimson Red)
  for (const side of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.052, 16, 16);
    eyeGeo.scale(0.85, 1.05, 1.15);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xcc1a0c, roughness: 0.18, metalness: 0.3, emissive: 0x440500 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.078, 0.01, 0.03);
    eye.rotation.y = side * 0.25;
    headGroup.add(eye);
  }

  // 깃털 더듬이 2개 (Antennae & Arista with Olfactory Glow)
  const antMats = [];
  for (const side of [-1, 1]) {
    const antGroup = new THREE.Group();
    // 더듬이 마디 (Funicle)
    const baseGeo = new THREE.CylinderGeometry(0.006, 0.012, 0.06, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.35 });
    const base = new THREE.Mesh(baseGeo, antMat);
    base.rotation.x = Math.PI / 4;
    antGroup.add(base);

    // 깃털 깃대 (Arista)
    const aristaGeo = new THREE.ConeGeometry(0.004, 0.1, 6);
    const aristaMat = new THREE.MeshBasicMaterial({ color: 0xffe57f });
    const arista = new THREE.Mesh(aristaGeo, aristaMat);
    arista.position.set(side * 0.01, 0.05, 0.04);
    arista.rotation.z = -side * Math.PI / 5;
    antGroup.add(arista);

    antGroup.position.set(side * 0.032, 0.04, 0.095);
    headGroup.add(antGroup);
    antMats.push(antMat);
  }

  headGroup.position.set(0, 0.165, 0.18);
  flyGroup.add(headGroup);

  // 2. 가슴 (Thorax & Scutellum)
  const thxGroup = new THREE.Group();
  const thxGeo = new THREE.SphereGeometry(0.145, 20, 20);
  thxGeo.scale(1.0, 0.9, 1.2);
  const thxMat = new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 0.35, metalness: 0.2 });
  const thx = new THREE.Mesh(thxGeo, thxMat);
  thx.castShadow = true;
  thxGroup.add(thx);

  // 소배판 (Scutellum)
  const scutGeo = new THREE.ConeGeometry(0.06, 0.08, 3);
  scutGeo.rotateX(-Math.PI / 2);
  const scutMat = new THREE.MeshStandardMaterial({ color: 0x5a4225, roughness: 0.4 });
  const scut = new THREE.Mesh(scutGeo, scutMat);
  scut.position.set(0, 0.06, -0.14);
  thxGroup.add(scut);

  // 평형곤 2개 (Halteres - Hindwing Sensors)
  for (const side of [-1, 1]) {
    const haltGroup = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06), new THREE.MeshBasicMaterial({ color: 0xddccaa }));
    stalk.rotation.z = side * Math.PI / 3;
    haltGroup.add(stalk);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    knob.position.set(side * 0.03, 0.02, 0);
    haltGroup.add(knob);
    haltGroup.position.set(side * 0.09, 0.02, -0.11);
    thxGroup.add(haltGroup);
  }

  thxGroup.position.set(0, 0.17, 0);
  flyGroup.add(thxGroup);

  // 3. 배 6개 마디 (Abdomen - 6 Segmented Tergites)
  const abdGroup = new THREE.Group();
  const segNum = 6;
  for (let i = 0; i < segNum; i++) {
    const radius = 0.17 * Math.sin(Math.PI * (i + 1) / (segNum + 1.2));
    const segGeo = new THREE.CylinderGeometry(radius, radius * 0.9, 0.06, 16);
    segGeo.rotateX(Math.PI / 2);
    // Drosophila melanogaster 특유의 마디 스트라이프 띠
    const isBand = i % 2 === 1;
    const segMat = new THREE.MeshStandardMaterial({ color: isBand ? 0x241a10 : 0x8c6b45, roughness: 0.5 });
    const seg = new THREE.Mesh(segGeo, segMat);
    seg.position.set(0, 0, -i * 0.052);
    seg.castShadow = true;
    abdGroup.add(seg);
  }
  abdGroup.position.set(0, 0.155, -0.12);
  flyGroup.add(abdGroup);

  // 4. 시맥이 표현된 영롱한 무지개빛 날개 (Wings with Venation)
  const wings = [];
  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();
    // 날개 막 (Wing Membrane)
    const wingGeo = new THREE.PlaneGeometry(0.19, 0.48);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xe0edff, transparent: true, opacity: 0.55, roughness: 0.08, side: THREE.DoubleSide });
    const wingMembrane = new THREE.Mesh(wingGeo, wingMat);
    wingMembrane.position.set(0, 0, -0.22);
    wingGroup.add(wingMembrane);

    // 날개 시맥 (Veins L1~L5 Lines)
    const veinMat = new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.65 });
    const veinPts = [
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.45),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.06, 0, -0.42),
      new THREE.Vector3(0, 0, -0.15), new THREE.Vector3(side * 0.08, 0, -0.38),
      new THREE.Vector3(0, 0, -0.25), new THREE.Vector3(side * 0.04, 0, -0.44)
    ];
    const veinGeo = new THREE.BufferGeometry().setFromPoints(veinPts);
    const veins = new THREE.LineSegments(veinGeo, veinMat);
    wingGroup.add(veins);

    wingGroup.position.set(side * 0.09, 0.25, -0.04);
    wingGroup.rotation.x = Math.PI / 2;
    wingGroup.rotation.y = side * 0.22;
    flyGroup.add(wingGroup);
    wings.push(wingGroup);
  }

  // 5. 정교한 4마디 3D 다리 6개 (6 Legs: Coxa, Femur, Tibia, Tarsus)
  const legs = [];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const legGroup = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2f20, roughness: 0.55 });

      // 기절 (Coxa)
      const coxa = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.07), legMat);
      coxa.position.set(side * 0.03, -0.02, 0);
      coxa.rotation.z = -side * Math.PI / 4;
      legGroup.add(coxa);

      // 퇴절 (Femur)
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.16), legMat);
      femur.position.set(side * 0.08, -0.06, 0);
      femur.rotation.z = -side * Math.PI / 3;
      legGroup.add(femur);

      // 경절 (Tibia)
      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.18), legMat);
      tibia.position.set(side * 0.15, -0.14, 0);
      tibia.rotation.z = side * Math.PI / 5;
      legGroup.add(tibia);

      // 부절 (Tarsus 5-segment)
      const tarsus = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.10), legMat);
      tarsus.position.set(side * 0.18, -0.22, 0);
      tarsus.rotation.z = side * Math.PI / 10;
      legGroup.add(tarsus);

      const zOffset = (i - 1) * 0.13;
      legGroup.position.set(0, 0.14, zOffset);
      flyGroup.add(legGroup);
      legs.push({ group: legGroup, side, i });
    }
  }

  scene.add(flyGroup);
  return { root: flyGroup, antMats, wings, legs };
}

const fly3D = create3DFly();

// ---- 3D 바나나 생성 ----
function create3DBanana() {
  const bananaGroup = new THREE.Group();
  const bCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.14, 0.04, 0),
    new THREE.Vector3(-0.05, 0.02, 0),
    new THREE.Vector3(0.05, 0.04, 0),
    new THREE.Vector3(0.13, 0.1, 0)
  ]);
  const bGeo = new THREE.TubeGeometry(bCurve, 20, 0.03, 10, false);
  const bMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.35, emissive: 0x886600, emissiveIntensity: 0.4 });
  const bMesh = new THREE.Mesh(bGeo, bMat);
  bMesh.castShadow = true;
  bananaGroup.add(bMesh);

  const ringGeo = new THREE.RingGeometry(0.08, 0.45, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  const glowRing = new THREE.Mesh(ringGeo, ringMat);
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.004;
  bananaGroup.add(glowRing);

  scene.add(bananaGroup);
  return { root: bananaGroup, glow: glowRing };
}

const banana3D = create3DBanana();

// 3D 궤적 (Trail Line)
const trailGeo = new THREE.BufferGeometry();
const trailMat = new THREE.LineDashedMaterial({ color: 0x000000, dashSize: 0.04, gapSize: 0.04, transparent: true, opacity: 0.7 });
const trailLine = new THREE.Line(trailGeo, trailMat);
scene.add(trailLine);
const trailPts = [];

function updateTrail(x, z) {
  if (!trailPts.length || Math.hypot(x - trailPts.at(-1).x, z - trailPts.at(-1).z) > 0.03) {
    trailPts.push(new THREE.Vector3(x, 0.01, z));
    if (trailPts.length > 300) trailPts.shift();
    trailLine.geometry.dispose();
    trailLine.geometry = new THREE.BufferGeometry().setFromPoints(trailPts);
    trailLine.computeLineDistances();
  }
}

function stimulus() {
  const s = { visual_left: lab.light * .65, visual_right: lab.light * .65, olfactory_left: 0, olfactory_right: 0, mechanosensory_left: 0, mechanosensory_right: 0 };
  const b = state.banana;
  if (b) {
    const dx = b.x - state.x, dy = b.y - state.y, bearing = Math.atan2(dy, dx) - state.yaw;
    const st = .95 * Math.exp(-Math.hypot(dx, dy) / lab.range) * (.25 + .75 * (1 + Math.cos(bearing)) / 2);
    let l = st * (.5 + .5 * Math.sin(bearing)), r = st * (.5 - .5 * Math.sin(bearing));
    if (lab.antenna === 'noLeft') l = 0; else if (lab.antenna === 'noRight') r = 0; else if (lab.antenna === 'swap') [l, r] = [r, l];
    s.olfactory_left = l; s.olfactory_right = r;
  }
  for (const [name, side] of [['mechanosensory_left', .65], ['mechanosensory_right', -.65]]) {
    const a = state.yaw + side, qx = state.x + .22 * Math.cos(a), qy = state.y + .22 * Math.sin(a);
    s[name] = Math.max(0, Math.min(1, (Math.max(Math.abs(qx), Math.abs(qy)) - 1.65) / .3));
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
    if(m.requestId==='single-step'&&pendingSingleStep){step(.1,true);pendingSingleStep=false;$('singleStep').disabled=false;}
    if (brainView && m.fireState) brainView.update(m.fireState);
  } else if (m.type === 'error') {
    pendingSingleStep=false;paused=true;$('singleStep').disabled=false;
    $('loading').hidden = false;
    $('loading').firstElementChild.textContent = '오류: ' + m.message;
  }
};

worker.postMessage({ type: 'init', graphUrl: new URL('./brain/connectome.bin.gz', location.href).href, metaUrl: new URL('./brain/channels.json?v=3', location.href).href });
createBrainView($('brain'), { low: new URLSearchParams(location.search).has('low'), dir: './brain', autoRotate: true, shell: true, baseAlpha: .065, pointScale: 1.1, groupGain: { 0: 1.2, 1: 1, 2: .22, 3: .9, 4: 1.3 }, channelColors: { olfactory_left: 0xffb020, olfactory_right: 0xffb020, ALPN_left: 0xffd60a, ALPN_right: 0xffd60a, descending_left: 0xff7a3d, descending_right: 0xff7a3d, motor_left: 0xfff176, motor_right: 0xfff176 } }).then(v => { brainView = v; viewReady = true; maybeStart(); }).catch(e => { $('loading').firstElementChild.textContent = '뇌 그림 오류: ' + e.message; });
setInterval(() => { if (ready) worker.postMessage({ type: 'stimulus', value: stimulus() }); }, 100);

// ---- 3D 바나나 배치 ----
function placeBanana(mx, my) {
  state.banana = { x: mx, y: my };
  state.respawnAt = 0;
  state.pulse = 1;
  banana3D.root.position.set(mx, 0.04, -my);
  banana3D.root.visible = true;
}
placeBanana(0.5, 0.9);

// 3D Raycaster 클릭 이벤트
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('pointerup', e => {
  if (!ready) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(floor);
  if (intersects.length > 0) {
    const p = intersects[0].point;
    if (Math.abs(p.x) < 1.85 && Math.abs(p.z) < 1.85) {
      placeBanana(p.x, -p.z);
    }
  }
});

$('clear').onclick = () => { state.banana = null; state.respawnAt = 0; banana3D.root.visible = false; };
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'재개':'일시정지';$('statusText').textContent=paused?'일시정지':'작동 중';worker.postMessage({type:paused?'stop':'start'});};
for (const b of document.querySelectorAll('[data-antenna]')) b.onclick = () => { for (const o of document.querySelectorAll('[data-antenna]')) o.setAttribute('aria-pressed', String(o === b)); lab.antenna = b.dataset.antenna; };
$('cut').onclick = () => { cut = !cut; $('cut').setAttribute('aria-pressed', String(cut)); $('cut').textContent = cut ? '시냅스 켜기' : '시냅스 끄기'; worker.postMessage({ type: 'cut', value: cut }); };
$('rotate').onclick = () => { autoRotate = !autoRotate; $('rotate').setAttribute('aria-pressed', String(autoRotate)); brainView?.setAutoRotate?.(autoRotate); };
$('reset').onclick = () => {
  pendingSingleStep=false;$('singleStep').disabled=false;activity=null;lab.antenna='normal';cut=false;worker.postMessage({type:'cut',value:false});$('cut').setAttribute('aria-pressed','false');$('cut').textContent='시냅스 끄기';for(const b of document.querySelectorAll('[data-antenna]'))b.setAttribute('aria-pressed',String(b.dataset.antenna==='normal'));observatory.reset();
  Object.assign(state, { x: 0, y: 0, yaw: Math.PI / 2, v: 0, w: 0, legPhase: [0, 0], collected: 0, banana: { x: 0.5, y: 0.9 }, respawnAt: 0, steps: [], stepAcc: 0, pulse: 1 });
  trailPts.length = 0;
  placeBanana(0.5, 0.9);
  worker.postMessage({ type: 'reset' });
  brainView?.resetView();
};

const observatory=setupWalkObservatory({state,lab,legs:fly3D.legs,scene,getActivity:()=>activity,getStimulus:stimulus,
 setRate:rate=>{playbackRate=rate;worker.postMessage({type:'speed',value:rate});},
 singleStep:()=>{if(!ready||pendingSingleStep)return;paused=true;pendingSingleStep=true;$('singleStep').disabled=true;$('pause').textContent='재개';$('statusText').textContent='한 단계 관찰 · 일시정지';worker.postMessage({type:'stop'});worker.postMessage({type:'step',requestId:'single-step',stimulus:stimulus()});},
 experiment:key=>{$('reset').click();if(key==='target')placeBanana(-.9,.8);if(key==='antenna')document.querySelector('[data-antenna="noLeft"]').click();if(key==='synapses')$('cut').click();}
});

// ---- 물리 및 애니메이션 ----
function step(dt,force=false) {
  if (!ready || (paused&&!force)) return;
  const previous={x:state.x,y:state.y,yaw:state.yaw};
  const c = activity?.command || { forward: 0, turn: 0 };
  state.v += (c.forward * 1.6 - state.v) * Math.min(1, dt * 4);
  state.w += (c.turn - state.w) * Math.min(1, dt * 4);
  state.yaw += state.w * dt;
  state.x += Math.cos(state.yaw) * state.v * dt;
  state.y += Math.sin(state.yaw) * state.v * dt;
  state.x = Math.max(-1.85, Math.min(1.85, state.x));
  state.y = Math.max(-1.85, Math.min(1.85, state.y));

  const mL = activity?.motorLeft || 0, mR = activity?.motorRight || 0;
  state.legPhase[0] += dt * (state.v * 14 + mL * 400);
  state.legPhase[1] += dt * (state.v * 14 + mR * 400);

  if (state.banana && Math.hypot(state.banana.x - state.x, state.banana.y - state.y) < 0.22) {
    state.collected++;
    state.banana = null;
    banana3D.root.visible = false;
    state.respawnAt = performance.now() + 600;
  }

  if (!state.banana && state.respawnAt && performance.now() > state.respawnAt) {
    let p;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 0.8 + Math.random() * 0.8;
      p = { x: state.x + d * Math.cos(a), y: state.y + d * Math.sin(a) };
      if (Math.abs(p.x) < 1.6 && Math.abs(p.y) < 1.6) break;
    }
    placeBanana(p.x, p.y);
  }

  state.pulse = Math.max(0, state.pulse - dt * 0.9);
  observatory.sample(dt,previous);
}

// 3D 메쉬 동기화 및 렌더
function draw() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  step(dt*playbackRate);
  const s = stimulus();

  // 3D 초파리 위치 및 회전 반영 (z-up을 y-up 삼차원으로 매핑: (x, 0, -y))
  fly3D.root.position.set(state.x, 0, -state.y);
  // The model's head points along local +Z; world forward is (cos(yaw), 0, -sin(yaw)).
  fly3D.root.rotation.y = state.yaw + Math.PI / 2;

  // 3D 더듬이 발화 표현
  fly3D.antMats[0].emissiveIntensity = 0.2 + s.olfactory_left * 1.5;
  fly3D.antMats[1].emissiveIntensity = 0.2 + s.olfactory_right * 1.5;

  // 3D 날개 약동
  const wingSwing = Math.sin(now / 400) * 0.05;
  fly3D.wings[0].rotation.y = 0.25 + wingSwing;
  fly3D.wings[1].rotation.y = -0.25 - wingSwing;

  // 3D 다리 6개 삼각걸음 Kinematics
  fly3D.legs.forEach(({ group, side, i }) => {
    const ph = state.legPhase[side < 0 ? 0 : 1] + (i % 2 === 0 ? 0 : Math.PI) + (side < 0 ? Math.PI : 0);
    const swing = Math.sin(ph) * 0.25;
    group.rotation.y = swing;
  });

  // 3D 발자국 궤적
  updateTrail(state.x, -state.y);

  // 3D 바나나 글로우
  if (state.banana && banana3D.root.visible) {
    banana3D.glow.scale.setScalar(1 + Math.sin(now / 300) * 0.15);
  }

  // 수치 업데이트
  const a = activity || {};
  $('walkForward').textContent=(a.command?.forward||0).toFixed(2);$('walkTurn').textContent=(a.command?.turn||0).toFixed(2);
  const pct = v => (100 * (v || 0)).toFixed(v > 0.001 ? 1 : 2);
  const setTxt = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const lvl = (id, v) => { const el = $(id); if (el) el.style.setProperty('--lvl', Math.max(0, Math.min(1, v))); };

  setTxt('fInL', s.olfactory_left.toFixed(2)); setTxt('fInR', s.olfactory_right.toFixed(2)); lvl('n0', Math.max(s.olfactory_left, s.olfactory_right));
  setTxt('fOL', pct(a.olfL)); setTxt('fOR', pct(a.olfR)); lvl('n1', Math.max(a.olfL || 0, a.olfR || 0) * 2.5);
  setTxt('fAL', pct(a.scentLeft)); setTxt('fAR', pct(a.scentRight)); lvl('n2', Math.max(a.scentLeft || 0, a.scentRight || 0) * 6);
  const dn = ((a.left || 0) + (a.right || 0)) / 2; setTxt('fDN', (100 * dn).toFixed(2)); lvl('n3', dn * 120);
  setTxt('fML', (100 * (a.motorLeft || 0)).toFixed(2)); setTxt('fMR', (100 * (a.motorRight || 0)).toFixed(2)); lvl('n4', Math.max(a.motorLeft || 0, a.motorRight || 0) * 400);
  setTxt('fFwd', (a.command?.forward || 0).toFixed(2)); setTxt('fTurn', (a.command?.turn || 0).toFixed(2) + ' rad/s'); setTxt('fSpk', (a.spikes || 0).toLocaleString()); lvl('n5', (a.command?.forward || 0) / .24);
  setTxt('count', state.collected ? ` 먹은 바나나: ${state.collected}개` : '');

  observatory.update();
  controls.update();
  renderer.render(scene, camera);
  if (brainView) brainView.render();
  window.flywalk = { ready, state, activity, stimulus: s, lab, cut, brain: brainView?.state?.() };
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
