# CLAUDE.md - Vibe Web Starter

> FastAPI + SQLAlchemy 2.0 + React 19 + Tailwind 4 기반 풀스택 웹 애플리케이션 템플릿

## 핵심 원칙

이 프로젝트는 **"유지보수성 최우선"** 및 **"모듈화"**를 핵심 가치로 한다. 모든 제안은 `DOC/ARCHITECTURE.md`를 기반으로 하며, 아래 규칙을 엄격히 준수할 것.

## 절대 금지 (NEVER DO)

1. **아키텍처**: 레이어드 구조(`Router -> Service -> Repository`) 파괴, 도메인 간 내부 구현 직접 참조
2. **백엔드**: 비즈니스 로직에 절차지향 함수 사용(클래스 기반 필수), 직접 DB 쿼리(Service/Repo 필수), 타입 힌트 누락
3. **프론트**: 직접 `axios` 호출(`apiClient` 사용), 인라인 스타일(`Tailwind` 사용), `any` 타입 사용
4. **데이터베이스**: DB 콘솔/GUI에서 직접 스키마 수정. 마이그레이션 파일(`alembic/versions/`) 수정(Append-only 필수)

## 프로젝트 구조

```
vibe-web-starter/
├── DOC/                          # 프로젝트 문서
├── server/                       # 백엔드 (FastAPI)
│   ├── main.py                   # 진입점
│   └── app/
│       ├── core/                 # 핵심 인프라 (config, database, middleware, logging)
│       ├── shared/               # 공유 컴포넌트
│       │   ├── base/             # 추상 기반 클래스 (service, repository, calculator, formatter)
│       │   ├── exceptions/       # 커스텀 예외 계층
│       │   └── types/            # 공통 타입 (ServiceResult, PaginatedResult 등)
│       ├── domain/               # 비즈니스 도메인 (신규 도메인 추가 위치)
│       ├── examples/             # 참조 구현 (sample_domain)
│       └── api/v1/               # API 라우터 및 엔드포인트
├── client/                       # 프론트엔드 (React 19)
│   └── src/
│       ├── core/                 # 핵심 유틸 (api, hooks, errors, loading, store, layout)
│       └── domains/              # 도메인별 기능 (api, store, types, components, pages)
├── alembic/                      # DB 마이그레이션
├── tests/                        # 테스트 (unit/, integration/)
├── pyproject.toml                # Python 프로젝트 설정 (Black, isort, Ruff, mypy, pytest)
└── requirements.txt              # Python 의존성
```

## 계층별 책임 (Layer Responsibilities)

- **Router (API)**: HTTP 입출력 처리만 담당. 비즈니스 로직 금지
- **Service**: 도메인 로직 오케스트레이션 및 트랜잭션 관리. `BaseService` 상속 필수
- **Repository**: DB 조회 및 데이터 소스 접근. `BaseRepository` 상속 필수
- **Calculator**: 순수 함수(Side-effect Zero) 기반 계산. `BaseCalculator` 상속 필수
- **Formatter**: 응답 변환. `BaseFormatter` 상속 필수
- **Domain Separation**: 한 도메인은 다른 도메인의 `Service`나 `Repository`를 통해서만 통신

## 기술 스택

- **Backend**: FastAPI 0.109, SQLAlchemy 2.0 (async), Pydantic v2, asyncpg, Alembic, JWT (python-jose)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router DOM
- **Python**: 3.12+, 비동기 패턴(async/await) 사용
- **DB**: PostgreSQL (Supabase 기반)

## 개발 커맨드

```bash
# 백엔드 실행
pip install -r requirements.txt
python -m server.main

# 프론트엔드 실행
cd client && npm install && npm run dev

# 코드 품질 검사 (백엔드)
black server/
isort server/
ruff check server/
mypy server/

# 프론트엔드 린트
cd client && npm run lint

# 테스트
pytest
pytest -m unit
pytest -m integration

# DB 마이그레이션
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

## 코드 스타일 & 표준

- **Python**: SQLAlchemy 2.0 비동기 패턴, Pydantic v2 `BaseModel` 필수. Black(100자), isort, Ruff 준수
- **TypeScript**: React 19 패턴, `Zustand` 기반 도메인 상태 관리, `cn()` 유틸을 이용한 조건부 클래스 처리
- **Logging**: 모든 로그에 `request_id` 포함, 민감 정보(PW, 토큰 등) 로깅 절대 금지

## Database Workflow (Alembic)

스키마/데이터 변경 시 다음 절차를 엄격히 따를 것:
1. 변경 사항을 사용자에게 설명하고 승인 요청
2. `server/app/domain/{domain}/models/` 수정
3. `alembic revision --autogenerate -m "description"`으로 파일 생성
4. 생성된 마이그레이션 파일 검토 보고 후 `alembic upgrade head` 안내

## 신규 도메인 추가 절차

**백엔드** (`server/app/domain/{domain}/`):
1. `models/`, `schemas/`, `repositories/`, `calculators/`, `formatters/` 디렉토리 생성
2. SQLAlchemy 모델 구현 → Pydantic 스키마 작성
3. Repository, Calculator, Formatter, Service 구현 (각각 Base 클래스 상속)
4. `api/v1/endpoints/{domain}.py`에 엔드포인트 생성
5. `api/v1/router.py`에 라우터 등록
6. 참조: `server/app/examples/sample_domain/` 참고

**프론트엔드** (`client/src/domains/{domain}/`):
1. `api.ts`, `store.ts`, `types.ts`, `components/`, `pages/` 생성
2. API 함수 → Zustand 스토어 → 컴포넌트 → 페이지 순서로 구현
3. `App.tsx`에 라우트 등록
4. 참조: `client/src/domains/sample/` 참고

## 변경 제안 규칙

아키텍처나 스키마 변경 시 반드시 다음 형식으로 제안:
- **현재 상황**: 현재 코드/구조 설명
- **제안**: 변경 내용
- **영향 범위**: 영향받는 파일/모듈
- **리스크**: 잠재적 위험 요소

## 참조 문서

- `DOC/ARCHITECTURE.md`: 시스템 아키텍처 및 설계 원칙
- `DOC/DEVELOPMENT_GUIDE.md`: 도메인 추가, 코딩 규칙, 체크리스트
- `DOC/BEGINNER_QUICK_START.md`: 환경 설정부터 첫 실행까지
- `DOC/ALEMBIC_GUIDE.md`: DB 마이그레이션 관리
- `DOC/PROJECT_HANDOVER.md`: 프로젝트 전체 개요 및 운영 가이드
- `server/app/examples/sample_domain/`: 전체 패턴 참조 구현
