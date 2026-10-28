import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#gem')?.asset);
  await page.evaluate(() => { const a = document.querySelector('#gem').asset; a.setPlaying(false); a.setConfig({ pixels: 96 }); a.render(); });
}

test('actual WebGL pixels change with preset, refraction and rotation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const sample = () => page.evaluate(() => {
    const asset = document.querySelector('#gem').asset; asset.render();
    const { gl, canvas } = asset;
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const colors = new Set(); let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) { colors.add(`${data[i]},${data[i+1]},${data[i+2]}`); hash = Math.imul(hash ^ data[i], 16777619); }
    return { hash, colors: colors.size, error: gl.getError() };
  });
  const ruby = await sample();
  expect(ruby.colors).toBeGreaterThan(20);
  expect(ruby.error).toBe(0);
  await page.getByRole('button', { name: '祖母绿 Emerald' }).click();
  const emerald = await sample();
  expect(emerald.hash).not.toBe(ruby.hash);
  await expect(page.locator('#gem-name')).toContainText('Emerald');
  await page.evaluate(() => document.querySelector('#gem').asset.setConfig({ ior: 2.4 }));
  const refracted = await sample(); expect(refracted.hash).not.toBe(emerald.hash);
  await page.evaluate(() => document.querySelector('#gem').asset.rotate(.7));
  expect((await sample()).hash).not.toBe(refracted.hash);
  expect(errors).toEqual([]);
});

test('PNG transparency, sprite frames, and validated config import/export work', async ({ page }) => {
  await ready(page);
  const exported = await page.evaluate(() => {
    const asset = document.querySelector('#gem').asset;
    const png = asset.exportPNG({ scale: 1 });
    const ctx = png.getContext('2d'); const corner = [...ctx.getImageData(0, 0, 1, 1).data];
    const center = [...ctx.getImageData(png.width / 2, png.height / 2, 1, 1).data];
    const sheet = asset.exportSpriteSheet({ frames: 4, columns: 2 });
    const sc = sheet.canvas.getContext('2d');
    const first = sc.getImageData(0, 0, 96, 96).data;
    const second = sc.getImageData(96, 0, 96, 96).data;
    return { corner, center, width: png.width, sheet: sheet.metadata, differ: first.some((value, i) => value !== second[i]) };
  });
  expect(exported.corner[3]).toBe(0); expect(exported.center[3]).toBe(255);
  expect(exported.width).toBe(96); expect(exported.sheet.frames).toBe(4); expect(exported.differ).toBe(true);
  const download = page.waitForEvent('download'); await page.locator('#export-config').click();
  expect((await download).suggestedFilename()).toBe('ruby.gem.json');
  await page.locator('#import-file').setInputFiles({ name: 'gem.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, preset: 'sapphire', color: '#123456', ior: 1.8, pixels: 96 })) });
  await expect(page.locator('#color')).toHaveValue('#123456'); await expect(page.locator('#gem-name')).toContainText('Sapphire');
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"ior":99}') });
  await expect(page.locator('#toast')).toContainText('无法导入'); await expect(page.locator('#ior')).toHaveValue('1.8');
});

test('pause, keyboard, drag and mobile layout remain usable', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '暂停动画', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放动画', exact: true })).toBeVisible();
  await page.locator('h1').click(); await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '暂停动画', exact: true })).toBeVisible();
  const before = await page.locator('#gem').evaluate((e) => e.asset.yaw);
  const bounds = await page.locator('#gem').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 50, bounds.y + bounds.height / 2); await page.mouse.up();
  expect(await page.locator('#gem').evaluate((e) => e.asset.yaw)).not.toBe(before);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#export-png')).toBeAttached();
});

test('standalone component preserves supplied config and disposes when removed', async ({ page }) => {
  await page.goto('/examples/embed.html');
  await page.waitForFunction(() => document.querySelector('#asset')?.asset);
  await page.evaluate(() => {
    const element = document.createElement('pixel-gem');
    element.id = 'custom'; element.config = { color: '#123456', ior: 2.2, pixels: 96 };
    element.style.cssText = 'width:200px;height:200px'; document.body.append(element);
  });
  await page.waitForFunction(() => document.querySelector('#custom')?.asset);
  const result = await page.evaluate(async () => {
    const el = document.querySelector('#custom'); const first = el.asset;
    const color = first.config.color;
    el.remove(); const disposed = first.disposed;
    document.body.append(el); await new Promise((resolve) => queueMicrotask(resolve));
    return { color, disposed, restoredColor: el.asset.config.color, fresh: first !== el.asset };
  });
  expect(result).toEqual({ color: '#123456', disposed: true, restoredColor: '#123456', fresh: true });
});

test('reduced-motion preference starts with a still asset', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#gem')?.asset);
  expect(await page.locator('#gem').evaluate((e) => e.asset.playing)).toBe(false);
  await expect(page.getByRole('button', { name: '播放动画', exact: true })).toBeVisible();
});
