// 개인 브라우저와 분리된 테스트 브라우저에서 시안의 화면과 동작을 확인합니다.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    headless: true,
    args: ['--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 5500 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('file:///' + path.join(__dirname, 'labbridge-ui-v3.html').replaceAll('\\', '/'));
  const root = page.frameLocator('iframe').locator('#labbridge-v3');
  await root.waitFor();
  await page.waitForTimeout(3500);
  const app = root.locator('.lb-app');
  const shots = path.join(__dirname, 'screens');
  await fs.mkdir(shots, { recursive: true });
  const checks = [];
  for (const screen of ['cases', 'trends', 'experts', 'detail', 'case-detail', 'trend-detail']) {
    await root.locator(`[data-screen="${screen}"]`).click();
    for (const device of ['desktop', 'mobile']) {
      await root.locator(`[data-device="${device}"]`).click();
      await page.setViewportSize({ width: device === 'desktop' ? 1440 : 480, height: 6000 });
      await page.waitForTimeout(200);
      const sizing = await app.evaluate(el => ({
        width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight,
        images: el.querySelectorAll('img').length,
        loadedImages: [...el.querySelectorAll('img')].filter(img => img.complete && img.naturalWidth > 0).length,
      }));
      if (sizing.scrollWidth > sizing.width + 1) throw new Error(`가로 넘침: ${screen}/${device}`);
      if (sizing.loadedImages !== sizing.images) throw new Error(`이미지 누락: ${screen}/${device}`);
      await app.screenshot({ path: path.join(shots, `${screen}-${device}.png`) });
      checks.push({ screen, device, ...sizing });
    }
  }

  // 목록 → 상세 → 목차 → 목록 복귀가 실제로 연결되는지 검사합니다.
  await root.locator('[data-device="desktop"]').click();
  await page.setViewportSize({ width:1440, height:6000 });
  await root.locator('[data-screen="cases"]').click();
  await root.locator('[data-read="cells"]').first().click();
  if (await root.locator('.lb-reader-section').count() !== 7) throw new Error('연구 상세 연결 실패');
  await root.locator('.lb-reading-toc [data-toc="3"]').click();
  if (!await root.locator('.lb-reading-toc [data-toc="3"]').evaluate(el => el.classList.contains('active'))) throw new Error('목차 선택 실패');
  await root.locator('[data-save="cells"]').click();
  if (await root.locator('[data-save="cells"]').getAttribute('aria-pressed') !== 'true') throw new Error('저장 실패');
  await root.locator('[data-tech="0"]').click();
  if (!await root.locator('#lb-v3-tech-0').isVisible()) throw new Error('기술 설명 실패');
  await root.locator('.lb-reading-end [data-go="cases"]').click();
  if (await root.locator('.lb-article').count() !== 6) throw new Error('목록 복귀 실패');
  await root.locator('[data-screen="trends"]').click();
  await root.locator('[data-read="agents"]').first().click();
  if (await root.locator('.lb-reader-section').count() !== 6) throw new Error('트렌드 상세 연결 실패');
  await root.locator('[data-device="mobile"]').click();
  const toc = root.locator('.lb-mobile-toc');
  await toc.locator('summary').click();
  await toc.locator('[data-toc="4"]').click();
  if (await toc.evaluate(el => el.open)) throw new Error('모바일 목차 접기 실패');
  await root.locator('[data-match]').click();
  if (await root.locator('.lb-expert-card').count() < 1) throw new Error('관련 전문가 연결 실패');

  // 선택한 PC 화면도 좁은 화면에서 반응형으로 다시 배치되어야 합니다.
  const responsive = [];
  await root.locator('[data-device="desktop"]').click();
  for (const width of [320, 390, 736, 1024]) {
    await page.setViewportSize({ width, height:6000 });
    for (const screen of ['case-detail','trend-detail']) {
      await root.locator(`[data-screen="${screen}"]`).click();
      const sizing = await app.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
      if (sizing.scrollWidth > sizing.width + 1) throw new Error(`반응형 넘침: ${screen}/${width}`);
      const image = await root.locator('.lb-reading-cover img').evaluate(el => ({ width:el.clientWidth, height:el.clientHeight }));
      if (image.width < 50 || image.height < 50) throw new Error('표지 이미지 크기 오류');
      responsive.push({ screen, viewport:width, ...sizing });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const result = { checks, responsive, interactions:'목록 연결, 목차 이동, 모바일 목차 접기, 저장, 기술 설명, 목록 복귀, 관련 전문가 연결 통과', errors };
  await fs.writeFile(path.join(__dirname, 'verification.json'), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
main().catch(error => { console.error(error); process.exit(1); });
