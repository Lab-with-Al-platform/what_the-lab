// 정적 빌드(S3)에서는 `/workspace/0` 같은 빈 화면 하나만 미리 만들어요.
// CloudFront가 `/workspace/4` 요청에도 이 화면을 보내 주므로, 실제 번호는 브라우저 주소에서 읽어요
// (lib/route-segment.ts, docs/aws-deployment/03-network-security.md CloudFront Function).
// 이 파일은 서버 페이지(generateStaticParams)에서 쓰므로 hook을 넣지 않아요.
export const STATIC_ROUTE_PLACEHOLDER = "0";

/** generateStaticParams에 쓰는 빈 화면 목록. 예: placeholderParams("id") → [{ id: "0" }] */
export function placeholderParams<Key extends string>(key: Key): Record<Key, string>[] {
  return [{ [key]: STATIC_ROUTE_PLACEHOLDER } as Record<Key, string>];
}
