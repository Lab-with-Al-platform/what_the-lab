// CloudFront Function (런타임 cloudfront-js-2.0, viewer-request) — 화면 주소를 S3 파일 이름으로 바꿔요.
// 연결 위치: CloudFront 기본(*) 동작에만. /api/v1/* 동작에는 연결하지 않아요.
// 자세한 이유: docs/aws-deployment/03-network-security.md 3.0, 09-deployment-roadmap.md B10
//
// 이 파일은 "틀"이에요. `npm run build:static`이 아래 두 목록을 out/ 화면 목록으로 채워서
// frontend/build/cloudfront-url-rewrite.js 로 저장해요. AWS에는 그 파일을 올려요.
//
// 예) /cases            → /cases.html
//     /workspace/4      → /workspace/0.html   (번호는 화면이 주소창에서 다시 읽어요)
//     /workspace/4.txt  → /workspace/0.txt    (화면 이동 때 쓰는 데이터 파일)
//     /없는-주소         → /404.html
//     /_next/static/... → 그대로 (파일 이름이 있는 주소)

var KNOWN_PAGES = {}; // @generated 실제로 있는 화면: { "/cases": true, ... }
var PLACEHOLDER_PAGES = []; // @generated 번호 자리에 0을 넣어 만든 화면: [ "/workspace/0", ... ]
var NOT_FOUND_PAGE = "/404";

function handler(event) {
  var request = event.request;
  request.uri = toS3Key(request.uri);
  return request;
}

// 주소 하나를 S3에 있는 파일 이름으로 바꿔요.
function toS3Key(uri) {
  var isPageData = uri.slice(-4) === ".txt";
  var page = isPageData ? uri.slice(0, -4) : uri;
  if (!isPageData && hasFileExtension(page)) return uri;

  var file = findPageFile(normalizePage(page));
  if (isPageData) return file + ".txt";
  return file + ".html";
}

// 마지막 칸에 점(.)이 있으면 js·css·이미지 같은 파일 주소예요.
function hasFileExtension(path) {
  var last = path.split("/").pop();
  return last.indexOf(".") !== -1;
}

// "/cases/" → "/cases", "/" → "/index"
function normalizePage(path) {
  var trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/index" : trimmed;
}

// 있는 화면 → 번호 화면(0) → 404 순서로 찾아요. /community/new 처럼 진짜 화면이 먼저예요.
function findPageFile(page) {
  if (KNOWN_PAGES[page] === true) return page;
  for (var i = 0; i < PLACEHOLDER_PAGES.length; i++) {
    if (matchesPlaceholder(page, PLACEHOLDER_PAGES[i])) return PLACEHOLDER_PAGES[i];
  }
  return NOT_FOUND_PAGE;
}

// "/workspace/4" 와 "/workspace/0" 처럼 칸 수가 같고, 0 자리를 뺀 나머지가 같으면 같은 화면이에요.
function matchesPlaceholder(page, placeholder) {
  var pageParts = page.split("/");
  var placeholderParts = placeholder.split("/");
  if (pageParts.length !== placeholderParts.length) return false;
  for (var i = 0; i < placeholderParts.length; i++) {
    if (placeholderParts[i] === "0") {
      if (pageParts[i] === "") return false;
    } else if (placeholderParts[i] !== pageParts[i]) {
      return false;
    }
  }
  return true;
}
