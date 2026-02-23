import type { Member, Expense, SettlementResult } from './types';

/** 각 멤버의 net balance(KRW) 계산 후 최소 송금 경로 산출 */
export function calculateSettlement(members: Member[], expenses: Expense[]): SettlementResult[] {
  const balance: Record<string, number> = {};
  members.forEach((m) => {
    balance[m.id] = 0;
  });

  for (const expense of expenses) {
    const totalKRW = expense.amount * expense.exchangeRate;
    const { participants, splitType, payerId } = expense;

    if (!participants.length) continue;

    // 결제자에게 전액 크레딧
    balance[payerId] = (balance[payerId] ?? 0) + totalKRW;

    // 참여자별 부담액 차감
    if (splitType === 'EQUAL') {
      const share = totalKRW / participants.length;
      for (const p of participants) {
        balance[p.memberId] = (balance[p.memberId] ?? 0) - share;
      }
    } else if (splitType === 'AMOUNT') {
      for (const p of participants) {
        balance[p.memberId] = (balance[p.memberId] ?? 0) - (p.amount ?? 0) * expense.exchangeRate;
      }
    } else if (splitType === 'WEIGHT') {
      const totalWeight = participants.reduce((s, p) => s + (p.weight ?? 1), 0);
      if (totalWeight > 0) {
        for (const p of participants) {
          balance[p.memberId] = (balance[p.memberId] ?? 0) - (totalKRW * (p.weight ?? 1)) / totalWeight;
        }
      }
    }
  }

  const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  // 받을 사람(양수) / 보낼 사람(음수) 분리
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, bal] of Object.entries(balance)) {
    if (bal > 0.5) creditors.push({ id, amount: bal });
    else if (bal < -0.5) debtors.push({ id, amount: -bal });
  }

  // 탐욕 매칭으로 최소 송금 경로 생성
  const results: SettlementResult[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    results.push({
      from: nameMap[debtor.id] ?? debtor.id,
      to: nameMap[creditor.id] ?? creditor.id,
      amount: Math.round(amount),
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.5) i++;
    if (creditor.amount < 0.5) j++;
  }

  return results;
}

export function getTotalExpenseKRW(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount * e.exchangeRate, 0);
}

export interface MemberStat {
  id: string;
  name: string;
  paid: number;  // 직접 결제한 금액 (KRW)
  owed: number;  // 실제 부담해야 할 금액 (KRW)
  net: number;   // paid - owed (양수 = 받을 돈, 음수 = 줄 돈)
}

/** 멤버별 결제·부담·차액 계산 */
export function getMemberStats(members: Member[], expenses: Expense[]): MemberStat[] {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  members.forEach((m) => {
    paid[m.id] = 0;
    owed[m.id] = 0;
  });

  for (const expense of expenses) {
    const totalKRW = expense.amount * expense.exchangeRate;
    const { participants, splitType, payerId } = expense;

    paid[payerId] = (paid[payerId] ?? 0) + totalKRW;

    if (!participants.length) continue;

    if (splitType === 'EQUAL') {
      const share = totalKRW / participants.length;
      for (const p of participants) {
        owed[p.memberId] = (owed[p.memberId] ?? 0) + share;
      }
    } else if (splitType === 'AMOUNT') {
      for (const p of participants) {
        owed[p.memberId] = (owed[p.memberId] ?? 0) + (p.amount ?? 0) * expense.exchangeRate;
      }
    } else if (splitType === 'WEIGHT') {
      const totalWeight = participants.reduce((s, p) => s + (p.weight ?? 1), 0);
      if (totalWeight > 0) {
        for (const p of participants) {
          owed[p.memberId] = (owed[p.memberId] ?? 0) + (totalKRW * (p.weight ?? 1)) / totalWeight;
        }
      }
    }
  }

  return members.map((m) => ({
    id: m.id,
    name: m.name,
    paid: paid[m.id] ?? 0,
    owed: owed[m.id] ?? 0,
    net: (paid[m.id] ?? 0) - (owed[m.id] ?? 0),
  }));
}

/** KRW 포맷 */
export function fmtKRW(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`;
}
