# [정산 시스템 가이드] 고유 ID 기반 실시간 공유 시스템 (DutchPay-Sync)

## 1. 개요 (Executive Summary)
본 가이드는 기존의 로컬 전용 정산 기능을 확장하여, **고유 UUID 기반의 공유 URL**을 통해 실시간으로 다수가 협업할 수 있는 정산 시스템 구축을 위한 설계서입니다.

- **핵심 요구사항**:
  - 기존 로컬 정산 기능(`localStorage` 기반)은 그대로 유지.
  - '실시간 공유' 선택 시 고유 UUID가 포함된 URL 발급.
  - 해당 URL에 접속하는 누구나 실시간으로 정산 데이터를 조회 및 공동 편집 가능.

---

## 2. 하이브리드 아키텍처 (Hybrid Strategy)

### 2.1. 데이터 저장 모델 (Hybrid Storage)
- **로컬 전담 (Private Mode)**: URL에 ID가 없을 때 작동. Zustand `persist` 미들웨어를 통해 브라우저 로컬 저장소 활용.
- **서버 연동 (Sync Mode)**: '공유하기' 활성화 시 작동. 모든 데이터 변경 사항이 API를 통해 PostgreSQL(또는 Supabase) DB에 실시간 반영.

### 2.2. 데이터 스키마 정의 (DB Model)
**테이블: `settlement_groups`**
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | UUID | 고유 공유 식별자 (URL에 사용) |
| `title` | TEXT | 정산 제목 |
| `members` | JSONB | 참여자 목록 (정적 배열: `{id, name}`) |
| `expenses` | JSONB | 지출 내역 목록 (객체 배열) |
| `budget` | INTEGER | 초기 예산 |
| `created_at` | TIMESTAMPTZ | 생성 일시 |

---

## 3. 핵심 로직 상세 (Implementation Details)

### 3.1. 공유 프로세스 (Sharing Workflow)
1. **[발급]**: 사용자가 '공유 URL 만들기' 클릭 시 서버로 현재 데이터 전송 (`POST /api/v1/dutchpay`).
2. **[반환]**: 서버에서 UUID를 생성하여 저장 후 UUID 반환.
3. **[이동]**: 클라이언트는 `/dutch-pay/{uuid}` 경로로 라우팅 이동.
4. **[참여]**: 타인이 해당 URL 접속 시, `uuid` 파라미터를 감지하여 서버로부터 최신 데이터를 페칭(Fetch).

### 3.2. 실시간 동기화 전략 (Real-time Sync)
- **조회**: URL에 `uuid`가 존재하면 로컬 상태 대신 서버 응답 데이터를 Zustand 스토어에 주입.
- **수정**: 지출 추가/수정 시 즉시 `PATCH /api/v1/dutchpay/{uuid}` API 호출.
- **실시간성 확보**: (선택 1) Polling - 5초 주기로 데이터 재로드 / (선택 2) WebSockets - FastAPI WebSocket을 통한 즉각 푸시.

### 3.3. 히스토리 추적 (Visit History)
- 사용자가 접속했던 공유 정산 방의 UUID 목록을 `localStorage`('visited-groups')에 저장하여 메인 화면에서 '최근 정산' 대시보드로 노출.

---

## 4. UI/UX 구성 요소

### 4.1. 메인 대시보드 (Dashboard)
- `[+] 새 정산 시작` (전용 로컬 정산)
- `[🚀] 최근 공유 정산 리스트` (LocalStorage에 저장된 UUID 기반)

### 4.2. 정산 상세 페이지
- **공유 버튼**: 현재 URL을 클립보드에 복사.
- **상태 인디케이터**: '실시간 동기화 중' 및 '로컬 저장 모드' 구분 표시.

---

## 5. 단계별 구현 계획 (Phased Roadmap)
1.  **[1단계] 백엔드 기반 조성**: FastAPI 도메인 내 `dutchpay` 라우터 및 UUID 기반 DB 테이블 생성.
2.  **[2단계] 라우팅 분기 구현**: React Router에서 UUID 유무에 따라 데이터 로드 소스(Local vs API)를 결정하는 훅 구현.
3.  **[3단계] 동기화 로직 연동**: 데이터 변경 시 API를 호출하는 비동기 Action(Zustand) 구현.
4.  **[4단계] 공유 기능 가독성 개선**: 공유 URL 복사 버튼 및 알림 UI 추가.

---
*본 문서는 AI 에이전트가 정산 시스템 고도화를 위한 프롬프트로 활용할 수 있도록 최적화되었습니다.*

