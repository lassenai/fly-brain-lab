export class MotionMetrics{
 constructor(){this.reset();}
 reset(){this.previous=null;this.distance=0;this.falls=0;this.fallen=false;this.time=0;this.history=[];this.forward=0;this.turn=0;this.spinning=false;}
 update(p,dt,target,fallen=false){this.time+=dt;if(fallen&&!this.fallen)this.falls++;this.fallen=fallen;
 if(this.previous){const dx=p.x-this.previous.x,dy=p.y-this.previous.y,dyaw=Math.atan2(Math.sin(p.yaw-this.previous.yaw),Math.cos(p.yaw-this.previous.yaw));this.distance+=Math.hypot(dx,dy);this.forward=(dx*Math.cos(this.previous.yaw)+dy*Math.sin(this.previous.yaw))/dt;this.turn=dyaw/dt;this.history.push({time:this.time,yaw:Math.abs(dyaw),target:target?Math.hypot(target.x-p.x,target.y-p.y):null});}
 this.previous={...p};while(this.history.length&&this.history[0].time<this.time-5)this.history.shift();const first=this.history[0],last=this.history.at(-1);this.spinning=!!(first&&last&&last.time-first.time>=4.8&&first.target!=null&&last.target!=null&&this.history.reduce((n,s)=>n+s.yaw,0)>=2*Math.PI&&first.target-last.target<.1);return this;}
 // A reset must not be counted as locomotion or yaw; retain the run totals.
 reposition(){this.previous=null;this.history=[];this.forward=0;this.turn=0;this.spinning=false;this.fallen=false;}
}
