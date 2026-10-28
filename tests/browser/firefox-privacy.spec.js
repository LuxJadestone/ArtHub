import {test,expect} from '@playwright/test';

test('Firefox anti-fingerprinting preserves source texture and the reported low-angle configuration',async({browser},testInfo)=>{
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});
  const page=await context.newPage();
  await page.addInitScript(()=>{CanvasRenderingContext2D.prototype.getImageData=()=>{throw new Error('pixel extraction unavailable');};});
  await page.goto('/techniques/surface-dither.html?preset=reference');
  await page.waitForFunction(()=>document.querySelector('#surface-canvas')?.renderer);
  await page.locator('#surface-canvas').evaluate(c=>{c.style.width='765px';});
  await expect.poll(()=>page.locator('#surface-canvas').evaluate(c=>c.width)).toBe(1530);
  const result=await page.locator('#surface-canvas').evaluate(async c=>{
    const r=c.renderer;r.setConfig({distance:3,yaw:2.783999999999997,pitch:.07});
    return {hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.patternData)),x=>x.toString(16).padStart(2,'0')).join(''),max:r.maxTextureSize,samples:r.samplesUsed,path:r.samplingPath,size:[c.width,c.height],error:r.gl.getError()};
  });
  expect(result.hash).toBe('671715318fdac01cfbf9e353f4418e39c6feee4f42499b8eb8986f3f2a6178ca');
  expect(result.size).toEqual([1530,861]);expect(result.max).toBe(2048);expect(result.samples).toBe(2);expect(result.path).toBe('accumulate');expect(result.error).toBe(0);
  await page.locator('#surface-canvas').screenshot({path:testInfo.outputPath('firefox-privacy.png')});
  await context.close();
});
