import './style.css';
import '../../ui-common.css';
import './responsive.css';
import {CommandAdapter,candidateProfile,baselineProfile,loadProfile,validateProfile,BASELINES} from './robot-profiles.js';
import {MotionMetrics} from './motion-metrics.js';
import {createCompareBridge} from './compare-bridge.js';
import {evaluateProfiles} from './profile-evaluation.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createBrainView} from './brain-view.js';
import {createMjcfBody,GO1_CFG,G1_CFG,BH_CFG,T1_CFG} from './bodies/mjcf-body.js';
import {createDuck} from './bodies/duck.js';
import {createSoccerKitBody} from './bodies/soccer-kit.js';
import {ENVS,envXml,envMeshes,touchStimulus,getTerrainHeight} from './envs.js';
import {BRAIN_DEFS,CUSTOM_TEMPLATE,ruleBrain,randomBrain,compileCustom} from './brains.js';
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search),compareEmbed=query.get('mode')==='compare';
const brainKey=compareEmbed&&query.get('brain')==='female'?'female':'male';
const brainDir=brainKey==='female'?'./brain-female':'./brain';
if(compareEmbed){document.documentElement.classList.add('compare-embed');for(const button of document.querySelectorAll('[data-body]')){if(button.dataset.body!=='duck')button.remove();else button.disabled=true;}}
let storage;try{storage=localStorage;}catch{}
let adapter=null,bridge=null,manualEval=false,profileTrial=null;let stepping=Promise.resolve();const motion=new MotionMetrics();
let trialRequest=0;const trialRequests=new Map();
function trialWorker(type,data={}){return new Promise((resolve,reject)=>{const requestId='trial-'+(++trialRequest);const timer=setTimeout(()=>{trialRequests.delete(requestId);reject(Error('뇌 응답 시간 초과'));},15000);trialRequests.set(requestId,{resolve,reject,timer});worker.postMessage({type,requestId,...data});});}
function command(forward,turn){if(paused&&!compareEmbed&&!manualEval){emergencyStop();return;}adapter?.setCommand(forward,turn);}
function emergencyStop(){adapter?.reset();telemetry.body?.setVelocityCommand?.(0,0);}
function physicsStep(){stepping=doPhysicsStep();return stepping;}
async function doPhysicsStep(){const b=telemetry.body;if(!b)return;const c=adapter.step(b.ctrlDt);b.setVelocityCommand(c.forward,c.turn);await b.controlStep();const st=b.state();motion.update(st,b.ctrlDt,banana.visible?telemetry.banana:null,st.fallen);telemetry.motion=motion;}

