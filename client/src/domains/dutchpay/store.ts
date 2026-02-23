import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Member, Expense } from './types';

export function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface DutchPayState {
  members: Member[];
  expenses: Expense[];
  initialBudget: number;

  addMember: (name: string) => void;
  deleteMember: (id: string) => void;
  setInitialBudget: (amount: number) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  importData: (data: Pick<DutchPayState, 'members' | 'expenses' | 'initialBudget'>) => void;
  reset: () => void;
}

export const useDutchPayStore = create<DutchPayState>()(
  persist(
    (set) => ({
      members: [],
      expenses: [],
      initialBudget: 0,

      addMember: (name) =>
        set((s) => ({
          members: [...s.members, { id: genId(), name: name.trim() }],
        })),

      deleteMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          expenses: s.expenses.map((e) => ({
            ...e,
            participants: e.participants.filter((p) => p.memberId !== id),
            payerId: e.payerId === id ? '' : e.payerId,
          })),
        })),

      setInitialBudget: (amount) => set({ initialBudget: amount }),

      addExpense: (expense) =>
        set((s) => ({
          expenses: [{ ...expense, id: genId() }, ...s.expenses],
        })),

      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      importData: (data) => set(data),

      reset: () => set({ members: [], expenses: [], initialBudget: 0 }),
    }),
    { name: 'dutch-pay-storage' },
  ),
);
