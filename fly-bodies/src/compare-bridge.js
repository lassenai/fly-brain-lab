// Compare embeds are controlled by one same-origin coordinator. One neural batch
// and five 20 ms physics steps constitute a single acknowledged 100 ms tick.
export function createCompareBridge(hooks){
 let request=0,queue=Promise.resolve(),lastSequence=0,runId=null;const pending=new Map();
 const post=data=>window.parent.postMessage({flylab:data},location.origin);
 function workerRequest(type,data={}){return new Promise((resolve,reject)=>{const requestId='compare-'+(++request);const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('뇌 계산 응답 시간 초과'));},15000);pending.set(requestId,{resolve,reject,timer});hooks.worker.postMessage({type,requestId,...data});});}
 function onWorker(m){const entry=pending.get(m.requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(m.requestId);m.type==='error'?entry.reject(Error(m.message)):entry.resolve(m);}
 function ready(){post({type:'ready',brain:hooks.brainKey,body:'duck',profile:'candidate-3',neurons:hooks.neurons()});}
 async function handle(m){if(!hooks.ready())throw Error('몸과 뇌를 준비 중입니다.');if(m.type==='reset'){runId=m.runId;lastSequence=0;hooks.reset();await workerRequest('reset');hooks.target(m.target);}
 else if(m.type==='step'){if(m.runId!==runId||m.sequence!==lastSequence+1)throw Error('비교 명령 순서 오류');hooks.target(m.target);await workerRequest('step',{stimulus:hooks.stimulus()});for(let i=0;i<5;i++){const start=performance.now();await hooks.step({holdAfterArrival:!!m.holdAfterArrival});await new Promise(resolve=>setTimeout(resolve,Math.max(0,20-(performance.now()-start))));}lastSequence=m.sequence;}
 else throw Error('허용되지 않은 비교 명령');post({type:'ack',requestId:m.requestId,runId,sequence:lastSequence,brain:hooks.brainKey,body:'duck',profile:'candidate-3',...hooks.stats()});}
 window.addEventListener('message',e=>{if(window.parent===window||e.source!==window.parent||e.origin!==location.origin)return;const m=e.data?.flylab;if(!m||!['hello','reset','step'].includes(m.type))return;if(m.type==='hello'){if(hooks.ready())ready();return;}queue=queue.then(()=>handle(m)).catch(error=>{post({type:'error',requestId:m.requestId,brain:hooks.brainKey,message:error.message});});});
 return {onWorker,ready,error:message=>post({type:'error',brain:hooks.brainKey,message})};
}