const telemetry={ready:false,brainReady:false,bodyReady:false,activity:null,command:{forward:0,turn:0},body:null,banana:{x:1.2,y:0.6},collected:0,cut:false,antenna:'normal',error:null};
window.bodies=telemetry;telemetry.brainKey=brainKey;telemetry.compare=compareEmbed;
// ---- 3D 무대 ----
const host=$('world'); const scene=new THREE.Scene(); scene.background=new THREE.Color('#f5f2eb'); scene.fog=new THREE.Fog('#f5f2eb',8,25);
const camera=new THREE.PerspectiveCamera(42,1,.02,60); camera.position.set(1.9,1.1,2.0);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(compareEmbed?Math.min(Math.max(devicePixelRatio,1.5),2):(query.has('low')?.75:Math.min(devicePixelRatio,1.5))); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1; host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=1; controls.maxDistance=9; controls.maxPolarAngle=Math.PI/2-.03; controls.enablePan=false;
scene.add(new THREE.HemisphereLight(0xffffff,0xd0cbbd,1.8)); const sun=new THREE.DirectionalLight(0xfff8eb,2.2); sun.position.set(-3,6,2); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5; sun.shadow.normalBias=.02; scene.add(sun);
const rim=new THREE.PointLight(0x6b7036,4,6); rim.position.set(0,1.5,-2); scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(12,64),new THREE.MeshStandardMaterial({color:0xe5e0d4,roughness:.9,metalness:.05})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const grid=new THREE.GridHelper(24,48,0x9b9588,0xd0c9bb); grid.position.y=.002; scene.add(grid);
// 바나나 (z-up 좌표를 y-up으로): three (x, 0, -y)
const banana=new THREE.Group(); const bMat=new THREE.MeshStandardMaterial({color:0xffd700,emissive:0x886600,emissiveIntensity:.4,roughness:.4});
const bCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.16,.05,0),new THREE.Vector3(-.06,.03,0),new THREE.Vector3(.06,.05,0),new THREE.Vector3(.15,.12,0)]); const bMesh=new THREE.Mesh(new THREE.TubeGeometry(bCurve,24,.028,10,false),bMat); bMesh.castShadow=true; banana.add(bMesh);
const glow=new THREE.Mesh(new THREE.CircleGeometry(.9,96),new THREE.MeshBasicMaterial({color:0xffd700,transparent:true,opacity:.12,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})); glow.rotation.x=-Math.PI/2; glow.position.y=.015; banana.add(glow); scene.add(banana);
const trailGeo=new THREE.BufferGeometry(); const trail=new THREE.Line(trailGeo,new THREE.LineDashedMaterial({color:0x000000,dashSize:.06,gapSize:.06,transparent:true,opacity:.8})); scene.add(trail); const trailPts=[];
function clearTrail(){
  trailPts.length=0;
  if(trail.geometry){trail.geometry.dispose();}
  trail.geometry=new THREE.BufferGeometry();
}
function updateTrail(x,y){
  if(!trailPts.length||Math.hypot(x-trailPts.at(-1).x,-y-trailPts.at(-1).z)>.03){trailPts.push(new THREE.Vector3(x,getTerrainHeight(x,y,currentEnv)+.018,-y));if(trailPts.length>800)trailPts.shift();trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry().setFromPoints(trailPts);trail.computeLineDistances();}
}
function placeBanana(x,y){
  telemetry.banana={x,y};
  const h=Math.max(...[-.18,0,.18].flatMap(dx=>[-.06,0,.06].map(dy=>getTerrainHeight(x+dx,y+dy,currentEnv))))+.025;
  banana.position.set(x,h,-y);
  pulse=1;
}
let pulse=0;
const ray=new THREE.Raycaster(); let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||!telemetry.ready){down=null;return;}down=null;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(p&&Math.hypot(p.x,p.z)<9){if(compareEmbed)window.parent.postMessage({flylab:{type:'target-request',target:{x:p.x,y:-p.z}}},location.origin);else placeBanana(p.x,-p.z);}});
new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);
// ---- 냄새 센서 (microfly 공식) ----
function stimulus(){const pz=telemetry.body?.pose()||{x:0,y:0,yaw:0};const s={visual_left:.45*.65,visual_right:.45*.65,olfactory_left:0,olfactory_right:0,mechanosensory_left:0,mechanosensory_right:0};
  const b=banana.visible?telemetry.banana:null;if(b){const dx=b.x-pz.x,dy=b.y-pz.y,bearing=Math.atan2(dy,dx)-pz.yaw;const st=.95*Math.exp(-Math.hypot(dx,dy)/1.6)*(.25+.75*(1+Math.cos(bearing))/2);let l=st*(.5+.5*Math.sin(bearing)),r=st*(.5-.5*Math.sin(bearing));if(telemetry.antenna==='noLeft')l=0;else if(telemetry.antenna==='swap')[l,r]=[r,l];s.olfactory_left=l;s.olfactory_right=r;}
  const t=touchStimulus(ENVS[currentEnv],pz,telemetry.body?.key==='duck'?.18:.35);s.mechanosensory_left=Math.max(s.mechanosensory_left,t.left);s.mechanosensory_right=Math.max(s.mechanosensory_right,t.right);
  telemetry.stimulus=s;return s;}
