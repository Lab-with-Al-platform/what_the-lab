// Run after installing Playwright locally; never connects to Discord or a live database.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const origin = process.env.FAQ_CAPTURE_ORIGIN || 'http://127.0.0.1:3000';
const allowedOrigin = new URL(origin).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use an isolated local server');
const ts = require(root + '/frontend/node_modules/typescript');
const vm = require('node:vm');
function load(file) { const m={exports:{}};vm.runInNewContext(ts.transpileModule(require('node:fs').readFileSync(root+'/frontend/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports}); return m.exports; }
const {DISCORD_GUIDES,FAQ_DISCORD_GUIDE_IDS}=load('src/lib/faq-discord.ts');
const out=path.resolve(process.env.FAQ_QA_OUTPUT || root+'/docs/qa/faq-discord-20261117/captures');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}),headless:true,args:['--no-sandbox']});
 const report={widths:[],guides:[],errors:[],mutations:[]};
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',route=>{
  const req=route.request(), u=new URL(req.url());
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))report.mutations.push(u.pathname);
  if(u.pathname.includes('/api/v1/'))return route.fulfill({status:u.pathname.endsWith('/auth/me')?401:200,contentType:'application/json',body:u.pathname.endsWith('/auth/me')?'{}':'{"items":[],"total":0,"unread":0,"count":0}'});
  if(u.origin!==allowedOrigin)return route.abort();
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 try {
  for(const [w,h] of [[1440,900],[768,1024],[390,844],[320,844]]){
   await page.setViewportSize({width:w,height:h});
   await page.goto(origin+'/faq#discord-task-create');
   const detail=page.locator('#discord-task-create');
   const guide=detail.getByRole('region',{name:'대화에서 작업으로 남기기 Discord 사용 안내'});
   await guide.waitFor();await page.evaluate(()=>document.fonts.ready);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert.equal(overflow,false,'overflow '+w);
   await guide.getByRole('button',{name:/내용 입력/}).click();
   await guide.getByRole('heading',{name:'요청 남기기',exact:true}).waitFor();
   await guide.screenshot({path:out+`/task-${w}.png`});
   await page.goto(origin+'/faq');
   await page.getByRole('button',{name:/Discord 사용하기/}).click();
   await page.screenshot({path:out+`/overview-${w}.png`});
   report.widths.push({width:w,height:h,overflow:false});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const [id,guide] of Object.entries(DISCORD_GUIDES)){
   const faq=Object.keys(FAQ_DISCORD_GUIDE_IDS).find(key=>FAQ_DISCORD_GUIDE_IDS[key]===id);
   await page.goto(origin+'/faq#'+faq);
   const region=page.locator('#'+faq).getByRole('region',{name:guide.title+' Discord 사용 안내'});
   await region.waitFor();
   for(const scene of guide.scenes){
    await region.getByRole('button',{name:new RegExp(scene.title)}).click();
    await region.getByRole('heading',{name:scene.heading,exact:true}).waitFor();
   }
   await region.screenshot({path:out+`/guide-${id}.png`});
   assert.equal(await region.getByRole('button',{name:'다음 단계 →'}).isDisabled(),true);
   report.guides.push({id,faq,scenes:guide.scenes.length});
  }
  // A hash hidden by query/category must recover, then normal filtering must remain usable.
  await page.goto(origin+'/faq?category=privacy&q=없는질문#discord-task-create');
  await page.locator('#discord-task-create[open]').waitFor();
  await page.getByRole('searchbox',{name:'FAQ 검색'}).fill('/일정목록');
  await page.waitForURL(u=>u.searchParams.get('q')==='/일정목록');
  assert.ok(await page.getByText('Discord 일정 목록에서 수정·삭제하려면?',{exact:true}).isVisible());
  await page.getByRole('link',{name:'Discord 사용 안내',exact:true}).click();
  await page.locator('#discord-task-create[open]').waitFor();
  // Existing genuine product capture is retained alongside an illustration.
  await page.goto(origin+'/faq#task-due-negotiation');
  await page.locator('#task-due-negotiation img').first().waitFor();
  await page.locator('#task-due-negotiation').screenshot({path:out+'/combined-capture-guide.png'});
  // Search integration uses the common FAQ index.
  await page.goto(origin+'/search?q='+encodeURIComponent('/요청'));
  await page.getByRole('link',{name:/Discord에서 상대에게 작업을 요청/}).waitFor();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.mutations,[]);
  console.log(JSON.stringify(report,null,2));
 } finally { await fs.writeFile(out+'/browser-results.json',JSON.stringify(report,null,2)+'\n');await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
