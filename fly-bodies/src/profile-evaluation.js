import {baselineProfile,candidateProfile} from './robot-profiles.js';
export function evaluationCandidates(key){const candidate=candidateProfile(key);return [baselineProfile(key),candidate,{...candidate,source:'candidate',maxTurn:Math.max(.05,candidate.maxTurn*.7)}];}
// Rank measured behavior, not distance walked in circles. Failed/fallen trials
// count as failures; tie breakers are target progress then rotation magnitude.
export function rankProfiles(rows){return rows.map(row=>({...row,successes:row.trials.filter(t=>t.arrival!=null).length,falls:row.trials.reduce((n,t)=>n+t.falls,0),progress:row.trials.reduce((n,t)=>n+t.progress,0)/row.trials.length,rotation:row.trials.reduce((n,t)=>n+t.rotation,0)/row.trials.length})).sort((a,b)=>a.falls-b.falls||b.successes-a.successes||b.progress-a.progress||a.rotation-b.rotation);}
export async function evaluateProfiles(key,hooks,{seconds=30,seeds=[23,24,25,26,27]}={}){
 const rows=[],targets=[{x:1.2,y:0},{x:1,y:.8},{x:1,y:-.8}];
 const candidates=evaluationCandidates(key);
 for(let i=0;i<candidates.length;i++){const trials=[];for(let j=0;j<seeds.length;j++){
  if(hooks.cancelled())return {cancelled:true,rows};const target=targets[j%targets.length];hooks.progress(`설정 ${i+1}/${candidates.length} · 시험 ${j+1}/${seeds.length} · ${seconds}초 시뮬레이션`);
  await hooks.reset(candidates[i],seeds[j],target);const initial=hooks.pose();const initialDistance=Math.hypot(initial.x-target.x,initial.y-target.y);let arrival=null,rotation=0,spinningTicks=0;
  for(let tick=0;tick<seconds*10;tick++){if(hooks.cancelled())return {cancelled:true,rows};await hooks.step();const m=hooks.metrics(),p=hooks.pose();rotation+=Math.abs(m.turn)*.1;if(m.spinning)spinningTicks++;if(arrival==null&&Math.hypot(p.x-target.x,p.y-target.y)<hooks.reach())arrival=m.time;if(m.falls||arrival!=null)break;if(tick%10===0)await new Promise(resolve=>setTimeout(resolve,0));}
  const p=hooks.pose(),m=hooks.metrics();trials.push({seed:seeds[j],target,arrival,falls:m.falls,time:m.time,progress:initialDistance-Math.hypot(p.x-target.x,p.y-target.y),rotation,spinningTicks});
 }rows.push({index:i,profile:candidates[i],trials});}
 return {cancelled:false,body:key,seconds,seeds,brain:'male',dataVersion:'MaleCNS v1.0',profileVersion:'candidate-2',rows:rankProfiles(rows)};
}

