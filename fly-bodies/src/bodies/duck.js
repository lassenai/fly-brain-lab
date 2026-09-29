// 마이크로덕(Pollen Robotics, Apache-2.0)을 "몸" 인터페이스로 감싼다. 걷기 정책은 공식 BEST_alpha_walking.onnx.
import {createDuckSim} from './duck-sim.js';
export async function createDuck(scene,onStatus=()=>{},envXml=''){
  const sim=await createDuckSim(onStatus,()=>{},envXml);
  scene.add(sim.rig.placer);
  let cmd={forward:0,turn:0}, distance=0, prev=null;
  const pose=()=>{const s=sim.state();return {x:s.x,y:s.y,z:s.height,yaw:s.yaw};};
  return {key:'duck',reset:()=>{sim.reset();distance=0;prev=null;},
    controlStep:async()=>{await sim.step({forward:cmd.forward,turn:cmd.turn});const p=pose();if(prev)distance+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;},
    setCommand:(forward,turn)=>{const targetFwd=Math.max(0,Math.min(0.35,forward>0.01?Math.max(0.18,forward):0));cmd.forward+=0.4*(targetFwd-cmd.forward);cmd.turn+=0.4*(turn-cmd.turn);},pose,root:sim.rig.placer,dispose:()=>{scene.remove(sim.rig.placer);sim.free?.();},ctrlDt:.02,camDist:1.4,camHeight:.12,
    state:()=>{const s=sim.state();return {steps:s.steps,policyCalls:s.policyCalls,fallen:s.fallen,distance,cmd:[cmd.forward,0,cmd.turn],joints:s.joints.map((v,i)=>s.targets[i]-v),...pose()};},
    info:{name:'마이크로덕 (Pollen Robotics)',joints:14,policy:'Pollen Robotics BEST_alpha_walking.onnx (Apache-2.0)',model:'MicroDuck simulator (Apache-2.0)',obs:61}};
}
