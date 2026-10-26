// 실제 DB 대신 가상 API를 연결한 격리된 Next.js 복사본을 검사합니다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'frontend/src/lib/admin-demo.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} });
const mod = { exports:{} };
vm.runInNewContext(compiled.outputText, { module:mod,exports:mod.exports,Date,URLSearchParams });
const demo = mod.exports;
const target = 'http://127.0.0.1:3017';
const shots = path.join(__dirname, 'screens');
fs.mkdirSync(shots, {recursive:true});

const titles = ['가상 사례 · 세포 이미지의 경계를 분석하는 방법','가상 트렌드 · 연구 보조 AI 활용 시 확인할 것','가상 사례 · 기후 관측 데이터의 예측 기준','가상 트렌드 · 작은 언어모델을 연구실에서 활용하기','가상 사례 · 병리 슬라이드의 오류 사례 검토','가상 트렌드 · 문헌 검색의 근거를 평가하는 방법'];
const items = titles.map((title,index)=>({ id:'qa-'+index,kind:index%2?'trend':'case',status:index<2?'pending_review':'draft',version:1,current_revision:1,approved_revision:null,scheduled_for:null,publication_id:null,title,summary:'관리자 레이아웃 검증을 위한 가상 원고',research_field:index%2?'연구 도구':'생명과학',keywords:['이미지 분석','연구 검토'],is_published:false,has_correction:false,content_stage:'article_draft',registered_at:'2026-10-26T03:00:00Z',published_at:null,source_title:'가상 자료',doi:null }));
const settings = {version:0,saved:false,updated_at:null,execution_available:false,config:{interval_days:7,preferred_time:'09:00',timezone:'Asia/Seoul',lookback_days:30,max_items:3,keywords:['가상 연구'],sources:[],discovery_policy:{enabled:true,target_candidates:1,case_max_days:90,news_max_days:60,explanation_max_days:90,max_source_requests:10,max_run_seconds:60,date_basis:'published',historical_discovery:'separate_manual'}}};