// ---- 뇌 워커 ----
const worker=new Worker(new URL('./brain-worker.js',import.meta.url),{type:'module'}); let brainView=null;
worker.onmessage=({data:m})=>{
  if(m.type==='progress'&&m.label==='뇌 배선'){$('prog').value=m.total?Math.round(100*m.got/m.total):0;$('progText').textContent=`뇌 배선 ${(m.got/1e6).toFixed(1)} / ${(m.total/1e6).toFixed(1)} MB`;}
  else if(m.type==='ready'){telemetry.neurons=m.neurons;telemetry.brainReady=true;$('brainStat').textContent=`뉴런 ${m.neurons.toLocaleString()} · 운동뉴런 ${m.motor}`;maybeStart();}
  else if(m.type==='activity'){telemetry.activity=m;if(brainView&&m.fireState)brainView.update(m.fireState);if(telemetry.brain==='fly'){telemetry.command=m.command;command(telemetry.cut?0:m.command.forward,telemetry.cut?0:m.command.turn);}}
  else if(m.type==='error'){fail(m.message);}
  bridge?.onWorker(m);const trial=trialRequests.get(m.requestId);if(trial){clearTimeout(trial.timer);trialRequests.delete(m.requestId);m.type==="error"?trial.reject(Error(m.message)):trial.resolve(m);}};
function fail(msg){telemetry.error=msg;paused=true;emergencyStop();worker.postMessage({type:'stop'});$('statusText').textContent='실험 중지됨';$('loading').hidden=false;$('loading').style.display='flex';$('loading').firstElementChild.textContent='오류: '+msg;bridge?.error(msg);}
worker.postMessage({type:'init',graphUrl:new URL(brainDir+'/connectome.bin.gz',location.href).href,metaUrl:new URL(brainDir+'/channels.json?v=3',location.href).href});
createBrainView($('brain'),{low:query.has('low'),dir:brainDir,autoRotate:true,shell:true,baseAlpha:.065,pointScale:1.1,groupGain:{0:1.2,1:1,2:.22,3:.9,4:1.3},channelColors:{olfactory_left:0xffb020,olfactory_right:0xffb020,ALPN_left:0xffd60a,ALPN_right:0xffd60a,descending_left:0xff7a3d,descending_right:0xff7a3d,motor_left:0xfff176,motor_right:0xfff176}}).then(v=>{brainView=v;}).catch(e=>fail('뇌 그림: '+e.message));
// ---- 몸 (전환 가능) ----
const FACTORY={go1:(s,x)=>createMjcfBody(GO1_CFG,scene,s,x),soccer_kit:(s,x,envKey)=>createSoccerKitBody(scene,s,envXml(ENVS[envKey])),duck:(s,x)=>createDuck(scene,s,x),g1:(s,x)=>createMjcfBody(G1_CFG,scene,s,x),bh:(s,x)=>createMjcfBody(BH_CFG,scene,s,x),t1:(s,x)=>createMjcfBody(T1_CFG,scene,s,x)};
let currentBody='go1', currentEnv='flat', envGroup=null;
placeBanana(1.2,0.6);
telemetry.env='flat';
let generation=0, paused=false;
function setJointBars(n){const box=$('joints');box.innerHTML='';for(let i=0;i<n;i++)box.appendChild(document.createElement('i'));box.style.gridTemplateColumns=`repeat(${n},1fr)`;$('jointLabel').textContent=`로봇 관절 ${n}개 (강화학습 정책이 매 0.02초 정하는 목표)`;}
async function switchBody(key,envKey=currentEnv){
  if(compareEmbed){key='duck';envKey='flat';}if(!Object.hasOwn(FACTORY,key))key='go1';if(telemetry.switching)return; telemetry.switching=true; const gen=++generation; currentBody=key; currentEnv=envKey; telemetry.env=envKey;
  for(const b of document.querySelectorAll('[data-env]'))b.setAttribute('aria-pressed',String(b.dataset.env===envKey)); $('envNote').textContent=ENVS[envKey].note;
  if(envGroup){scene.remove(envGroup);envGroup=null;} envGroup=envMeshes(ENVS[envKey]); scene.add(envGroup);
  for(const b of document.querySelectorAll('[data-body]'))b.setAttribute('aria-pressed',String(b.dataset.body===key));
  telemetry.bodyReady=false; $('loading').hidden=false; $('loading').style.display='flex'; $('loading').firstElementChild.textContent='몸을 바꾸는 중…'; $('prog').value=0; $('progText').textContent='';
  await stepping;
  if(telemetry.body){telemetry.body.dispose();telemetry.body=null;}
  clearTrail(); telemetry.collected=0;
  for(const b of document.querySelectorAll('[data-env]'))b.textContent=ENVS[b.dataset.env].name;
  try{
    await new Promise(r => requestAnimationFrame(r));
    const b=await FACTORY[key](t=>{$('loading').firstElementChild.textContent=t;},envXml(ENVS[envKey]),envKey);
    if(gen!==generation){b.dispose();return;}
    telemetry.body=b;adapter=new CommandAdapter(key,compareEmbed?candidateProfile('duck'):loadProfile(key,storage));motion.reset();syncProfileUI(); telemetry.bodyReady=true; setJointBars(b.info.joints); $('bodyStat').textContent=b.info.name; $('bodyInfo').textContent=`${b.info.model} · 정책 ${b.info.policy} · 관측 ${b.info.obs}개 → 관절 ${b.info.joints}개`;
    const p=b.pose(); banana.visible=true; const eb=ENVS[envKey].banana; if(eb)placeBanana(b.key==='duck'?Math.min(eb[0],1.5):eb[0],eb[1]); else placeBanana(p.x+1.4*Math.cos(p.yaw+.8),p.y+1.4*Math.sin(p.yaw+.8));
    camera.position.set(p.x+b.camDist*.75,b.camHeight+b.camDist*.55,-p.y+b.camDist*.75); controls.target.set(p.x,b.camHeight,-p.y);
    telemetry.switching=false; maybeStart(); if(telemetry.ready&&!compareEmbed)runBody(gen);
  }catch(e){telemetry.switching=false;fail((FACTORY[key]?key:'')+' 로봇: '+e.message);}
}
for(const b of document.querySelectorAll('[data-body]'))b.onclick=()=>switchBody(b.dataset.body);
for(const b of document.querySelectorAll('[data-env]'))b.onclick=()=>switchBody(currentBody,b.dataset.env);
function maybeStart(){if(telemetry.brainReady&&telemetry.bodyReady&&!telemetry.ready){telemetry.ready=true;$('dot').classList.add('live');worker.postMessage({type:'stimulus',value:stimulus()});if(!compareEmbed){worker.postMessage({type:'start'});runBody(generation);}else bridge?.ready();} if(telemetry.brainReady&&telemetry.bodyReady){$('loading').hidden=true;$('loading').style.display='none';}}
telemetry.brain='fly'; let customBrain=null; const t0=performance.now();
function pageBrainTick(){const st=telemetry.stimulus||{};const inp={smellL:st.olfactory_left||0,smellR:st.olfactory_right||0,touchL:st.mechanosensory_left||0,touchR:st.mechanosensory_right||0,t:(performance.now()-t0)/1000};
  let out={forward:0,turn:0};
  if(telemetry.brain==='rule')out=ruleBrain(inp);else if(telemetry.brain==='random')out=randomBrain(inp);else if(telemetry.brain==='custom'&&customBrain)out=customBrain(inp);
  if(out.error)$('brainMsg').textContent='내 두뇌 오류: '+out.error;
  telemetry.command=out; command(telemetry.cut?0:out.forward,telemetry.cut?0:out.turn);}
