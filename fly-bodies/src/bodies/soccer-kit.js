// 로봇 사커 킷 (Omnidirectional Robot Soccer Kit, MIT License) 3D 시뮬레이션 및 초파리 뇌 구동계 연결 모듈.
import * as THREE from 'three';
import {parseMjcf} from '../mjcf.js';
import {getMujoco, fetchBuf} from '../engine.js';

export async function createSoccerKitBody(scene, onStatus = () => {}, envXml = '') {
  onStatus('로봇 사커 킷 3D 모델 및 옴니휠 구동계 로딩 중…');
  const mj = await getMujoco();
  const xmlText = await fetch('./robots/soccer_kit/soccer_kit.xml').then(r => r.text());
  const rig = parseMjcf(xmlText);
  const vfs = new mj.MjVFS();
  let got = 0;
  await Promise.all(rig.meshes.map(async m => {
    const buf = await fetchBuf('./robots/soccer_kit/assets/' + m.file);
    vfs.addBuffer('assets/' + m.file, new Uint8Array(buf));
    onStatus(`로봇 사커 킷 부품 ${++got}/${rig.meshes.length}`);
  }));

  const doc = rig.doc;
  let opt = doc.querySelector('option');
  if (!opt) {
    opt = doc.createElement('option');
    doc.documentElement.insertBefore(opt, doc.documentElement.firstElementChild);
  }
  opt.setAttribute('timestep', '0.004');

  // 미세 미소 조인트 충돌 수치 폭발 방지: 패시브 조인트 들의 contype/conaffinity 비활성화
  for (const b of doc.querySelectorAll('body')) {
    const bname = b.getAttribute('name') || '';
    if (bname.includes('passive') || bname.includes('pin_bearing_oring')) {
      for (const g of b.querySelectorAll('geom')) {
        g.setAttribute('contype', '0');
        g.setAttribute('conaffinity', '0');
      }
    }
  }

  // base body에 로봇 사커 킷 충돌체(Cylinder Collision Geom) 추가하여 장애물 통과 방지
  const baseBody = doc.querySelector('body[name="base"]');
  if (baseBody) {
    const collGeom = doc.createElement('geom');
    collGeom.setAttribute('name', 'soccer_base_coll');
    collGeom.setAttribute('type', 'cylinder');
    collGeom.setAttribute('size', '0.125 0.04');
    collGeom.setAttribute('pos', '0 0 0.035');
    collGeom.setAttribute('contype', '1');
    collGeom.setAttribute('conaffinity', '1');
    collGeom.setAttribute('friction', '0.8 0.1 0.1');
    collGeom.setAttribute('group', '3');
    baseBody.appendChild(collGeom);
  }

  if (envXml) {
    const wb = doc.querySelector('worldbody');
    const frag = new DOMParser().parseFromString('<r>' + envXml + '</r>', 'text/xml');
    for (const g of [...frag.documentElement.children]) {
      wb.appendChild(doc.importNode(g, true));
    }
  }

  const model = mj.MjModel.from_xml_string(new XMLSerializer().serializeToString(doc), vfs);
  const data = new mj.MjData(model);
  const OBJ = mj.mjtObj, id = (t, n) => mj.mj_name2id(model, t.value, n);
  const rootId = id(OBJ.mjOBJ_BODY, 'base');

  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);

  const mat = new THREE.MeshStandardMaterial({color: 0x4a5d78, metalness: 0.5, roughness: 0.4});
  const accent = new THREE.MeshStandardMaterial({color: 0x6b7036, metalness: 0.4, roughness: 0.4});
  const accentNames = ['marker', 'blue1_blue', 'kicker_tip_1', 'plunger'];

  const gt = model.geom_type, gd = model.geom_dataid, gb = model.geom_bodyid, gg = model.geom_group, gp = model.geom_pos, gq = model.geom_quat;
  const mv = model.mesh_vert, mva = model.mesh_vertadr, mvn = model.mesh_vertnum, mf = model.mesh_face, mfa = model.mesh_faceadr, mfn = model.mesh_facenum;
  const groups = new Map();
  let drawn = 0;

  for (let g = 0; g < model.ngeom; g++) {
    if (gt[g] !== 7 || gg[g] === 3) continue;
    const mid = gd[g];
    const va = mva[mid], vn = mvn[mid], fa = mfa[mid], fn = mfn[mid];
    const pos = new Float32Array(vn * 3);
    for (let i = 0; i < vn * 3; i++) pos[i] = mv[va * 3 + i];
    const idx = new Uint32Array(fn * 3);
    for (let i = 0; i < fn * 3; i++) idx[i] = mf[fa * 3 + i];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    const mname = mj.mj_id2name(model, OBJ.mjOBJ_MESH.value, mid) || '';
    const isAcc = accentNames.some(a => mname.toLowerCase().includes(a.toLowerCase()));
    const mesh = new THREE.Mesh(geo, isAcc ? accent : mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(gp[3 * g], gp[3 * g + 1], gp[3 * g + 2]);
    mesh.quaternion.set(gq[4 * g + 1], gq[4 * g + 2], gq[4 * g + 3], gq[4 * g]);

    const b = gb[g];
    if (!groups.has(b)) {
      const grp = new THREE.Group();
      root.add(grp);
      groups.set(b, grp);
    }
    groups.get(b).add(mesh);
    drawn++;
  }
  const bodyGroups = [...groups.entries()].map(([id, group]) => ({id, group}));
  onStatus(`로봇 사커 킷: 부품 ${drawn}개 3D 렌더링 준비 완료`);

  let currentYaw = 0;

  function pose() {
    const p = data.xpos, q = data.xquat, i = rootId >= 0 ? rootId : 0;
    const px = Number.isFinite(p[3 * i]) ? p[3 * i] : 0;
    const py = Number.isFinite(p[3 * i + 1]) ? p[3 * i + 1] : 0;
    const pz = Number.isFinite(p[3 * i + 2]) ? p[3 * i + 2] : 0.035;
    return {
      x: px,
      y: py,
      z: pz,
      yaw: currentYaw
    };
  }

  function sync() {
    const p = data.xpos, q = data.xquat;
    for (const {group, id: i} of bodyGroups) {
      if (i < 0) continue;
      const px = p[3 * i], py = p[3 * i + 1], pz = p[3 * i + 2];
      const qw = q[4 * i], qx = q[4 * i + 1], qy = q[4 * i + 2], qz = q[4 * i + 3];
      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz) && Number.isFinite(qw)) {
        group.position.set(px, py, pz);
        group.quaternion.set(qx, qy, qz, qw);
      }
    }
  }

  let cmd = {forward: 0, turn: 0};
  let steps = 0, policyCalls = 0, fallen = false, distance = 0, prev = null;
  const ctrlDt = 0.02;

  function reset() {
    mj.mj_resetData(model, data);
    currentYaw = 0;
    data.qpos[0] = 0.0;
    data.qpos[1] = 0.0;
    data.qpos[2] = 0.035;
    data.qpos[3] = 1.0;
    data.qpos[4] = 0.0;
    data.qpos[5] = 0.0;
    data.qpos[6] = 0.0;
    mj.mj_forward(model, data);
    steps = 0;
    policyCalls = 0;
    fallen = false;
    distance = 0;
    prev = null;
    sync();
  }

  const N_SUB = 5;
  async function controlStep() {
    policyCalls++;
    const fwd = Math.max(0, Math.min(0.24, cmd.forward));
    const trn = Math.max(-0.7, Math.min(0.7, cmd.turn));

    // 초파리 뇌 출력(전진/회전) 기반 옴니휠 물리 속도 제어 및 충돌 방지
    currentYaw += trn * 0.8 * ctrlDt;
    const speed = fwd * 1.2;
    const vx = speed * Math.cos(currentYaw);
    const vy = speed * Math.sin(currentYaw);

    // base 6DoF 자유 조인트 속도 주입 (z 및 롤/피치 고정, 평면 옴니휠 제어)
    data.qvel[0] = vx;
    data.qvel[1] = vy;
    data.qvel[2] = 0;
    data.qvel[3] = 0;
    data.qvel[4] = 0;
    data.qvel[5] = trn * 0.8;

    // 높이 z와 요(yaw) 회전 쿼터니언 업데이트
    data.qpos[2] = Math.max(0.035, data.qpos[2]);
    const halfYaw = currentYaw / 2;
    data.qpos[3] = Math.cos(halfYaw);
    data.qpos[4] = 0;
    data.qpos[5] = 0;
    data.qpos[6] = Math.sin(halfYaw);

    // MuJoCo 물리 엔진 충돌 감지 및 적분 스텝 수행 (장애물과 부딪쳐 정지/밀림)
    for (let k = 0; k < N_SUB; k++) {
      mj.mj_step(model, data);
    }
    steps += N_SUB;

    const p = pose();
    if (prev) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (d < 0.2) distance += d;
    }
    prev = p;
    sync();
  }

  function setCommand(forward, turn) {
    cmd = {forward, turn};
  }

  function dispose() {
    scene.remove(root);
    try {
      data.delete();
      model.delete();
      vfs.delete();
    } catch (e) {}
  }

  reset();

  return {
    key: 'soccer_kit',
    reset,
    controlStep,
    setCommand,
    pose,
    root,
    dispose,
    ctrlDt: 0.02,
    camDist: 1.8,
    camHeight: 0.35,
    state: () => ({
      steps,
      policyCalls,
      fallen: false,
      distance,
      cmd: [cmd.forward, 0, cmd.turn],
      joints: Array.from({length: model.nu}, (_, i) => data.ctrl[i] || 0),
      ...pose()
    }),
    info: {
      name: '로봇 사커 킷 (Omni-Wheel Soccer Kit)',
      joints: model.nu,
      policy: '초파리 뇌 옴니휠 차동 구동계 디코더 (LIF)',
      model: 'Robot Soccer Kit omnidirectional (MIT License)',
      obs: 12
    }
  };
}
