export interface Member {
  id: string;
  name: string;
}

export interface ExpenseParticipant {
  memberId: string;
  amount?: number; // AMOUNT 모드
  weight?: number; // WEIGHT 모드
}

export type SplitType = 'EQUAL' | 'AMOUNT' | 'WEIGHT';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  exchangeRate: number; // 1 외화 = N KRW
  payerId: string;
  participants: ExpenseParticipant[];
  splitType: SplitType;
  date: string; // ISO date string
}

export interface SettlementResult {
  from: string;
  to: string;
  amount: number; // KRW
}

export type DutchPayTab = 'members' | 'expenses' | 'settlement';