setInterval(()=>{if(!compareEmbed&&!paused&&telemetry.ready&&telemetry.bodyReady&&!telemetry.switching&&telemetry.body){worker.postMessage({type:'stimulus',value:stimulus()});if(telemetry.brain!=='fly')pageBrainTick();}},100);
function setBrain(key){if(compareEmbed)return;emergencyStop();telemetry.brain=key;for(const b of document.querySelectorAll('[data-brain]'))b.setAttribute('aria-pressed',String(b.dataset.brain===key));$('brainNote').textContent=BRAIN_DEFS[key].note;$('customBox').hidden=key!=='custom';$('brainMsg').textContent='';
  if(key==='custom'){try{customBrain=compileCustom($('customCode').value);$('brainMsg').textContent='내 두뇌를 끼웠습니다. 바나나를 놓아 보세요.';}catch(e){customBrain=null;$('brainMsg').textContent='코드 오류: '+e.message;}}
  telemetry.collected=0;}
for(const b of document.querySelectorAll('[data-brain]'))b.onclick=()=>setBrain(b.dataset.brain);
$('customCode').value=CUSTOM_TEMPLATE; $('customApply').onclick=()=>setBrain('custom');
// ---- 성적표: 지금 몸·지금 두뇌로 환경 5개 × N초, 바나나 수와 넘어짐 수 ----
let evalRun=null;
async function runEval(){if(evalRun)return; const secs=+$('evalSecs').value||30; const rows=[]; evalRun={cancel:false}; $('evalBtn').disabled=true; $('evalStop').hidden=false; const brainName=BRAIN_DEFS[telemetry.brain].name, bodyName=telemetry.body.info.name; const tbody=$('evalRows'); tbody.innerHTML='';
  for(const envKey of Object.keys(ENVS)){ if(evalRun.cancel)break; $('evalMsg').textContent=`${ENVS[envKey].name} 채점 중… (${secs}초)`;
    await switchBody(currentBody,envKey); while(!telemetry.ready||!telemetry.bodyReady||telemetry.switching)await new Promise(r=>setTimeout(r,100));
    telemetry.collected=0; let falls=0, prevFallen=false; const start=performance.now();
    while(performance.now()-start<secs*1000&&!evalRun.cancel){await new Promise(r=>setTimeout(r,200));const f=telemetry.body?.state().fallen;if(f&&!prevFallen)falls++;prevFallen=!!f;}
    const st=telemetry.body.state(); rows.push({env:ENVS[envKey].name,bananas:telemetry.collected,falls,dist:st.distance});
    const tr=document.createElement('tr');tr.innerHTML=`<td>${ENVS[envKey].name}</td><td>${telemetry.collected}</td><td>${falls}</td><td>${st.distance.toFixed(1)} m</td>`;tbody.appendChild(tr);}
  const total=rows.reduce((a,r)=>a+r.bananas,0), fallsT=rows.reduce((a,r)=>a+r.falls,0);
  $('evalMsg').textContent=evalRun.cancel?'채점을 멈췄습니다.':`끝. ${brainName} × ${bodyName}: 바나나 ${total}개 · 넘어짐 ${fallsT}회 (환경 ${rows.length}개 × ${secs}초)`;
  telemetry.lastEval={brain:brainName,body:bodyName,secs,rows,total,falls:fallsT}; evalRun=null; $('evalBtn').disabled=false; $('evalStop').hidden=true;}