async function main() {
  const browser = await chromium.launch({ executablePath:'C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true,args:['--disable-gpu'] });
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    const errors = [];
    const calls = [];
    let permissions = {operations:true,insights:true,login:true};
    await context.route('**/api/v1/**', async route=>{
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace('/api/v1','');
      calls.push({method:request.method(),endpoint});
      const headers = {'Access-Control-Allow-Origin':target,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
      const reply = (body,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
      if(request.method()==='OPTIONS') return reply({});
      if(request.method()!=='GET') return reply({detail:'QA prohibits writes'},403);
      if(endpoint==='/auth/me') return permissions.login?reply({user_id:999,nickname:'가상 운영자',user_role:'researcher',signup_step:'done',user_photo:null}):reply({detail:'로그인이 필요합니다'},401);
      if(endpoint.endsWith('/access')) {
        if(!permissions.login)return reply({detail:'로그인이 필요합니다'},401);
        if(endpoint.includes('/operations'))return permissions.operations?reply({can_read_operations:true}):reply({detail:'운영 권한 없음'},403);
        return permissions.insights?reply({can_manage_insights:true}):reply({detail:'인사이트 권한 없음'},403);
      }
      if(endpoint.startsWith('/admin/operations') && !permissions.operations)return reply({detail:'거절'},403);
      if(endpoint==='/admin/operations/summary') {
        const result=demo.demoSummary(url.searchParams.get('preset')||'7d');
        for(const card of [result.members.completed,result.members.in_progress,result.members.suspended,result.members.accounts_created,result.researches.registered,result.researches.records,result.researches.created]) {card.value=0;if(card.series)card.series=card.series.map(p=>({...p,count:0}));}
        result.members.roles.counts={researcher:0,expert:0,unset:0};result.members.steps.counts={role:0,verify:0,info:0,done:0};
        result.members.completed.active=0;result.members.completed.suspended=0;
        return reply(result);
      }
      if(endpoint==='/admin/operations/members')return reply({total:0,page:1,page_size:20,items:[]});
      if(endpoint==='/admin/operations/researches/summary') {const result=demo.demoSummary('30d').researches;result.registered.value=0;result.records.value=0;result.created.value=0;result.created.series=result.created.series.map(p=>({...p,count:0}));result.fields.items=[];return reply(result);}
      if(endpoint==='/admin/operations/researches')return reply({total:0,page:1,page_size:20,items:[]});
      if(endpoint==='/admin/insights/workspace') {
        let result=items;
        if(url.searchParams.get('scope')==='published')result=[];
        if(url.searchParams.get('q'))result=result.filter(item=>item.title.includes(url.searchParams.get('q')));
        if(url.searchParams.get('kind'))result=result.filter(item=>item.kind===url.searchParams.get('kind'));
        return reply({items:result,total:result.length,page:1,counts:{all:6,collected:6,published:0},categories:['생명과학','연구 도구'],keywords:['이미지 분석','연구 검토']});
      }
      if(endpoint.includes('collection-settings'))return reply(settings);
      if(endpoint.includes('keywords'))return reply({items:[]});
      return reply({detail:'QA endpoint not provided: '+endpoint},404);
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    const checks=[];
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:width===768?1024:width===390?844:900});
      for(const [name,url] of [['summary','/admin?demo=1&preset=30d'],['members','/admin/members?demo=1'],['research','/admin/projects?demo=1'],['insights','/admin/insights']]) {
        await page.goto(target+url,{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('navigation',{name:'관리자 메뉴'}).waitFor();
        await page.getByRole('heading',{level:1}).waitFor();
        if(name!=='insights')await page.getByText('디자인 데모 · 가상 데이터',{exact:true}).waitFor();
        if(name==='summary')await page.getByText('계정 생성 추이',{exact:true}).first().waitFor();
        if(name==='members')await page.getByRole('table',{name:'회원 목록'}).waitFor();
        if(name==='research')await page.getByRole('table',{name:'연구 등록 목록'}).waitFor();
        if(name==='insights')await page.getByRole('table',{name:'인사이트 통합 목록'}).waitFor();
        await page.waitForTimeout(600);
        const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
        assert.ok(size.scrollWidth<=width+1,JSON.stringify({name,...size}));
        await page.screenshot({path:path.join(shots,name+'-'+width+'.png'),fullPage:true});
        if(width===1440)await page.screenshot({path:path.join(shots,name+'-1440-top.png')});
        checks.push({name,width,...size});
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.goto(target+'/admin?demo=1');
    await page.getByRole('button',{name:'최근 30일',exact:true}).click();
    await page.waitForURL('**preset=30d**');
    assert.equal(await page.locator('main svg[role="img"]').count(),2);
    await page.getByRole('navigation',{name:'관리자 메뉴'}).getByRole('link',{name:'회원 관리'}).click();
    assert.ok(page.url().includes('demo=1'));
    await page.getByRole('table',{name:'회원 목록'}).waitFor();
    await page.getByPlaceholder('회원 번호 또는 닉네임').fill(String(demo.DEMO_MEMBERS[0].user_id));
    await page.getByRole('button',{name:'검색',exact:true}).click();
    await page.waitForTimeout(350);
    assert.equal(await page.getByRole('table',{name:'회원 목록'}).locator('tbody tr').count(),1);
    await page.getByRole('link',{name:'상세 보기'}).click();
    await page.getByRole('heading',{name:'회원 상세',exact:true}).waitFor();
    assert.ok(page.url().includes('demo=1'));
    await page.goto(target+'/admin/projects?demo=1&tab=abandonment');
    await page.getByRole('heading',{name:'어느 단계까지 작성했을까요?'}).waitFor();
    await page.screenshot({path:path.join(shots,'abandonment-1440.png'),fullPage:true});
    await page.getByRole('button',{name:'최근 7일',exact:true}).click();
    assert.ok(page.url().includes('tab=abandonment'));

    await page.goto(target+'/admin/insights');
    const tabs=page.getByRole('navigation',{name:'인사이트 관리 탭'});
    await tabs.getByRole('button',{name:/게시글/}).click();
    await page.getByText('조건에 맞는 원고가 없습니다.').waitFor();
    await tabs.getByRole('button',{name:/전체 목록/}).click();
    await page.getByRole('button',{name:'후보 묶음 가져오기',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'취소',exact:true}).click();
    await page.getByRole('button',{name:'+ 후보 직접 등록',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
    await tabs.getByRole('button',{name:'자동수집 설정',exact:true}).click();
    await page.getByLabel('검색 키워드',{exact:false}).fill('가상 변경');
    page.once('dialog',dialog=>dialog.dismiss());
    await tabs.getByRole('button',{name:/전체 목록/}).click();
    assert.equal(await tabs.getByRole('button',{name:'자동수집 설정',exact:true}).getAttribute('aria-current'),'page');
    await page.reload();
    await page.goto(target+'/admin');
    await page.getByRole('button',{name:'실데이터',exact:true}).waitFor();
    assert.equal(await page.getByText('디자인 데모 · 가상 데이터',{exact:true}).count(),0);

    permissions={operations:false,insights:true,login:true};
    await page.goto(target+'/admin/insights');
    await page.getByRole('table',{name:'인사이트 통합 목록'}).waitFor();
    assert.equal(await page.getByRole('navigation',{name:'관리자 메뉴'}).getByRole('link').count(),1);
    await page.goto(target+'/admin/members?demo=1');
    await page.getByRole('heading',{name:'이 메뉴의 관리 권한이 없습니다'}).waitFor();
    assert.equal(await page.getByRole('table',{name:'회원 목록'}).count(),0);
    permissions={operations:true,insights:false,login:true};
    await page.goto(target+'/admin/insights');
    await page.getByRole('heading',{name:'이 메뉴의 관리 권한이 없습니다'}).waitFor();
    permissions={operations:false,insights:false,login:false};
    await page.goto(target+'/admin?demo=1');
    await page.getByRole('heading',{name:'로그인이 필요합니다'}).waitFor();
    assert.equal(await page.getByText('디자인 데모 · 가상 데이터',{exact:true}).count(),0);
    await page.goto(target+'/admin/insights/preview');
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('navigation',{name:'관리자 메뉴'}).count(),0);
    assert.deepEqual(errors,[]);
    assert.equal(calls.filter(call=>!['GET','OPTIONS'].includes(call.method)).length,0);
    fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({checks,interactions:'기간, 데모 유지, 회원 검색/상세, 등록 과정, 인사이트 탭/등록 모달/미저장 보호, 권한별 접근, 미리보기 레이아웃 제외',writes:0,errors},null,2));
    console.log(JSON.stringify({checks:checks.length,writes:0,errors}));
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exit(1);});
