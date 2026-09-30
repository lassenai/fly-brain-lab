import test from 'node:test';
import assert from 'node:assert/strict';
import {getTerrainHeight} from '../src/envs.js';
import {CommandAdapter,candidateProfile} from '../src/robot-profiles.js';
test('inclined ramp top follows the actual quaternion and thickness',()=>{
 const angle=10*Math.PI/180;
 assert.ok(Math.abs(getTerrainHeight(2.6,0,'slope')-(.21+.2*Math.tan(angle)+.05/Math.cos(angle)))<1e-8);
 assert.equal(getTerrainHeight(2.6,2,'slope'),0);
});
test('stairs use the surface of each solid step',()=>{
 for(const [x,h] of [[1.6,.05],[1.96,.1],[2.32,.15],[3,.15]])assert.ok(Math.abs(getTerrainHeight(x,0,'stairs')-h)<1e-8);
 assert.equal(getTerrainHeight(0,0,'stairs'),0);
});
test('duck candidate retains walking drive with the observed FlyWire command',()=>{
 const adapter=new CommandAdapter('duck',candidateProfile('duck'));adapter.setCommand(.22234,.60207);
 for(let i=0;i<100;i++)adapter.step(.02);
 assert.ok(adapter.output.forward>.25);assert.ok(adapter.output.forward<=.35);
});