$('evalBtn').onclick=runEval; $('evalStop').onclick=()=>{if(evalRun)evalRun.cancel=true;};
$('evalCopy').onclick=async()=>{const e=telemetry.lastEval;if(!e)return;const text=`두뇌 성적표 — ${e.brain} × ${e.body} (환경별 ${e.secs}초)\n`+e.rows.map(r=>`${r.env}: 바나나 ${r.bananas} · 넘어짐 ${r.falls} · ${r.dist.toFixed(1)}m`).join('\n')+`\n합계 바나나 ${e.total} · 넘어짐 ${e.falls}\n- L@SSEN AI`;try{await navigator.clipboard.writeText(text);$('evalMsg').textContent='성적표를 복사했습니다.';}catch{$('evalMsg').textContent=text;}};
// ---- 몸 제어 루프 (실시간 0.02초) ----
let activeLoopGeneration=-1;
async function runBody(gen){const b=telemetry.body; if(!b||activeLoopGeneration===gen)return;activeLoopGeneration=gen; let acc=0,prevT=performance.now();
  while(gen===generation&&telemetry.body===b&&!telemetry.error){try{const now=performance.now();acc+=Math.min(.1,(now-prevT)/1000);prevT=now;
    if(manualEval){acc=0;await new Promise(r=>setTimeout(r,4));continue;}if(!paused){let n=0;while(acc>=b.ctrlDt&&n<4&&gen===generation){await physicsStep();acc-=b.ctrlDt;n++;} if(n===4)acc=0;} else acc=0;
    const st=b.state(); if(st.fallen&&!telemetry.fallenAt)telemetry.fallenAt=now; if(!st.fallen)telemetry.fallenAt=0;
    if(!paused&&telemetry.fallenAt&&now-telemetry.fallenAt>1500){telemetry.fallenAt=0;b.reset();emergencyStop();motion.reposition();clearTrail();}
    const bn=telemetry.banana; const reach=b.key==='duck'?.18:.35; if(bn&&banana.visible&&Math.hypot(bn.x-st.x,bn.y-st.y)<reach){telemetry.collected++;let p;for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,d=(b.key==='duck'?.7:1.6)+Math.random()*(b.key==='duck'?.5:1.6);p={x:st.x+d*Math.cos(a),y:st.y+d*Math.sin(a)};if(Math.hypot(p.x,p.y)<7)break;}placeBanana(p.x,p.y);}
    await new Promise(r=>setTimeout(r,4));}catch(e){fail(e.message);break;}}}
