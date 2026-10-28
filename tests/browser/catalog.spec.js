import {test,expect} from '@playwright/test';

test('directory filters, searches and navigates to the gem page',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'技术目录',exact:true})).toBeVisible();
  await expect(page.locator('.technique-card:visible')).toHaveCount(2);
  await page.locator('[data-category="抖动渲染"]').click();
  await expect(page.locator('.technique-card:visible')).toHaveCount(1);
  await page.getByRole('searchbox',{name:'搜索技术'}).fill('UV');
  await expect(page.locator('.technique-card:visible')).toHaveCount(1);
  await page.getByRole('searchbox',{name:'搜索技术'}).fill('nonexistent');
  await expect(page.locator('#empty-result')).toBeVisible();
  await page.getByRole('searchbox',{name:'搜索技术'}).fill('');
  await page.locator('[data-category="all"]').click();
  await page.locator('[data-id="gem"]').click();
  await expect(page).toHaveURL(/techniques\/gem\.html$/);
  await page.waitForFunction(()=>document.querySelector('#gem')?.asset);
  await page.locator('.brand').click();
  await expect(page.getByRole('heading',{name:'技术目录',exact:true})).toBeVisible();
});

test('legacy gem links and mobile directory layout remain functional',async({page})=>{
  await page.goto('/?shape=heart');
  await expect(page).toHaveURL(/techniques\/gem\.html\?shape=heart$/);
  await page.waitForFunction(()=>document.querySelector('#gem')?.asset);
  await expect(page.locator('#shape')).toHaveValue('heart');
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.technique-card:visible')).toHaveCount(2);
  await page.locator('[data-id="surface-dither"]').click();
  await page.waitForFunction(()=>document.querySelector('#surface-canvas')?.renderer);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
