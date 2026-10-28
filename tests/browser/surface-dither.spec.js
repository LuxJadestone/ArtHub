import {test,expect} from '@playwright/test';

async function ready(page){
  await page.goto('/techniques/surface-dither.html');
  await page.waitForFunction(()=>document.querySelector('#surface-canvas')?.renderer);
  await page.locator('#animation').selectOption('off');
}
async function snapshot(page){
  return page.locator('#surface-canvas').evaluate(c=>{
    const r=c.renderer;r.render();const gl=r.gl,bytes=new Uint8Array(c.width*c.height*4);
    gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    let hash=2166136261,dark=0;
    for(let i=0;i<bytes.length;i+=4){hash=Math.imul(hash^bytes[i],16777619);if(bytes[i]<128)dark++;}
    return{hash,error:gl.getError(),dark:dark/(c.width*c.height),layers:r.patternLayers};
  });
}

test('three modes, parameters and texture loading affect actual rendered pixels',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  const stable=await snapshot(page);expect(stable.layers).toBe(16);expect(stable.dark).toBeGreaterThan(.03);expect(stable.dark).toBeLessThan(.98);expect(stable.error).toBe(0);
  await page.locator('#mode').selectOption('1');const screen=await snapshot(page);expect(screen.hash).not.toBe(stable.hash);await expect(page.locator('#quantize')).toBeDisabled();
  await page.locator('#mode').selectOption('2');const fixed=await snapshot(page);expect(fixed.hash).not.toBe(screen.hash);
  await page.locator('#mode').selectOption('0');expect((await snapshot(page)).hash).toBe(stable.hash);
  await page.locator('#scale').fill('7.5');await page.locator('#scale').dispatchEvent('input');expect((await snapshot(page)).hash).not.toBe(stable.hash);
  await page.locator('#inverse').check();expect((await snapshot(page)).hash).not.toBe(stable.hash);
  const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('surface-stable-dither.png');
  expect(errors).toEqual([]);
});

test('fractal mode holds approximate dot area while fixed surface dots shrink with distance',async({page})=>{
  await ready(page);
  const measure=async(mode,distance)=>page.locator('#surface-canvas').evaluate((c,{mode,distance})=>{
    const r=c.renderer;r.time=0;r.setConfig({mode,scene:1,animation:'off',distance,yaw:0,pitch:0,exposure:.55,radial:false,scale:7});
    const w=300,h=200,pixels=new Uint8Array(w*h*4),gl=r.gl;gl.readPixels(210,140,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const seen=new Uint8Array(w*h),sizes=[];
    for(let i=0;i<w*h;i++){
      if(seen[i]||pixels[i*4]<140)continue;
      const queue=[i];seen[i]=1;let count=0,boundary=false;
      for(let q=0;q<queue.length;q++){
        const n=queue[q],x=n%w,y=Math.floor(n/w);count++;
        if(x===0||x===w-1||y===0||y===h-1)boundary=true;
        for(const next of [n-1,n+1,n-w,n+w]){
          if(next<0||next>=w*h||seen[next]||pixels[next*4]<140||Math.abs(next%w-x)>1)continue;
          seen[next]=1;queue.push(next);
        }
      }
      if(!boundary&&count>1&&count<1000)sizes.push(count);
    }
    sizes.sort((a,b)=>a-b);return{median:sizes[Math.floor(sizes.length/2)],count:sizes.length,error:gl.getError()};
  },{mode,distance});
  const near=await measure(0,4),far=await measure(0,10),fixedNear=await measure(2,4),fixedFar=await measure(2,10);
  for(const result of [near,far,fixedNear,fixedFar]){expect(result.count).toBeGreaterThan(20);expect(result.error).toBe(0);}
  expect(far.median/near.median).toBeGreaterThan(.75);expect(far.median/near.median).toBeLessThan(1.3);
  expect(fixedNear.median/fixedFar.median).toBeGreaterThan(3.3);
});

test('camera input and reduced-motion preference work',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await expect(page.locator('#animation')).toHaveValue('off');
  const canvas=page.locator('#surface-canvas'),before=await canvas.evaluate(c=>c.renderer.config.yaw),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2);await page.mouse.up();
  expect(await canvas.evaluate(c=>c.renderer.config.yaw)).not.toBe(before);
  const distance=await canvas.evaluate(c=>c.renderer.config.distance);await page.mouse.wheel(0,80);
  await expect.poll(()=>canvas.evaluate(c=>c.renderer.config.distance)).toBeGreaterThan(distance);
});

test('missing pattern data reports a visible error instead of a false ready state',async({page})=>{
  await page.route('**/pattern.png',route=>route.abort());await page.goto('/techniques/surface-dither.html');
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#export')).toBeDisabled();
});
