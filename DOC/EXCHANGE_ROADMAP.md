# 환율 계산기 (Exchange Calculator) 로드맵

> FastAPI + React 19 + Tailwind CSS 4 기반 환율 계산 도메인 구현 계획

---

## 개요

사용자가 여러 통화를 동시에 비교하고, 기준 통화 기반으로 실시간 환산 금액을 확인할 수 있는 환율 계산기.
국기 이모지, 통화 코드, 환산 금액을 한 화면에 표시하며 오프라인 캐시를 통한 오프라인 지원을 포함한다.

---

## 기술 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 환율 API | [frankfurter.app](https://www.frankfurter.app) | 무료, 인증 불필요, ECB 데이터 기반 |
| 국기 표시 | 유니코드 이모지 플래그 | 외부 라이브러리 불필요, 범용 지원 |
| 환산 계산 위치 | 프론트엔드 | 키 입력마다 API 호출 방지, 반응성 확보 |
| 환율 캐시 | DB(백엔드) + localStorage(프론트) | 오프라인 지원, TTL 기반 자동 갱신 |
| 환율 갱신 주기 | 1시간 TTL | 실시간 필요 없음, API 부하 최소화 |

---

## 프로젝트 구조

### 백엔드 (`server/app/domain/exchange/`)

```
exchange/
├── models/
│   ├── exchange_rate.py         # 환율 캐시 DB 모델 (base/target/rate/updated_at)
│   └── currency.py              # 통화 메타 정보 (code, name, flag_emoji, symbol)
├── schemas/
│   ├── exchange_rate.py         # 환율 요청/응답 Pydantic 스키마
│   └── currency.py              # 통화 요청/응답 Pydantic 스키마
├── repositories/
│   └── exchange_rate_repository.py   # DB CRUD (BaseRepository 상속)
├── calculators/
│   └── exchange_calculator.py        # 순수 환산 계산 로직 (BaseCalculator 상속)
├── formatters/
│   └── exchange_formatter.py         # 응답 포맷 변환 (BaseFormatter 상속)
└── services/
    └── exchange_service.py           # 외부 API 호출 + 캐시 + 계산 오케스트레이션 (BaseService 상속)
```

### 프론트엔드 (`client/src/domains/exchange/`)

```
exchange/
├── types.ts                     # Currency, ExchangeRate, ConvertResult 타입 정의
├── api.ts                       # apiClient 기반 API 함수
├── store.ts                     # Zustand 스토어 (통화 리스트, 입력 금액, 기준통화)
├── components/
│   ├── CurrencyRow.tsx          # 국기 + 코드 + 환산금액 단일 행
│   ├── CurrencyList.tsx         # 스크롤 가능한 통화 리스트
│   ├── NumericKeypad.tsx        # 하단 고정 숫자 키패드
│   ├── CurrencySelector.tsx     # 통화 추가/변경 모달
│   └── StatusBar.tsx            # 오프라인 상태 + 마지막 업데이트 표시
└── pages/
    └── ExchangePage.tsx         # 전체 페이지 조합 및 레이아웃
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/v1/exchange/currencies` | 지원 통화 목록 (코드, 이름, 국기 이모지) |
| `GET` | `/api/v1/exchange/rates?base=USD` | 기준통화 기준 전체 환율 반환 |
| `POST` | `/api/v1/exchange/convert` | 금액 환산 (base, target, amount) |

---

## Phase별 구현 계획

---

### Phase 1 — 백엔드 도메인 구축

**목표**: 외부 환율 API 연동 + DB 캐시 + 계산 로직 완성

