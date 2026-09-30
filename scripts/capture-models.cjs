const {chromium}=require('../fly-bodies/node_modules/playwright');
const fs=require('fs');
async function main(){
 fs.mkdirSync('assets/previews',{recursive:true});fs.mkdirSync('fly-bodies/public/thumbnails',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:8770/fly-bodies/dist/');
 await page.waitForFunction(()=>window.bodies?.ready&&bodies.bodyReady&&!bodies.switching,null,{timeout:60000});await page.locator('#pause').click();
 for(const key of (process.argv.includes('--previews-only')?[]:['go1','soccer_kit','duck','g1','bh','t1'])){
  await page.locator(`[data-body="${key}"]`).click();
  await page.waitForFunction(k=>bodies.body?.key===k&&bodies.bodyReady&&!bodies.switching,key,{timeout:60000});
  await page.locator('#reset').click();await page.waitForTimeout(300);
  const box=await page.locator('#world').boundingBox();
  await page.screenshot({path:`fly-bodies/public/thumbnails/${key}.png`,clip:{x:box.x+box.width*.2,y:box.y+box.height*.15,width:box.width*.6,height:box.height*.7}});
  console.log('Captured '+key);
 }
 fs.copyFileSync('fly-bodies/public/thumbnails/go1.png','assets/previews/robots.png');
 await page.goto('http://127.0.0.1:8770/fly-walk/');await page.waitForFunction(()=>window.flywalk?.ready,null,{timeout:60000});await page.locator('#pause').click();await page.locator('#reset').click();await page.waitForTimeout(200);await page.locator('.canvas-container').first().screenshot({path:'assets/previews/fly.png'});
 await page.goto('http://127.0.0.1:8770/fly-duck/dist/compare.html');await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:60000});
 const duck=page.frames().find(f=>f.url().includes('brain=female'));await duck.locator('#world').screenshot({path:'assets/previews/compare.png'});
 await browser.close();console.log('Captured six models and three experiment previews.');
}
main().catch(e=>{console.error(e);process.exit(1)});


