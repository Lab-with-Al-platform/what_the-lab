// 실제 DB·로그인 서버 대신 가상 응답으로 관리자 진행 상태 표시를 검사합니다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'frontend/src/lib/admin-demo.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, Date, URLSearchParams });
const demo = mod.exports;
const target = 'http://127.0.0.1:3017';
// 최초 다섯 상태의 캡처는 보존하고, 후속 아홉 상태 검증을 별도 폴더에 저장합니다.
const output = path.join(__dirname, 'additional-states');
const shots = path.join(output, 'screens');
fs.mkdirSync(shots, { recursive: true });

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', headless: true, args: ['--disable-gpu'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    const calls = [];
    let legacyResponse = false;
    await context.route('**/api/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace('/api/v1', '');
      calls.push({ method: request.method(), endpoint });
      const headers = { 'Access-Control-Allow-Origin': target, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };
      const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
      if (request.method() === 'OPTIONS') return reply({});
      if (request.method() !== 'GET') return reply({ detail: 'QA prohibits writes' }, 403);
      if (endpoint === '/auth/me') return reply({ user_id: 999, nickname: '가상 운영자', user_role: 'researcher', signup_step: 'done', user_photo: null });
      if (endpoint.endsWith('/access')) return reply({ can_read_operations: true, can_manage_insights: true });
      if (endpoint === '/admin/operations/researches/summary') return reply(demo.demoSummary('30d').researches);
      if (endpoint === '/admin/operations/researches') {
        const result = demo.demoResearches(new URLSearchParams());
        result.items = result.items.map(item => {
          const { progress, ...rest } = item;
          void progress;
          return legacyResponse ? rest : { ...rest, progress: { code: item.status === 'draft' ? 'not_applicable' : 'not_linked', note: '가상 API: 실제 진행 정보 연결 전' } };
        });
        return reply(result);
      }
      return reply({ detail: 'QA endpoint not provided' }, 404);
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const table = () => page.getByRole('table', { name: '연구 등록 목록' });
    // 검색 직후에는 기존 행이 잠깐 남을 수 있어 결과 전체가 바뀐 뒤 검사합니다.
    const waitFiltered = async label => page.waitForFunction(expected => {
      const element = Array.from(document.querySelectorAll('table')).find(value => value.caption?.textContent === '연구 등록 목록');
      const rows = Array.from(element?.tBodies[0]?.rows ?? []);
      return rows.length > 0 && rows.every(row => row.cells[4]?.textContent?.trim() === expected);
    }, label);
    const go = async suffix => {
      await page.goto(target + suffix, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await table().waitFor();
      await page.getByText(/^검색 결과 \d+건$/).waitFor();
    };
    const checks = [];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : width === 390 ? 844 : 900 });
      await go('/admin/projects?demo=1');
      await table().getByRole('columnheader', { name: '진행 상태', exact: true }).waitFor();
      await page.locator('select[name="progress_status"]').waitFor();
      for (const label of ['모집 중', '모집 종료·미매칭', '모집 취소', '진행 예정', '진행 중', '일시 중지', '종료 확인 중', '해당 없음']) {
        await table().getByText(label, { exact: true }).first().waitFor();
      }
      await page.evaluate(() => document.fonts.ready);
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(size.scrollWidth <= width + 1, JSON.stringify(size));
      await page.screenshot({ path: path.join(shots, `research-${width}.png`), fullPage: true });
      await table().scrollIntoViewIfNeeded();
      if (width < 1000) await table().evaluate(element => { element.parentElement.scrollLeft = 350; });
      await page.screenshot({ path: path.join(shots, `status-${width}.png`) });
      checks.push(size);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [code, label] of [
      ['recruitment_canceled', '모집 취소'], ['paused', '일시 중지'],
      ['completion_pending', '종료 확인 중'], ['discontinued', '중단'], ['completed', '완료'],
    ]) {
      await go('/admin/projects?demo=1');
      await page.locator('select[name="progress_status"]').selectOption(code);
      await page.getByRole('button', { name: '검색', exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('progress_status') === code);
      await waitFiltered(label);
      const filteredRows = await table().locator('tbody tr').allTextContents();
      assert.ok(filteredRows.length > 0 && filteredRows.every(row => row.includes(label)));
      await table().getByRole('link', { name: '상세 보기' }).first().click();
      await page.locator('dd').getByText(label, { exact: true }).waitFor();
      if (code !== 'completed') await page.screenshot({ path: path.join(shots, `detail-${code}.png`), fullPage: true });
    }
    await go('/admin/projects?demo=1');
    await page.locator('select[name="progress_status"]').selectOption('scheduled');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.waitForURL('**progress_status=scheduled**');
    await waitFiltered('진행 예정');
    let rows = await table().locator('tbody tr').allTextContents();
    assert.ok(rows.length > 0 && rows.every(row => row.includes('진행 예정')));
    await page.locator('select[name="status"]').selectOption('draft');
    await page.locator('select[name="progress_status"]').selectOption('in_progress');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await table().getByText('조건에 맞는 연구가 없습니다.', { exact: true }).waitFor();
    assert.equal(await table().locator('tbody td').getAttribute('colspan'), '8');
    await page.getByRole('button', { name: '초기화', exact: true }).click();
    await table().getByText('모집 중', { exact: true }).first().waitFor();
    assert.equal(await page.locator('select[name="progress_status"]').inputValue(), '');
    await table().getByRole('row').filter({ hasText: '#20005' }).getByRole('link', { name: '상세 보기' }).click();
    await page.getByRole('heading', { name: '연구 등록 상세', exact: true }).waitFor();
    await page.locator('dd').getByText('진행 예정', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(shots, 'detail-1440.png'), fullPage: true });

    await go('/admin/projects');
    await table().getByText('연동 전', { exact: true }).first().waitFor();
    rows = await table().locator('tbody tr').allTextContents();
    assert.ok(rows.every(row => row.includes('연동 전') || row.includes('해당 없음')));
    assert.equal(await page.getByText('디자인 데모 · 가상 데이터', { exact: true }).count(), 0);
    legacyResponse = true;
    await go('/admin/projects');
    await table().getByText('연동 전', { exact: true }).first().waitFor();
    await table().getByText('해당 없음', { exact: true }).first().waitFor();
    assert.equal(calls.filter(call => !['GET', 'OPTIONS'].includes(call.method)).length, 0);
    assert.deepEqual(errors, []);
    const result = { checks, interactions: '추가 네 상태 및 완료의 필터·상세, 작성 상태 교차 검색, 빈 결과, 초기화, 실데이터 연결 전, 구형 API 호환', writes: 0, errors };
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