- [ ] `ExchangeRate` DB 모델 정의 (`base_currency`, `target_currency`, `rate`, `fetched_at`)
- [ ] `Currency` 메타 테이블 정의 (`code`, `name`, `flag_emoji`, `symbol`)
- [ ] Alembic 마이그레이션 파일 생성 및 적용
- [ ] `ExchangeRateRepository` 구현 (저장, 조회, TTL 기반 캐시 유효성 확인)
- [ ] `ExchangeCalculator` 구현 (기준통화 → 다중 통화 환산 순수 함수)
- [ ] `ExchangeFormatter` 구현 (소수점, 천 단위 구분, 통화 기호 포맷)
- [ ] `ExchangeService` 구현
  - 캐시 유효성 확인 (TTL 1시간)
  - 만료 시 frankfurter.app API 호출 후 DB 갱신
  - 환산 계산 위임 및 결과 반환
- [ ] API 엔드포인트 3개 구현
- [ ] `api/v1/router.py`에 exchange 라우터 등록

---

### Phase 2 — 프론트엔드 도메인 구축

**목표**: 기본 UI 완성 (통화 리스트 + 키패드 + 상태 표시)

- [ ] `types.ts` 정의 (`Currency`, `ExchangeRate`, `ConvertResult`, `KeypadAction`)
- [ ] `api.ts` 구현 (currencies, rates, convert API 함수)
- [ ] Zustand `store.ts` 구현
  - 상태: `currencyList`, `baseAmount`, `baseCurrency`, `rates`, `lastUpdated`, `isOffline`
  - 액션: `setBaseAmount`, `setBaseCurrency`, `addCurrency`, `removeCurrency`, `reorderCurrency`, `fetchRates`
- [ ] `CurrencyRow` 컴포넌트 (국기 이모지, 코드, 드롭다운, 환산 금액, 기준통화 하이라이트)
- [ ] `CurrencyList` 컴포넌트 (스크롤, 통화 추가 버튼)
- [ ] `NumericKeypad` 컴포넌트 (C, ⇄, +−×÷, 0~9, ., ⌫)
- [ ] `StatusBar` 컴포넌트 (오프라인 배너, 마지막 업데이트 시각)
- [ ] `ExchangePage` 조합
- [ ] `App.tsx`에 `/exchange` 라우트 등록
- [ ] 메인 네비게이션에 Exchange 진입 링크 추가

---

### Phase 3 — 오프라인 지원 및 캐시

**목표**: 네트워크 없이도 동작하는 오프라인 모드

- [ ] localStorage에 마지막 환율 데이터 + 갱신 시각 저장
- [ ] 앱 로드 시 캐시 유효성 확인 후 오프라인 모드 전환
- [ ] `StatusBar`에 오프라인 배너 + 마지막 업데이트 시각 표시
- [ ] 네트워크 복구 시 자동 환율 갱신

---

### Phase 4 — UX 개선

**목표**: 사용성 향상 및 추가 기능

- [ ] 통화 추가/삭제 기능 (+ 버튼, 스와이프 삭제)
- [ ] 통화 순서 드래그 & 드롭 재정렬
- [ ] 통화 검색 기능 (국가명 / 통화코드)
- [ ] 사칙연산 지원 (키패드의 +−×÷ 버튼 활성화)
- [ ] 스왑 기능 (⇄ 버튼으로 기준통화 전환)
- [ ] 모바일 퍼스트 반응형 레이아웃 (최적화 기준: 430px 이하)

---

## 구현 순서 요약

```
[Phase 1] DB 모델 → Alembic 마이그레이션
          → Repository → Calculator → Formatter → Service → Router

[Phase 2] types → api → store
          → CurrencyRow → CurrencyList → NumericKeypad → StatusBar
          → ExchangePage → App.tsx 라우트 등록

[Phase 3] localStorage 캐시 → 오프라인 모드 감지 → StatusBar 연동

[Phase 4] 통화 추가/삭제 → 재정렬 → 검색 → 사칙연산 → 스왑
```

---

## 참조

- 외부 API: [https://www.frankfurter.app/docs](https://www.frankfurter.app/docs)
- 기존 도메인 참조: `server/app/examples/sample_domain/`
- 프론트 도메인 참조: `client/src/domains/sample/`
- 아키텍처 원칙: `DOC/ARCHITECTURE.md`
- 개발 가이드: `DOC/DEVELOPMENT_GUIDE.md`
