// 백엔드(FastAPI) 주소와, 요청을 보내는 작은 도우미입니다.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// 백엔드가 { detail: "..." } 로 보낸 에러 문구를 그대로 화면에 쓰기 위한 에러
export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** 백엔드에 요청하고 JSON을 돌려줍니다. 실패하면 백엔드의 에러 문구로 ApiError를 던집니다. */
export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // 로그인 쿠키(JWT)를 같이 보냅니다.
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    // 입력 검증 오류는 목록으로 오기도 합니다. 객체를 화면에 그대로 출력하지 않습니다.
    const message = typeof detail === "string" ? detail
      : Array.isArray(detail) ? detail.map((item: { loc?: string[]; msg?: string }) =>
        `${item.loc?.join(" → ") ?? "입력"}: ${item.msg ?? "값을 확인해 주세요"}`).join("\n")
      : "잠시 후 다시 시도해 주세요";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
