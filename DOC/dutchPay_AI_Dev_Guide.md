# 💰 여행/모임 정산 (Dutch Pay) AI 개발 가이드

이 가이드는 AI 에이전트(Antigravity)가 '여행/모임 정산' 기능을 완벽하게 구현할 수 있도록 설계된 지침서입니다. 기술적 세부 사항, 데이터 구조, 비즈니스 로직 및 단계별 구현 계획을 포함합니다.

---

## 🚀 프로젝트 개요
- **목적**: 여행 총무가 복잡한 지출 내역을 관리하고, 환율 및 차등 정산이 적용된 최적의 정산 결과를 도출하는 웹 애플리케이션 개발.
- **핵심 가치**: 사용자 친화적인 UI, 데이터 신뢰성(로컬 스토리지), 정산의 단순화(최소 송금 경로).

## 🛠 기술 스택 (Technical Stack)
- **Frontend**: React (Functional Components), TypeScript
- **State Management**: React Context API 또는 전역 상태 관리 (필요 시)
- **Persistence**: LocalStorage (useEffect 기반 자동 저장)
- **Styling**: Vanilla CSS (Premium Aesthetics 적용)
- **Utils**: `lucide-react` (아이콘), `date-fns` (날짜 관리)

## 📊 데이터 구조 (Data Schema)

AI는 아래 인터페이스를 기준으로 코드를 작성해야 합니다.

```typescript
// 멤버 정보
interface Member {
  id: string;
  name: string;
}

// 지출 내역
interface Expense {
  id: string;
  title: string;        // 항목명 (예: 저녁 식사)
  amount: number;       // 금액
  currency: string;     // 통화 (KRW, USD, JPY 등)
  exchangeRate: number; // 당시 환율
  payerId: string;      // 결제자 ID
  participants: {
    memberId: string;
    amount?: number;    // 차등 정산 시 개별 금액
    weight?: number;    // 비중 기반 정산 시 가중치
  }[];
  splitType: 'EQUAL' | 'AMOUNT' | 'WEIGHT'; // 균등, 직접 금액, 비중
  date: string;         // ISO 날짜
}

// 정산 결과
interface SettlementResult {
  from: string;    // 보내는 사람 이름
  to: string;      // 받는 사람 이름
  amount: number;  // 금액
}
```

## 🧩 핵심 기능 상세 (Functional Specs)

### 1. 멤버 및 회비 관리
- 멤버 추가/삭제 시 모든 지출 내역의 참여자 명단과 동기화되어야 함.
- **초기 회비 설정**: 전체 예산 및 기초 자금 관리 기능.

### 2. 지출 내역 기록 및 차등 정산 (Differential Settlement)
- **균등 정산 (EQUAL)**: 전체 금액을 참여 인원수로 나눔 (기본값).
- **개별 금액 정산 (AMOUNT)**: 각 참여자가 지불해야 할 금액을 직접 입력 (합계가 지출 금액과 일치해야 함).
- **비중 정산 (WEIGHT)**: 각 참여자별 비중(예: 1:2:1)을 설정하여 금액 배분.
- **편의 기능**: 최신 입력 항목 상단 노출, 내역 삭제 기능.

### 3. 정산 알고리즘 (Settlement Logic)
- **복합 정산**: 항목별로 설정된 `splitType`에 따라 개별 멤버의 부담액을 계산하고 이를 합산하여 멤버별 순 지출액(Net Balance) 산출.
- **최소 송금 경로 (Min Cash Flow)**: 
  - 각 멤버의 `(총 지출액 - 본인 부담액)`을 계산하여 Net Balance 산출.
  - 양수인 사람(받을 돈)과 음수인 사람(줄 돈)을 매칭하여 송금 횟수를 최소화하는 로직 적용.

### 4. 데이터 영속성 (Persistence)
- 앱 초기 로드 시 LocalStorage에서 데이터를 복구.
- 상태(Members, Expenses)가 변경될 때마다 LocalStorage에 자동 직렬화 저장.
- **Import/Export**: 현재 전역 상태를 JSON 파일로 다운로드하고, 파일을 업로드하여 상태를 복구하는 유틸리티 구현.

## 🎨 UI/UX 및 디자인 시스템
`frontend-design` 및 `ui-ux-pro-max-skill`을 준수하여 구현합니다.

- **Dashboard**: 상단에 [총 예산 | 총 지출 | 남은 잔액]을 카드로 배치하여 가시성 확보.
- **Visuals**: Modern Glassmorphism, Subtle Gradients, Smooth Transitions.
- **Sharing**: 정산 결과를 "카카오톡 공유용" 텍스트 템플릿으로 변환하여 클립보드에 복사하는 버튼 제공.

## 📅 구현 로드맵 (Roadmap)

1.  **Phase 1: Foundation (기초)** 
    - 기초 데이터 타입 정의 및 전역 상태(Context) 구성.
    - LocalStorage 연동 및 JSON Export/Import 로직 구현.
2.  **Phase 2: Member & Budget (멤버/관리)**
    - 멤버 CRUD 및 기초 자금 설정 UI 개발.
3.  **Phase 3: Expense Management (지출)**
    - 지출 내역 입력 폼 및 리스트 뷰 개발 (환율 계산 포함).
    - **차등 정산 UI 모달/섹션 추가.**
4.  **Phase 4: Settlement AI (정산)**
    - 최소 송금 경로 알고리즘 결과물 시각화.
    - 공유용 텍스트 생성기 구현.
5.  **Phase 5: Polishing (마무리)**
    - 애니메이션 추가 및 미세 UI 조정 (Responsive Design).

---
**주의 사항**: 모든 코드 작성 시 에러 핸들링(잘못된 금액 입력 등)을 포함하고, `aria-label`을 사용하여 접근성을 고려할 것.
