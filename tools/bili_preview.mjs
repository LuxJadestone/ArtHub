#!/usr/bin/env node
// Read only the public 30-second preview through an ordinary browser session.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const [source, ...flags] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < flags.length; i += 2) {
    if (!['--output', '--times'].includes(flags[i]) || !flags[i + 1]) throw new Error('用法: node tools/bili_preview.mjs URL --output NEW_DIRECTORY [--times 1,6,12,18,24,28]');
    options[flags[i]] = flags[i + 1];
  }
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.hostname !== 'www.bilibili.com' || !/^\/video\/BV[\w]+\/?$/.test(url.pathname)) throw new Error('请输入标准 B 站 HTTPS 视频链接');
  if (!options['--output']) throw new Error('必须指定新的 --output 目录');
  const times = (options['--times'] || '1,6,12,18,24,28').split(',').map(Number);
  if (times.length > 12 || times.some((t) => !Number.isFinite(t) || t < 0 || t >= 30)) throw new Error('仅采样公开预览的 0–30 秒，最多 12 张');
  const out = path.resolve(options['--output']);
  await fs.mkdir(out, { recursive: true });
  if ((await fs.readdir(out)).length) throw new Error('输出目录必须为空');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2 && Number.isFinite(v.duration); }, null, { timeout: 30000 });
    const video = page.locator('video').first();
    const toggle = page.locator('.bpx-player-dm-switch input');
    if (await toggle.count()) await toggle.first().uncheck({ force: true }).catch(() => {});
    const frames = [];
    for (const time of times) {
      await video.evaluate((v, t) => { v.pause(); v.currentTime = t; }, time);
      await page.waitForFunction((target) => { const v = document.querySelector('video'); return v && !v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - target) < .3; }, time, { timeout: 15000 });
      const filename = path.join(out, `preview-${time}.png`);
      await video.screenshot({ path: filename });
      frames.push({ requested_time_seconds: time, observed_time_seconds: await video.evaluate((v) => v.currentTime), path: filename });
    }
    await page.mouse.wheel(0, 1100);
    await page.locator('bili-comments').first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await page.locator('bili-comment-thread-renderer').first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
    const commentCount = await page.locator('bili-comment-thread-renderer').count();
    // Include public comments held inside nested web-component shadow roots.
    const text = await page.evaluate(() => {
      const collected = [];
      function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) { const t = node.textContent.trim(); if (t) collected.push(t); return; }
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.nodeName)) return;
        for (const child of node.childNodes) walk(child);
        if (node.shadowRoot) walk(node.shadowRoot);
      }
      walk(document.body); return collected.join('\n');
    });
    await fs.writeFile(path.join(out, 'page-and-comments.txt'), text);
    const manifest = { source: url.href, title: await page.title(), coverage: 'Public preview only; not the complete video. No audio processed.', frames, loaded_comment_threads: commentCount, comments: commentCount ? 'Only loaded public comments, not an exhaustive thread.' : 'No comment threads loaded. Page text alone is not evidence of comment contents.' };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(path.join(out, 'manifest.json'));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
