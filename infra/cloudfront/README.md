# CloudFront 주소 연결 함수 (B10)

S3에는 `/cases.html`, `/workspace/0.html` 같은 **파일**만 있어요. 사용자는 `/cases`, `/workspace/4` 같은 **주소**로 들어와요.
이 둘을 이어 주는 것이 `url-rewrite.js`(CloudFront Function)예요.

| 들어온 주소 | S3에서 꺼내는 파일 |
|---|---|
| `/` | `/index.html` |
| `/cases`, `/cases/` | `/cases.html` |
| `/workspace/4` | `/workspace/0.html` (번호는 화면이 주소창에서 다시 읽어요) |
| `/workspace/4.txt` | `/workspace/0.txt` (화면 이동 때 쓰는 데이터) |
| `/community/new` | `/community/new.html` (진짜 화면이 번호 화면보다 먼저) |
| `/없는-주소` | `/404.html` |
| `/_next/static/...`, `/photos/a.jpg` | 그대로 |

## 만드는 방법

```bash
cd frontend
npm run build:static      # out/ 과 build/cloudfront-url-rewrite.js 를 함께 만들어요
npm run preview:static    # 같은 함수로 http://127.0.0.1:4310 에서 미리 보기
```

- `url-rewrite.js`는 **틀**이에요. 빌드가 out/ 화면 목록을 채워서 `frontend/build/cloudfront-url-rewrite.js`를 만들어요.
- 사례·트렌드 글이 늘면 화면 목록도 바뀌므로, **배포 때마다 함수도 새 파일로 올려요**.
- 10KB(CloudFront Function 제한)를 넘으면 빌드가 멈춰요. 지금은 약 4.6KB예요.

## AWS에 연결할 때 (아직 하지 않음)

1. 함수 런타임은 `cloudfront-js-2.0`으로 만들어요.
2. 함수는 **기본(`*`) 동작의 Viewer request**에만 연결해요. `/api/v1/*` 동작에는 연결하지 않아요.
3. 올린 뒤 AWS 콘솔의 "테스트"나 `aws cloudfront test-function`으로 `/workspace/4` → `/workspace/0.html`을 한 번 확인한 다음 게시(publish)해요.
4. **CloudFront "오류 페이지(Custom error responses)"는 설정하지 않아요.**
   이 설정은 배포 전체에 적용돼요. API가 보내는 403·404 JSON까지 404.html로 바뀌면 화면이 오류 이유를 읽지 못해요.
   없는 주소는 이 함수가 `/404.html`로 보내요.

## 알고 있는 한계

- 없는 주소도 HTTP 상태는 **200**이에요(404.html의 내용만 보여 줘요). 404.html에는 `noindex`가 있어서 검색엔진에는 올라가지 않아요.
- 사용자가 직접 연 `/_next/...` 같은 없는 파일은 S3가 403을 돌려줘요.