switchBody(compareEmbed?'duck':(Object.hasOwn(FACTORY,query.get('body'))?query.get('body'):'go1'));
// ---- 렌더 + 수치 ----
$('reset').onclick=async()=>{if(compareEmbed||telemetry.switching)return;const wasPaused=paused;paused=true;worker.postMessage({type:'stop'});await stepping;telemetry.body?.reset();emergencyStop();motion.reset();clearTrail();worker.postMessage({type:'reset'});telemetry.activity=null;telemetry.cut=false;telemetry.collected=0;telemetry.fallenAt=0;$('cut').setAttribute('aria-pressed','false');$('cut').textContent='시냅스 끄기';paused=wasPaused;if(!paused)worker.postMessage({type:'start'});};
$('clear').onclick=()=>{banana.visible=false;};
$('pause').onclick=()=>{paused=!paused;emergencyStop();$('pause').textContent=paused?'재개':'일시정지';worker.postMessage({type:paused?'stop':'start'});};
$('cut').onclick=()=>{telemetry.cut=!telemetry.cut;emergencyStop();$('cut').setAttribute('aria-pressed',String(telemetry.cut));$('cut').textContent=telemetry.cut?'시냅스 켜기':'시냅스 끄기';worker.postMessage({type:'cut',value:telemetry.cut});};
for(const b of document.querySelectorAll('[data-antenna]'))b.onclick=()=>{for(const o of document.querySelectorAll('[data-antenna]'))o.setAttribute('aria-pressed',String(o===b));telemetry.antenna=b.dataset.antenna;};
for(const b of document.querySelectorAll('[data-scent]'))b.onclick=()=>{const p=telemetry.body?.pose();if(!p)return;const side=+b.dataset.scent,a=p.yaw+side*1.0;banana.visible=true;placeBanana(p.x+1.4*Math.cos(a),p.y+1.4*Math.sin(a));};
let follow=true; $('follow').onclick=()=>{follow=!follow;$('follow').setAttribute('aria-pressed',String(follow));};
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'0.00', pct=v=>(100*(v||0)).toFixed(v>.001?1:2);
let lastRender=performance.now();
function render(){requestAnimationFrame(render);const now=performance.now(),rdt=Math.min(.05,(now-lastRender)/1000);lastRender=now;const b=telemetry.body;
if(b){const st=b.state();
    if(follow){const target=new THREE.Vector3(st.x,b.camHeight??.25,-st.y);const before=controls.target.clone();controls.target.lerp(target,.08);camera.position.add(controls.target.clone().sub(before));}
    updateTrail(st.x,st.y);
    const a=telemetry.activity||{},s=telemetry.stimulus||{};
    $('fIn').textContent=`${fmt(s.olfactory_left)} · ${fmt(s.olfactory_right)}`;$('fTouch').textContent=`${fmt(s.mechanosensory_left)} · ${fmt(s.mechanosensory_right)}`;$('fAL').textContent=`${pct(a.scentLeft)}% · ${pct(a.scentRight)}%`;$('fDN').textContent=`${(100*(((a.left||0)+(a.right||0))/2)).toFixed(2)}%`;$('fMot').textContent=`${(100*(a.motorLeft||0)).toFixed(2)} · ${(100*(a.motorRight||0)).toFixed(2)}%`;
    $('fCmd').textContent=`${fmt(st.cmd[0])} m/s · ${fmt(st.cmd[2])} rad/s`;$('fDist').textContent=`${fmt(motion.distance)} m`;
    $('actualForward').textContent=fmt(motion.forward)+' m/s';$('actualTurn').textContent=fmt(motion.turn)+' rad/s';$('spinState').textContent=motion.spinning?'연속 회전 감지 · 설정 확인':'정상 범위';$('fPol').textContent=st.policyCalls.toLocaleString();$('fSpk').textContent=(a.spikes||0).toLocaleString();
    $('count').textContent=telemetry.collected?`목표 도달 ${telemetry.collected}회`:'';$('statusText').textContent=paused?'일시정지':st.fallen?'넘어짐 · 1.5초 뒤 자동 리셋':(telemetry.cut?'시냅스 꺼짐 · 정지':'작동 중');
    const bars=$('joints');for(let i=0;i<bars.children.length&&i<st.joints.length;i++){bars.children[i].style.height=Math.min(100,4+Math.abs(st.joints[i])*70)+'%';}
    // Keep the target area still so reset pulses cannot look like flicker.
  }
  controls.update();renderer.render(scene,camera);brainView?.render();

}
render();
// Asset capture uses the real model bounds; normal simulator cameras stay unchanged.
if(query.has('capture'))window.capturePreview=async()=>{
 paused=true;worker.postMessage({type:'stop'});await stepping;telemetry.body.reset();emergencyStop();
 const root=telemetry.body.root;root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const direction=new THREE.Vector3(.85,.55,1).normalize();
 const distance=Math.max(size.y,size.x/camera.aspect,size.z/camera.aspect)*2.2;
 controls.minDistance=.05;controls.enableDamping=false;controls.target.copy(center);
 camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);controls.update();
 banana.visible=false;trail.visible=false;follow=false;renderer.setPixelRatio(2);renderer.render(scene,camera);
 return {center:center.toArray(),size:size.toArray()};
};
function syncProfileUI(){const p=adapter?.profile;$('profilePanel').hidden=!p||compareEmbed;if(!p)return;for(const [id,field,unit] of [['profileVx','maxForward',' m/s'],['profileWz','maxTurn',' rad/s'],['profileTau','smoothingTau','초']]){$(id).max=field==='smoothingTau'?1:BASELINES[currentBody][field];$(id).value=p[field];$(id+'Value').textContent=p[field].toFixed(2)+unit;} $('profileName').textContent=telemetry.body.info.name+' 제어 설정';$('profileState').textContent=p.source==='baseline'?'기존 설정':p.source==='measured'?'현재 평지 시험에서 우수':p.source==='user'?'사용자 설정':'몸별 후보 · 검증 전';}
for(const [id,unit] of [['profileVx',' m/s'],['profileWz',' rad/s'],['profileTau','초']])$(id).oninput=()=>$(id+'Value').textContent=(+$(id).value).toFixed(2)+unit;
function applyProfile(p){if(!adapter)return;paused=true;worker.postMessage({type:'stop'});emergencyStop();adapter=new CommandAdapter(currentBody,validateProfile(currentBody,p));try{storage?.setItem('flylab.profile.v1.'+currentBody,JSON.stringify(adapter.profile));$('profileMsg').textContent='설정을 적용했습니다. 재개 버튼으로 실험을 이어가세요.';}catch{$('profileMsg').textContent='설정은 적용했지만 브라우저에 저장하지 못했습니다.';}$('pause').textContent='재개';syncProfileUI();}
$('profileApply').onclick=()=>{if(adapter)applyProfile({...adapter.profile,source:'user',maxForward:+$('profileVx').value,maxTurn:+$('profileWz').value,smoothingTau:+$('profileTau').value});};
$('profileCandidate').onclick=()=>adapter&&applyProfile(candidateProfile(currentBody));$('profileBaseline').onclick=()=>adapter&&applyProfile(baselineProfile(currentBody));$('retry').onclick=()=>location.reload();
if(compareEmbed){bridge=createCompareBridge({worker,brainKey,neurons:()=>telemetry.neurons,ready:()=>telemetry.brainReady&&telemetry.bodyReady&&!telemetry.error,
 reset:()=>{telemetry.body.reset();emergencyStop();motion.reset();clearTrail();telemetry.collected=0;telemetry.cut=false;telemetry.activity=null;},
 target:p=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=5&&Math.abs(p.y)<=5){const old=telemetry.banana;if(!banana.visible||p.x!==old.x||p.y!==old.y){motion.history=[];telemetry.collected=0;telemetry.arrival=null;}banana.visible=true;placeBanana(p.x,p.y);}else banana.visible=false;},stimulus,
 step:async({holdAfterArrival=false}={})=>{if(holdAfterArrival&&telemetry.collected)emergencyStop();await physicsStep();const st=telemetry.body.state();if(banana.visible&&Math.hypot(st.x-telemetry.banana.x,st.y-telemetry.banana.y)<.18&&telemetry.collected===0){telemetry.collected=1;telemetry.arrival=motion.time;}},
 stats:()=>({time:motion.time,distance:motion.distance,forward:motion.forward,turn:motion.turn,command:adapter.output,spinning:motion.spinning,falls:motion.falls,collected:telemetry.collected,arrival:telemetry.collected?telemetry.arrival:null,neurons:telemetry.neurons,brainTick:telemetry.activity?.tick??0,fallen:telemetry.body.state().fallen})});}

