# 06. AI 챗봇 및 모델 인프라 아키텍처 (AI Chatbot & Model Infrastructure)

> **상태**: `[PROPOSED]`  
> **핵심 원칙**: 1) 웹 플랫폼 챗봇과 Discord 챗봇의 단일 공통 Chat Service 엔진 공유, 2) `ModelProvider` 인터페이스 추상화를 통한 벤더 종속 탈피, 3) 비용 효율적인 PostgreSQL + pgvector 하이브리드 RAG 구축, 4) 초기 자체 GPU 서버 미도입 및 관리형 API 우선 적용.

---

## 1. 공통 Chat Service 아키텍처

웹 플랫폼 내부 챗봇과 Discord 봇 인터페이스가 동일한 AI 오케스트레이션 및 비즈니스 컨텍스트를 공유하도록 중앙 집중형 Chat Service를 설계합니다.

```mermaid
flowchart TD
    WebUI["웹 플랫폼 챗봇 UI<br>(Next.js SSE 스트리밍)"] -->|HTTP / SSE| ChatAPI["Chat Service API<br>(backend/app/chat/)"]
    DiscordBot["Discord Gateway 봇<br>(Slash Command / DM)"] -->|Internal Call| ChatAPI

    subgraph ChatEngine ["공통 AI 오케스트레이터 (Chat Orchestrator)"]
        ChatAPI --> Guard["1. 가드레일 & 보안 검증<br>(프롬프트 인젝션 차단 / Rate Limit)"]
        Guard --> Session["2. 대화 세션 관리<br>(Redis 또는 PostgreSQL 세션 이력)"]
        Session --> RAGEngine["3. RAG Retrieval Engine"]
        RAGEngine --> PromptBuilder["4. 컨텍스트 증강 프롬프트 조립"]
        PromptBuilder --> ModelRouter["5. ModelProvider Router<br>(서킷 브레이커 / 폴백)"]
    end

    subgraph RetrievalLayer ["데이터 검색 계층 (RAG)"]
        RAGEngine --> HybridSearch["하이브리드 검색<br>(Full-text + pgvector 코사인 유사도)"]
        HybridSearch --> Cases["AI 협업 사례 DB"]
        HybridSearch --> Trends["AI 트렌드 DB"]
        HybridSearch --> Keywords["Keyword Master (분야/기술)"]
        HybridSearch --> Docs["연구/매뉴얼 문서"]
    end

    subgraph LLMLayer ["LLM Provider 계층"]
        ModelRouter -->|Primary (기본 추천)| Bedrock["Amazon Bedrock 경량 모델<br>(Nova Micro / Titan Text Lite / Llama 3.2 3B)"]
        ModelRouter -->|Fallback 1 (외부 API)| OpenAI["OpenAI API<br>(gpt-4o-mini)"]
        ModelRouter -->|Fallback 2 (외부 API)| Gemini["Google Gemini API<br>(gemini-2.5-flash)"]
        ModelRouter -.->|Legacy / 검증 필요| Deprecated["구형 모델 (Claude 3 계열)<br>⚠️ API 수명주기 검증 후 제외 판단"]
        ModelRouter -.->|Future| SelfHosted["자체 모델 서빙<br>(vLLM / SageMaker)"]
    end
```

---

## 2. `ModelProvider` 추상화 계층 설계

특정 LLM 공급자에 종속되지 않고, 장애 발생 시 자동으로 대체 모델로 전환(Failover)할 수 있도록 인터페이스를 추상화합니다.

```python
# [PROPOSED] backend/app/ai/provider.py
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from pydantic import BaseModel

class ChatMessage(BaseModel):
    role: str  # "system", "user", "assistant"
    content: str

class LLMResponse(BaseModel):
    content: str
    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, messages: list[ChatMessage], **kwargs) -> LLMResponse:
        """단일 완료 응답 생성"""
        pass

    @abstractmethod
    async def stream_response(self, messages: list[ChatMessage], **kwargs) -> AsyncGenerator[str, None]:
        """실시간 토큰 스트리밍 (웹 UI용)"""
        pass
```

### 2.1 공급자별 어댑터 구현 계획
1. **`BedrockProvider` (기본 추천)**:
   - AWS IAM Role을 사용하여 별도의 API 키 없이 `boto3` 라이브러리로 Amazon Bedrock 런타임 호출 (`bedrock-runtime`).
   - 추천 후보 모델:
     - `amazon.nova-micro-v1:0` (Bedrock 최신 초경량 모델: 입력 $0.035/1M, 출력 $0.140/1M).
     - `amazon.titan-text-lite-v1` (서울 리전 `ap-northeast-2` 직접 지원, 입력 $0.150/1M, 출력 $0.200/1M).
     - `meta.llama3-2-3b-instruct-v1:0` (Bedrock 서버리스 경량 오픈 가중치 모델: 입력 $0.150/1M, 출력 $0.200/1M).
2. **`OpenAIProvider` / `GeminiProvider` (대체 및 장애 복구)**:
   - Bedrock 리전 장애 또는 할당량 초과 시 자동으로 동작하는 서킷 브레이커 연동 (`gpt-4o-mini`, `gemini-2.5-flash`).
