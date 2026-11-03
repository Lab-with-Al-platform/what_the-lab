/**
 * Capture REAL WHAT THE LAB Next.js components, not an HTML mock.
 * Network requests are satisfied by isolated sample data in this browser only.
 * Never accesses live accounts, Discord, production DB or Google.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const SITE=process.env.FAQ_CAPTURE_ORIGIN||"http://127.0.0.1:3000";
const DIR=path.resolve("public/faq/screenshots");
const me={user_id:91001,nickname:"시연 연구자",user_role:"researcher",user_photo:null,signup_step:"done",is_admin:false};
const name="시연 전문가";
const research={title:"의료 영상 AI 분석 연구 · 시연 데이터"};
const base={collaboration_id:101,research,partner:{nickname:name,user_photo:null,role:"expert"},start_date:"2026-10-28",end_date:"2026-12-12",confirmed_on:"2026-10-27",status:"active",opened:true,google_linked:false,discord_channel_url:null};
const finished={...base,collaboration_id:102,research:{title:"현미경 이미지 분류 프로젝트 · 시연 데이터"},start_date:"2026-09-02",end_date:"2026-10-29",confirmed_on:"2026-09-01",status:"done"};
const schedule=(id,kind,title,start,end,time=null)=>({schedule_id:id,collaboration_id:101,kind,title,start_date:start,end_date:end,start_time:time,end_time:time?"15:00":null,place:null,memo:null,assignee:null,series_id:null,created_by:91001,created_by_nickname:me.nickname,created_at:"2026-11-02T03:12:00Z",updated_at:"2026-11-02T03:12:00Z"});
const schedules=[schedule(201,"meeting","연구 목표 확인 미팅","2026-11-04","2026-11-04","14:00"),schedule(202,"work","데이터 구조 검토","2026-11-05","2026-11-10"),schedule(203,"due","전처리 결과 공유","2026-11-13","2026-11-13")];
const ev=(id,task,kind,actor,due)=>({event_id:id,task_id:task,actor_id:actor,actor_nickname:actor===91001?me.nickname:name,kind,old_due:null,new_due:due,note:null,source:"web",created_at:"2026-11-02T04:00:00Z"});
const task=(id,by,to,content,due,status)=>({task_id:id,requested_by:by,assignee:to,content,due_date:due,status,closed_at:status==="done"?"2026-11-02T06:00:00Z":null,source:"web",created_at:"2026-11-02T03:10:00Z",requested_by_nickname:by===91001?me.nickname:name,assignee_nickname:to===91001?me.nickname:name,direction:to===91001?"in":"out",events:[ev(id, id,"created",by,due)],talk:null,returned:null});
const tasks=[
task(301,91002,91001,"영상 데이터 50건의 라벨 기준을 검토해 주세요.","2026-11-07","open"),
task(302,91001,91002,"모델 평가 기준 초안을 만들어 주세요.","2026-11-09","open"),
task(303,91001,91002,"이미지 품질 점검 보고서를 공유해 주세요.","2026-11-01","done")
];
const listTasks=tasks.filter(t=>t.status==="open").map(t=>({task_id:t.task_id,collaboration_id:101,content:t.content,due_date:t.due_date,created_at:t.created_at,direction:t.direction,requested_by_nickname:t.requested_by_nickname,assignee_nickname:t.assignee_nickname,flag:null}));
const person={user_id:91001,nickname:me.nickname,user_photo:null,role:"researcher",institution_name:"시연 연구기관",department:"생명과학 연구실",position:"phd"};
const partner={user_id:91002,nickname:name,user_photo:null,role:"expert",current_job:"researcher",ai_career:"3_5",affiliation:"시연 AI 연구소"};
const agreement={title:research.title,description:"현미경 영상 분류 자동화 실험",field_ids:[],able_work_ids:[],task_unsure:false,outputs:[],rewards:[],data_types:[],data_status:null,share_policy:null,share_condition:null,meeting_type:null,face_to_area:null,message:"시연을 위한 요청",reply_message:"진행 가능합니다."};
const detail=(collab)=>({collaboration:{...collab,today:"2026-11-03",my_side:"researcher",me:person,partner,google_calendar_url:null,ended_at:collab.status==="done"?"2026-10-29T09:00:00Z":null,ended_by_nickname:null,end_reason:null},agreement:{...agreement,title:collab.research.title},schedules:collab.status==="done"?[]:schedules,tasks:collab.status==="done"?[]:tasks,decisions:[],pending_change:null,extensions:[],google_enabled:true});
const review={collaboration_id:102,side:"researcher",eligible:true,status:"done",submission_deadline:"2026-11-28T15:00:00Z",partner:name,research_title:finished.research.title,public_policy:"실제 종료 협업 평가는",my_review:null,received_review:null,can_edit:false,can_submit:true};
const notifications={unread:3,items:[{notification_id:1,type:"task_created",title:"시연 전문가 님이 요청을 남겼어요",detail:tasks[0].content,created_at:"2026-11-03T08:10:00Z",read:false,link:"/workspace/101#task-301"},{notification_id:2,type:"schedule_created",title:"새 일정이 등록됐어요",detail:schedules[0].title,created_at:"2026-11-03T06:00:00Z",read:false,link:"/workspace/101"},{notification_id:3,type:"review_ready",title:"협업이 완료됐어요 · 평가 작성하기",detail:finished.research.title,created_at:"2026-11-03T03:00:00Z",read:false,link:"/workspace/102#review"}]};
function mock(raw){
 const p=raw.split("?")[0];
 if(p==="/auth/me")return me;
 if(p==="/workspace")return {collaborations:[base,finished],schedules,tasks:listTasks,google_enabled:true};
 if(p==="/workspace/101")return detail(base);
 if(p==="/workspace/102")return detail(finished);
 if(p==="/reviews/collaborations/102")return review;
 if(p==="/notifications/unread-count")return {count:3};
 if(p==="/notifications")return notifications;
 if(p==="/community/me")return {user_id:me.user_id,nickname:me.nickname,user_role:me.user_role,is_admin:false};
 if(p.startsWith("/reviews/reputation"))return {};
 if(p.startsWith("/experts"))return {items:[],total:0};
 if(p.startsWith("/community/"))return {items:[],posts:[],total:0};
 return {items:[],total:0};
}
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const ctx=await browser.newContext({viewport:{width:1365,height:930},deviceScaleFactor:1,colorScheme:"light",reducedMotion:"reduce"});
const page=await ctx.newPage();
page.on("pageerror",e=>console.log("pageerror:",e.message.slice(0,240)));
page.on("console",msg=>{if(msg.type()==="error")console.log("console:",msg.text().slice(0,200))});
await page.route("**/api/v1/**",async route=>{
 const url=new URL(route.request().url());
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS"}});
 return route.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(mock(url.pathname.replace(/^\/api\/v1/,"")+url.search))});
});
await mkdir(DIR,{recursive:true});
const manifest=[];
async function shot(id,where,expect,action){
 await page.goto(SITE+where,{waitUntil:"domcontentloaded",timeout:50000});
 if(expect)await page.getByText(expect,{exact:false}).first().waitFor({state:"visible",timeout:25000});
 if(action)await action();
 await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'body::after{content:"WHAT THE LAB · 실제 UI / 시연 데이터";position:fixed;z-index:999999;top:74px;right:20px;pointer-events:none;background:rgba(31,48,80,.94);color:white;font:700 11px/1.5 sans-serif;padding:8px 12px;border-radius:99px}'});
 const filename=id+".png";
 await page.screenshot({path:path.join(DIR,filename),animations:"disabled"});
 manifest.push({id,path:"/faq/screenshots/"+filename,url:where,note:"Screenshot of real Next.js UI; synthetic API data in isolated Playwright browser"});
 console.log("SCREENSHOT",id);
}
try {
 await shot("global-search","/search?q=RAG","관련 FAQ");
 await shot("workspace-overview","/workspace","협업 공간");
 await shot("schedule-add-dialog","/workspace","협업 공간",async()=>{await page.getByRole("button",{name:/일정 추가/}).first().click();await page.getByText("어느 협업 일정인가요").first().waitFor()});
 await shot("workspace-task-detail","/workspace/101","모델 평가 기준 초안");
 await shot("workspace-due-talk","/workspace/101","영상 데이터 50건",async()=>{await page.getByRole("button",{name:"기한 얘기하기"}).first().click();await page.getByText("지금 기한").first().waitFor()});
 await shot("workspace-task-actions","/workspace/101","이미지 품질 점검 보고서");
 await shot("workspace-finished","/workspace","협업 공간",async()=>{await page.getByRole("button",{name:/완료/}).first().click();await page.getByText("협업 평가하기").first().waitFor()});
 await shot("collaboration-review","/workspace/102","4가지 항목 평가");
 await shot("collaboration-notifications","/workspace","협업 공간",async()=>{await page.getByRole("button",{name:/알림.*안 읽음/}).first().click();await page.getByText("평가 작성하기").first().waitFor()});
 await shot("private-inquiry","/community/new?visibility=private&category=support","비공개 문의");
 await writeFile(path.join(DIR,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 console.log("DONE",manifest.length);
} finally {await browser.close()}
