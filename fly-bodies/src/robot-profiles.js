// Candidate command profiles; policy inputs, action scales and gait stay unchanged.
export const PROFILE_VERSION='candidate-3';
export const BASELINES={go1:{maxForward:.7,maxTurn:1.5},g1:{maxForward:.6,maxTurn:1},bh:{maxForward:.6,maxTurn:1},t1:{maxForward:.6,maxTurn:1},duck:{maxForward:.35,maxTurn:.75},soccer_kit:{maxForward:.288,maxTurn:.7}};
const limits={go1:[.6,.9,.15],g1:[.45,1,.15],bh:[.4,.35,.25],t1:[.4,.35,.25],duck:[.35,.45,.2],soccer_kit:[.288,.5,.1]};
export function candidateProfile(key){const v=limits[key];if(!v)throw Error('알 수 없는 로봇');return {schemaVersion:1,version:PROFILE_VERSION,source:'candidate',maxForward:v[0],maxTurn:v[1],smoothingTau:v[2],turnDeadband:key==='g1'?.06:.04,maxTurnAcceleration:2,turnSlowdown:({g1:.3,bh:.5,t1:.5,duck:.25,go1:.35,soccer_kit:.2})[key]};}
export function baselineProfile(key){return {...candidateProfile(key),...BASELINES[key],source:'baseline',smoothingTau:0,turnDeadband:0,maxTurnAcceleration:100,turnSlowdown:0};}
export function validateProfile(key,p){if(!BASELINES[key]||!p||p.schemaVersion!==1||p.version!==PROFILE_VERSION)throw Error('설정 버전 오류');const out={...candidateProfile(key),source:['baseline','candidate','measured'].includes(p.source)?p.source:'user'};for(const [field,min,max] of [['maxForward',.05,BASELINES[key].maxForward],['maxTurn',.05,BASELINES[key].maxTurn],['smoothingTau',0,1],['turnDeadband',0,.3],['maxTurnAcceleration',.1,100],['turnSlowdown',0,.8]]){const value=field==='turnSlowdown'&&p[field]==null?0:p[field];if(!Number.isFinite(value)||value<min||value>max)throw Error('설정 범위 오류: '+field);out[field]=value;}return out;}
export function loadProfile(key,storage){try{const value=storage?.getItem('flylab.profile.v1.'+key);if(!value)return baselineProfile(key);const saved=JSON.parse(value);if(saved.version==='candidate-2')saved.version=PROFILE_VERSION;return validateProfile(key,saved);}catch{return baselineProfile(key);}}
export class CommandAdapter{
 constructor(key,profile=candidateProfile(key)){this.key=key;this.profile=validateProfile(key,profile);this.reset();}
 reset(){this.raw={forward:0,turn:0};this.output={forward:0,turn:0};}
 setCommand(forward,turn){if(![forward,turn].every(Number.isFinite)){this.reset();return;}this.raw={forward,turn};}
 step(dt){if(!Number.isFinite(dt)||dt<=0)throw Error('제어 시간 오류');const p=this.profile;let f=Math.max(0,Math.min(1,this.raw.forward/.24))*p.maxForward;
 // Duck policy was trained with a minimum walking command; soccer uses its existing 1.2 multiplier.
 if(this.key==='duck')f=this.raw.forward>.01?Math.min(p.maxForward,Math.max(.18,p.source==='baseline'?this.raw.forward:f)):0;
 let t=Math.max(-1,Math.min(1,this.raw.turn/.7));t=Math.abs(t)<=p.turnDeadband?0:Math.sign(t)*(Math.abs(t)-p.turnDeadband)/(1-p.turnDeadband);f*=1-p.turnSlowdown*Math.abs(t);t*=p.maxTurn;
 const alpha=p.smoothingTau?1-Math.exp(-dt/p.smoothingTau):1;this.output.forward+=alpha*(f-this.output.forward);const change=alpha*(t-this.output.turn),max=p.maxTurnAcceleration*dt;this.output.turn+=Math.max(-max,Math.min(max,change));return {...this.output};}
}