$('profileEvalStop').onclick=()=>{if(profileTrial)profileTrial.cancel=true;};
$('profileEval').onclick=async()=>{
 if(compareEmbed||profileTrial||!adapter||telemetry.switching||!telemetry.bodyReady||!telemetry.brainReady||evalRun)return;
 const key=currentBody,seconds=Math.max(1,Math.min(30,+$('profileEvalSeconds').value||30)),previousProfile={...adapter.profile},previousBrain=telemetry.brain,previousAntenna=telemetry.antenna;
 profileTrial={cancel:false};paused=true;manualEval=true;worker.postMessage({type:'stop'});await stepping;
 const controls=[...document.querySelectorAll('main button,main input,main textarea')].filter(el=>el.id!=='profileEvalStop');const disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('profileEvalStop').hidden=false;$('profileRanking').textContent='';
 try{await switchBody(key,'flat');telemetry.brain='fly';telemetry.cut=false;telemetry.antenna='normal';
  const result=await evaluateProfiles(key,{cancelled:()=>profileTrial.cancel,progress:text=>$('profileEvalMsg').textContent=text,
   reset:async(profile,seed,target)=>{await stepping;telemetry.body.reset();adapter=new CommandAdapter(key,profile);motion.reset();clearTrail();telemetry.collected=0;banana.visible=true;placeBanana(target.x,target.y);await trialWorker('reset',{seed});},
   step:async()=>{await trialWorker('step',{stimulus:stimulus()});for(let i=0;i<5;i++)await physicsStep();},pose:()=>telemetry.body.pose(),metrics:()=>motion,reach:()=>key==='duck'?.18:.35},{seconds});
  telemetry.lastProfileEvaluation=result;
  if(result.cancelled){$('profileEvalMsg').textContent='시험을 중단했습니다. 이전 프로필로 복원합니다.';adapter=new CommandAdapter(key,previousProfile);}
  else{const best=result.rows[0];const labels=['기존 한도','몸별 후보','회전 한도 70%'];$('profileRanking').textContent=result.rows.map(row=>`${labels[row.index]}: 도달 ${row.successes}/5 · 넘어짐 ${row.falls}회 · 평균 목표 접근 ${row.progress.toFixed(2)}m`).join('\n');
   applyProfile({...best.profile,source:'measured'});try{storage?.setItem('flylab.profile-evaluation.v1.'+key,JSON.stringify(result));}catch{}
   $('profileEvalMsg').textContent=`현재 평지 시험에서 ${labels[best.index]}를 적용했습니다. 다른 목표·환경에서 재검증하세요.`;
  }
 }catch(error){adapter=new CommandAdapter(key,previousProfile);$('profileEvalMsg').textContent='시험 실패: '+error.message;}
 finally{await stepping;telemetry.body?.reset();emergencyStop();motion.reset();clearTrail();worker.postMessage({type:'reset'});telemetry.brain=previousBrain;telemetry.antenna=previousAntenna;telemetry.cut=false;$("cut").setAttribute("aria-pressed","false");$("cut").textContent="시냅스 끄기";telemetry.activity=null;manualEval=false;profileTrial=null;paused=true;$('pause').textContent='재개';controls.forEach((el,i)=>el.disabled=disabled[i]);$('profileEvalStop').hidden=true;syncProfileUI();}
};
