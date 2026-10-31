const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const base=path.resolve(__dirname,"..");
const read = (file)=>fs.readFileSync(path.join(base,file),"utf8");

test("review contracts type-check independently of UI framework runtime",()=>{
  const files=[
    "src/lib/reviews.ts",
    "src/components/collaboration-review-card.tsx",
    "src/components/expert-review-summary.tsx",
    "src/components/expert-profile-view.tsx",
    "src/app/admin/reviews/page.tsx",
  ];
  for(const file of files){
    const out=ts.transpileModule(read(file),{
      fileName:file,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
      reportDiagnostics:true,
    });
    assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file);
  }
});

test("each collaborator is rated using four distinct 1-5 scales",()=>{
  const source=read("src/lib/reviews.ts");
  for(const key of ["expertise","communication","timeliness","quality"])assert.ok(source.includes(key));
  assert.match(source,/연구 준비도/);
  assert.match(source,/결과물 품질/);
  assert.match(source,/getReviewContext/);
  assert.match(source,/submitReview/);
  assert.match(source,/reportPublicReview/);
});

test("ratings are offered from finished workspace and collaboration detail, not expert search",()=>{
  const detail=read("src/components/workspace-detail-page.tsx");
  const home=read("src/components/workspace-home.tsx");
  const list=read("src/components/expert-search.tsx");
  assert.match(detail,/collab.status === "done" \|\| collab.status === "ended_early"/);
  assert.match(detail,/<CollaborationReviewCard collaborationId=\{collab.collaboration_id\}/);
  assert.match(home,/#review/);
  assert.match(home,/협업 평가하기/);
  assert.doesNotMatch(list,/submitReview|CollaborationReviewCard/);
});

test("validated rating is server-driven and protects duplicate submit UI",()=>{
  const form=read("src/components/collaboration-review-card.tsx");
  assert.match(form,/context.can_submit/);
  assert.match(form,/context.can_edit/);
  assert.match(form,/disabled=\{!valid \|\| busy\}/);
  assert.match(form,/aria-pressed=\{value === score\}/);
  assert.match(form,/maxLength=\{500\}/);
  assert.match(form,/중도 종료한 협업은 평가/);
  assert.match(form,/48시간/);
  assert.match(form,/30일/);
});

test("public expert profile distinguishes trusted ratings from local mock data",()=>{
  const summary=read("src/components/expert-review-summary.tsx");
  const profile=read("src/components/expert-profile-view.tsx");
  assert.match(summary,/DEMO · 가상 평가/);
  assert.match(summary,/실제 완료 협업 기반/);
  assert.match(summary,/부적절한 후기 신고/);
  assert.match(summary,/data.reviews.map/);
  assert.match(profile,/getPublicExpertReviews/);
  assert.match(profile,/sample\?\.profile \?\? liveProfile/);
  assert.match(profile,/reviewApiError/);
});

test("moderation route and admin nav enforce independent access from operations read",()=>{
  const nav=read("src/lib/admin-nav.ts");
  const shell=read("src/components/admin/admin-shell.tsx");
  const mod=read("src/app/admin/reviews/page.tsx");
  assert.match(nav,/\/admin\/reviews/);
  assert.match(shell,/can_moderate_reviews/);
  assert.match(mod,/\/reviews\/moderation\/reports/);
  assert.match(mod,/후기 비공개/);
  assert.match(mod,/신고 기각/);
});

test("review schema kept separate from old data and does not silently seed ratings",()=>{
  const sql=read("../database/init/025_create_collaboration_reviews.sql");
  assert.match(sql,/CREATE TABLE public.collaboration_review/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/uq_review_collaboration_side/);
  assert.doesNotMatch(sql,/INSERT INTO public.collaboration_review\s*\(/);
});