3. **구형 모델(Claude 3 계열) 처리 방침**:
   - 기존에 검토되었던 Claude 3 Haiku, Claude 3.5 Sonnet 등은 공급자의 API 수명 주기(EOL/Deprecation) 및 서울 리전 미지원/종료 리스크가 있으므로 신규 운영용 확정 후보에서 제외합니다. 도입 시점에 AWS Bedrock 공식 모델 수명 주기 페이지를 재검증합니다.

---

## 3. RAG (Retrieval-Augmented Generation) 아키텍처

별도의 외부 벡터 데이터베이스(Pinecone, Milvus 등)를 추가하지 않고, **PostgreSQL 17 내장 `pgvector` 확장을 활용하여 비용을 $0으로 유지**합니다.

### 3.1 하이브리드 검색 (Hybrid Search) 메커니즘
- **벡터 코사인 유사도 검색**: 의미적 유사성(Semantic Similarity) 기반 문서 발굴 (`embedding <=> query_vec`).
- **키워드 전문 검색 및 한국어 형태소 분석 한계 (`[UNVERIFIED]` 기술 검증 대상)**:
  - ⚠️ **주의**: 표준 PostgreSQL 및 Supabase 환경에는 `'korean'` 텍스트 검색 사전(`to_tsvector('korean', ...)`)이 기본 탑재되어 있지 않아 직접 실행 시 오류가 발생합니다.
  - **검증 대안**:
    1. **대안 A (권장)**: `pg_trgm` (N-gram 형태소 독립적 트라이그램 인덱스)을 활용한 부분 문자열 유사도 검색.
    2. **대안 B**: `to_tsvector('simple', ...)` 기반 공백 분절 FTS + `pgvector` 코사인 유사도의 하이브리드 결합.
    3. **대안 C**: `mecab-ko` 또는 `nori` 형태소 분석기 Docker 빌드 추가 (유지보수 복잡도 증가).
  - 따라서 한국어 전문 검색 구현 방식은 프로덕션 적용 전 **별도의 기술 검증(PoC) 필수 과제**로 지정합니다.
- **RRF (Reciprocal Rank Fusion)**: 벡터 점수와 키워드 순위를 결합하여 최적의 상위 3~5개 컨텍스트 청크 추출.

### 3.2 데이터 보안 및 권한 격리 (Access Control)
- **공개 데이터**: 승인된 AI 협업 사례, 공개 AI 트렌드, Keyword Master 용어집 → 모든 사용자/봇이 검색 가능.
- **비공개 데이터**: 특정 연구자-전문가 간의 협업 워크스페이스 대화, 비공개 연구 문서 → 세션 사용자 ID 및 프로젝트 참여 권한(`workspace_rules.py`)을 검증한 후 일치하는 데이터만 벡터 검색 필터(`metadata @> '{"project_id": ...}'`)에 포함.

---

## 4. 용도별 AI 모델 분리 전략

모든 작업에 비싼 모델을 일괄 적용하지 않고, 작업 복잡도에 따라 모델을 엄격히 분리합니다.

| 용도 구분 | 요구 특성 | 권장 후보 모델 | 이유 및 수명주기 검증 요건 |
|---|---|---|---|
| **실시간 챗봇 대화 (웹/Discord)** | 빠른 응답 속도 (TTFT < 1초), 대화형 자연스러움, 낮은 토큰 비용 | **Amazon Nova Micro** / **Titan Text Lite** (Bedrock) 또는 **gpt-4o-mini** | 100만 토큰당 $0.035~$0.150의 극초저비용으로 월 수만 건 대화에도 비용 부담 최소화 |
| **RAG 텍스트 임베딩** | 다국어/한국어 벡터 표현력, 일관된 차원 | **Amazon Titan Embeddings G1 - Text** (또는 OpenAI text-embedding-3-small) | 1,536차원, 백만 토큰당 $0.02의 극저비용 |
| **연구 사례/트렌드 심층 분석** | 복잡한 논문 독해, 근거 사실성 검증, 12점 평가 산출 | **외부 최신 Frontier 모델** (실행 시점 최신 API 적용) | 특정 구형 모델에 고정하지 않고, 파이프라인 전송 계약(`insight_transfer_v1`)에만 의존하여 유연성 확보 |

---

## 5. 비용 제어, 사용량 제한 및 AI 보안 가드레일

1. **토큰 비용 추적 및 로깅**:
   - 모든 AI 요청마다 입/출력 토큰 수와 예상 비용을 `analytics_events` 테이블에 기록.
   - 사용자별 / 채널별 일일 사용량 한도(Rate Limit: 예: 일반 회원 일 20회) 설정.
2. **프롬프트 인젝션(Prompt Injection) 방어**:
   - 시스템 프롬프트에 '지시 사항 무시(Ignore previous instructions)' 거부 규칙 명시.
   - 사용자 입력에서 시스템 메타 태그(`{{`, `}}`, `<system>`, `[INST]`) 이스케이프 처리.
3. **서킷 브레이커 (Circuit Breaker)**:
   - 연속 3회 이상 5xx 에러 또는 응답 지연(5초 초과) 발생 시, 1분간 Fallback Provider로 자동 우회.

