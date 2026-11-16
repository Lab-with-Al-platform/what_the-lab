// S3용 정적 빌드: Windows·Linux 어디서든 같은 환경변수로 `next build`를 실행하고, 이미지를 줄여요.
// 결과는 frontend/out/ 에 생겨요. (docs/aws-deployment/09-deployment-roadmap.md B2)
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  // 화면과 API가 같은 주소(CloudFront)를 쓰므로 상대 주소로 고정해요.
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1",
};

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["next", "build"]);
run("node", [path.join(__dirname, "optimize-static-images.cjs")]);
