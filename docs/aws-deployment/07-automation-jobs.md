# 07. 자동 콘텐츠 운영 파이프라인 (Automated Content Operations) — 개정판

> **상태**: `[CONFIRMED]` (Phase 0~6 구현 코드 [`backend/app/insights/`](file:///backend/app/insights/) 전면 재사용)  
> **핵심 원칙**: 1) 기존 `insight_transfer_v1` 및 Receipt 접수 계약 100% 보존, 2) LangGraph 신규 도입 배제(보류 결론 유지), 3) 외부 Claude 클라우드 정기 작업과 AWS Staging의 완벽한 권한 분리.

---

## 1. 기존 구현 자산(Phase 0~6)의 전면 재사용 현황

기존 QA 및 개발 문서를 통해 확인된 모듈들을 수정 없이 그대로 AWS 배포의 핵심 자산으로 편입합니다 (`[CONFIRMED]`):

| 컴포넌트 | 구현 파일 | 핵심 기능 및 검증 결과 |
|---|---|---|
| **Insight Transfer v1** | `app/insights/transfer_contract.py` | Markdown 본문, 용어 풀이, 12점 평가, 서지 정보, SHA-256 검증 |
| **전송 묶음 접수 이력 (Receipt)** | `022_add_transfer_receipts.sql`, `transfer_staging.py` | `(trust_scope, bundle_id)` 기반 고유성 보장, 중복 바이트 replay, 내용 불일치 충돌(409) 거절, `SAVEPOINT` 원자성 |
| **역할 및 권한 계약** | `app/insights/agent_contract.py` | coordinator, researcher, evidence_checker, case_writer, trend_writer, editor 역할 고정, 자칭 권한 거절 |
| **작업 흐름 및 중단·재개** | `app/insights/agent_flow.py`, `agent_checkpoint.py` | 고정 분기 파이프라인, `agent_runs` 테이블을 통한 프로세스 외부 상태 저장 및 임대(lease) 락 |
| **관리자 검토 연결** | `app/insights/agent_review.py` | `pending_review` 상태 적재 후 관리자 화면(`/admin/insights`)에서 원고 수정 및 최종 승인 연결 |
| **LangGraph 비교 실험** | `docs/qa/INSIGHT_AGENT_PHASE_6_RESULT.md` | **정식 도입 보류 확정** (기존 Python 흐름으로 충분, RAM checkpointer의 운영 무용성, 불필요한 의존성 배제) |

---

## 2. 외부 Claude 정기 작업과 AWS 반입 경계

```mermaid
flowchart TD
    subgraph ExternalExec ["1. 외부 실행기 (Claude 예약 작업)"]
        Schedule["정기 스케줄 트리거"] --> Collect["학술 논문 수집 (OpenAlex / arXiv)"]
        Collect --> DraftGen["외부 LLM 심층 분석<br>(근거 검토 / 12점 평가 / 용어 풀이)"]
        DraftGen --> V1File["insight_transfer_v1 규격<br>JSON 결과 파일 생성"]
    end

    subgraph GitHubPR ["2. 코드 저장소 전달 경로"]
        V1File -->|1. [PROPOSED] Data PR 생성<br>(data/insight_incoming/*.json)| GitPR["GitHub 저장소 PR 생성"]
    end

    subgraph TrustedRunner ["3. 신뢰하는 반입 실행기 (Trusted Ingestion Runner)"]
        GitPR -->|2. [PROPOSED] PR 오픈/머지 트리거| ActionsRunner["GitHub Actions CI 러너<br>(오프라인 스키마·해시 검증)"]
    end

    subgraph AWSBackend ["4. AWS Backend Staging Gate (`[CONFIRMED]`)"]
        ActionsRunner -->|3. [PROPOSED] 안전한 Staging 적재 호출| StagingProc["transfer_staging.py 실행"]
        
        StagingProc --> Receipt["Receipt 접수 이력 확인<br>(중복 replay / 충돌 409)"]
        Receipt --> StagingDB[("PostgreSQL DB<br>(Candidate: pending_review 적재)")]
    end

    subgraph AdminGate ["5. 휴먼 인 더 루프 관리자 승인 (`[CONFIRMED]`)"]
        StagingDB --> AdminUI["관리자 인사이트 워크스페이스<br>(frontend /admin/insights)"]
        AdminUser["인사이트 관리자"] -->|4. 원문 대조 및 원고 승인| AdminUI
        AdminUI --> Publish["게시 엔진 (editorial.py)<br>-> 공개본 카탈로그 노출"]
    end
```

### 2.1 단계별 구현 상태 및 보안 격리 원칙
- **구현 상태 구분**:
  - `[CONFIRMED]` (구현 완료): 규격 검증 계약(`transfer_contract.py`), 접수 이력 테이블(`transfer_receipts`), 스테이징 처리기(`transfer_staging.py`), 관리자 검토 UI(`agent_review.py`).
  - `[PROPOSED]` (외부 연동 제안): 외부 Claude 클라우드 예약 스케줄러 설정, GitHub PR 자동 생성 봇, 머지 시 실행되는 GitHub Actions 신뢰 반입 워크플로.
- **보안 격리 원칙**:
  - **DB 키 미부여**: 외부 Claude 실행기에는 AWS 운영 PostgreSQL의 접속 정보(`DATABASE_URL`)나 관리자 쿠키를 절대 제공하지 않습니다.
  - **자동 게시 불가**: 외부에서 인입된 원고는 100% `pending_review` 상태로만 저장되며, 관리자의 명시적 승인 전에는 일반 사용자 화면에 절대 노출되지 않습니다.

---

## 3. 대체 배치 실행 엔진 (Claude 불가 시의 1차 대체제)

만약 Claude 클라우드 예약 기능의 실행 안정성이 부족하거나 사용이 불가능할 경우:

1. **1차 대체제: GitHub Actions Scheduled Workflow (권장)**:
   - 추가 AWS 인프라 비용 $0.
   - 정해진 cron 스케줄에 따라 GitHub Actions 러너에서 논문 수집 스크립트 실행 후, 결과 JSON을 커밋하여 PR 생성.
2. **2차 대체제: AWS EventBridge + ECS Run Task**:
   - 트래픽과 데이터 수집량이 본격적으로 증가하는 Phase 3 이후 검토.
