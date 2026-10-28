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
  const measure=async(mode,distance,samples=1)=>page.locator('#surface-canvas').evaluate((c,{mode,distance,samples})=>{
    const r=c.renderer;r.time=0;r.setConfig({mode,samples,scene:1,animation:'off',distance,yaw:0,pitch:0,exposure:.55,radial:false,scale:7,referenceHeight:480,fov:45});
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
  },{mode,distance,samples});
  const near=await measure(0,4),far=await measure(0,10),fixedNear=await measure(2,4),fixedFar=await measure(2,10);
  for(const result of [near,far,fixedNear,fixedFar]){expect(result.count).toBeGreaterThan(20);expect(result.error).toBe(0);}
  expect(far.median/near.median).toBeGreaterThan(.75);expect(far.median/near.median).toBeLessThan(1.3);
  expect(fixedNear.median/fixedFar.median).toBeGreaterThan(3.3);
  const sampledNear=await measure(0,4,2);
  expect(sampledNear.median/near.median).toBeGreaterThan(.8);expect(sampledNear.median/near.median).toBeLessThan(1.2);
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
  await page.route('**/pattern.bin',route=>route.abort());await page.goto('/techniques/surface-dither.html');
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#export')).toBeDisabled();
});


test('reference preset keeps resolution calibration, aspect ratio and reset separate from legacy',async({page})=>{
  await page.goto('/techniques/surface-dither.html?preset=reference');
  await page.waitForFunction(()=>document.querySelector('#surface-canvas')?.renderer);
  const canvas=page.locator('#surface-canvas');
  await expect(page.locator('#preset')).toHaveValue('reference');
  await expect(page.locator('#animation')).toHaveValue('off');
  const calibrated=await canvas.evaluate(c=>{
    const r=c.renderer;r.render();
    return {size:[c.width,c.height],display:c.getBoundingClientRect().width,dpr:devicePixelRatio,scene:r.config.scene,scale:r.gl.getUniform(r.program,r.uniforms.Scale),error:r.gl.getError(),ratio:c.clientWidth/c.clientHeight};
  });
  expect(calibrated.size[0]).toBe(Math.round(calibrated.display*calibrated.dpr));expect(calibrated.scene).toBe(0);
  expect(calibrated.scale).toBeCloseTo(5.9+Math.log2(calibrated.size[1]*2/1080));expect(calibrated.error).toBe(0);
  expect(calibrated.ratio).toBeCloseTo(16/9,2);
  expect((await snapshot(page)).dark).toBeGreaterThan(.05);
  await page.locator('#scale').fill('7');await page.locator('#scale').dispatchEvent('input');
  await page.locator('#reset').click();await expect(page.locator('#scale')).toHaveValue('5.9');
  await page.locator('#preset').selectOption('legacy');
  await expect(page).not.toHaveURL(/preset=reference/);
  expect(await canvas.evaluate(c=>[c.width,c.height,c.renderer.config.scene,c.renderer.config.scale])).toEqual([720,480,2,6.2]);
  await page.locator('#preset').selectOption('reference');await expect(page).toHaveURL(/preset=reference/);
  expect((await snapshot(page)).error).toBe(0);
});


test('native pixels track DPR, resize and fullscreen; supersampling resolves to the canvas',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:2});
  const page=await context.newPage();await page.goto('/techniques/surface-dither.html?preset=reference');
  await page.waitForFunction(()=>document.querySelector('#surface-canvas')?.renderer);
  const canvas=page.locator('#surface-canvas');
  const inspect=()=>canvas.evaluate(c=>{const r=c.renderer;r.render();return {width:c.width,height:c.height,display:c.getBoundingClientRect().width,dpr:devicePixelRatio,filter:getComputedStyle(c).imageRendering,error:r.gl.getError(),buffer:r.sceneSize};});
  let state=await inspect();expect(state.width).toBe(Math.round(state.display*2));expect(state.filter).toBe('auto');expect(state.error).toBe(0);
  expect(state.buffer).toEqual([state.width*2,state.height*2]);
  await page.setViewportSize({width:900,height:800});
  await expect.poll(async()=>{const s=await inspect();return s.width===Math.round(s.display*2);}).toBe(true);
  await page.locator('#resolution').selectOption('960');
  expect((await inspect()).width).toBe(960);
  const aa=await snapshot(page);
  const resolveError=await canvas.evaluate(c=>{
    const r=c.renderer,gl=r.gl,x=Math.floor(c.width/2),y=Math.floor(c.height/2),pixel=new Uint8Array(4),samples=new Uint8Array(16);
    gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER,r.sceneFramebuffer);gl.readPixels(x*2,y*2,2,2,gl.RGBA,gl.UNSIGNED_BYTE,samples);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return Math.max(...[0,1,2].map(k=>Math.abs(pixel[k]-(samples[k]+samples[4+k]+samples[8+k]+samples[12+k])/4)));
  });
  expect(resolveError).toBeLessThanOrEqual(1);
  await page.locator('#samples').selectOption('1');const single=await snapshot(page);
  expect(aa.hash).not.toBe(single.hash);expect(single.error).toBe(0);
  await page.locator('#resolution').selectOption('native');
  await page.locator('#fullscreen').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await expect.poll(async()=>{const s=await inspect();return s.width===Math.round(s.display*2);}).toBe(true);
  expect((await inspect()).error).toBe(0);
  await expect(page.locator('#fullscreen')).toHaveText('退出全屏');
  await page.locator('#fullscreen').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  await context.close();
});


test('texture loading works without Canvas pixel extraction',async({page})=>{
  await page.addInitScript(()=>{CanvasRenderingContext2D.prototype.getImageData=()=>{throw new Error('pixel extraction unavailable');};});
  await ready(page);
  const hash=await page.locator('#surface-canvas').evaluate(async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.renderer.patternData)),x=>x.toString(16).padStart(2,'0')).join(''));
  expect(hash).toBe('671715318fdac01cfbf9e353f4418e39c6feee4f42499b8eb8986f3f2a6178ca');
});

test('2048 texture limit retains 2x2 sampling through accumulation',async({page})=>{
  await ready(page);
  const result=await page.locator('#surface-canvas').evaluate(c=>{
    const r=c.renderer,gl=r.gl;c.width=1530;c.height=861;
    r.setConfig({scene:1,distance:4,yaw:0,pitch:0,scale:7,referenceHeight:480,fov:45,exposure:.55,radial:false,samples:2});
    const first=new Uint8Array(96*64*4),second=new Uint8Array(first.length);
    gl.readPixels(700,400,96,64,gl.RGBA,gl.UNSIGNED_BYTE,first);
    r.maxTextureSize=2048;r.render();gl.readPixels(700,400,96,64,gl.RGBA,gl.UNSIGNED_BYTE,second);
    let maximum=0;for(let i=0;i<first.length;i++)maximum=Math.max(maximum,Math.abs(first[i]-second[i]));
    return {samples:r.samplesUsed,path:r.samplingPath,maximum,error:gl.getError()};
  });
  expect(result.samples).toBe(2);expect(result.path).toBe('accumulate');expect(result.error).toBe(0);expect(result.maximum).toBeLessThanOrEqual(3);
});
