import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrencyEntry } from './types';
import { DEFAULT_CURRENCIES, ZERO_DECIMAL_CURRENCIES } from './constants';
import { fetchLatestRates, getCachedRates } from './api';

type Operator = '+' | '-' | '×' | '÷';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Safely evaluates a math expression string (digits + operators only) */
function evaluateInput(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[+\-×÷]$/, '');
  if (!cleaned) return 0;
  const jsExpr = cleaned.replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d.+\-*/]+$/.test(jsExpr)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${jsExpr})`)() as number;
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return Math.max(0, result);
  } catch {
    return 0;
  }
}

function formatInputValue(value: number, code: string): string {
  if (value === 0) return '';
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  const str = value.toFixed(decimals);
  // Remove trailing zeros after decimal point
  return decimals > 0 ? str.replace(/\.?0+$/, '') : str;
}

interface ExchangeState {
  currencies: CurrencyEntry[];
  baseCurrencyCode: string;
  inputString: string;
  rates: Record<string, number>;
  ratesDate: string | null;
  isOffline: boolean;
  isLoading: boolean;

  // Selectors
  computeValue: (code: string) => number;

  // Actions
  setBaseCurrency: (code: string) => void;
  appendDigit: (digit: string) => void;
  appendOperator: (op: Operator) => void;
  clearInput: () => void;
  backspace: () => void;
  swapWithBase: () => void;
  addCurrency: (code: string) => void;
  removeCurrency: (id: string) => void;
  changeCurrency: (id: string, newCode: string) => void;
  reorderCurrency: (fromIndex: number, toIndex: number) => void;
  loadRates: () => Promise<void>;
}

export const useExchangeStore = create<ExchangeState>()(
  persist(
    (set, get) => ({
      currencies: DEFAULT_CURRENCIES.map((code) => ({ id: generateId(), code })),
      baseCurrencyCode: DEFAULT_CURRENCIES[0],
      inputString: '',
      rates: {},
      ratesDate: null,
      isOffline: false,
      isLoading: false,

      computeValue: (code: string) => {
        const { rates, baseCurrencyCode, inputString } = get();
        if (!inputString || Object.keys(rates).length === 0) return 0;
        const baseValue = evaluateInput(inputString);
        if (baseValue === 0) return 0;
        const baseRate = rates[baseCurrencyCode];
        const targetRate = rates[code];
        if (!baseRate || !targetRate) return 0;
        return baseValue * (targetRate / baseRate);
      },

      setBaseCurrency: (code: string) => {
        set((state) => {
          if (code === state.baseCurrencyCode) return {};
          const { rates, baseCurrencyCode, inputString } = state;
          const currentValue = evaluateInput(inputString);
          let newInput = inputString;

          if (currentValue > 0 && Object.keys(rates).length > 0) {
            const baseRate = rates[baseCurrencyCode];
            const newRate = rates[code];
            if (baseRate && newRate) {
              const converted = currentValue * (newRate / baseRate);
              newInput = formatInputValue(converted, code);
            }
          }

          return { baseCurrencyCode: code, inputString: newInput };
        });
      },

      appendDigit: (digit: string) => {
        set((state) => {
          const current = state.inputString;

          if (digit === '.') {
            // Find start of current number segment (after last operator)
            const lastOp = Math.max(
              current.lastIndexOf('+'),
              current.lastIndexOf('-'),
              current.lastIndexOf('×'),
              current.lastIndexOf('÷'),
            );
            const segment = current.slice(lastOp + 1);
            if (segment.includes('.')) return {};
          }

          // Prevent leading zeros like "007"
          if (digit !== '.' && current === '0') {
            return { inputString: digit };
          }

          // Limit input length to prevent overflow
          if (current.length >= 20) return {};

          return { inputString: current + digit };
        });
      },

      appendOperator: (op: Operator) => {
        set((state) => {
          const current = state.inputString;
          if (!current) return {};
          // Replace trailing operator
          if (/[+\-×÷]$/.test(current)) {
            return { inputString: current.slice(0, -1) + op };
          }
          return { inputString: current + op };
        });
      },

      clearInput: () => set({ inputString: '' }),

      backspace: () => {
        set((state) => ({
          inputString: state.inputString.slice(0, -1),
        }));
      },

      swapWithBase: () => {
        set((state) => {
          const { currencies, baseCurrencyCode } = state;
          const baseIndex = currencies.findIndex((c) => c.code === baseCurrencyCode);
          if (currencies.length < 2 || baseIndex <= 0) return {};
          const next = [...currencies];
          [next[0], next[baseIndex]] = [next[baseIndex], next[0]];
          return { currencies: next };
        });
      },

      addCurrency: (code: string) => {
        set((state) => {
          if (state.currencies.some((c) => c.code === code)) return {};
          return { currencies: [...state.currencies, { id: generateId(), code }] };
        });
      },

      removeCurrency: (id: string) => {
        set((state) => {
          if (state.currencies.length <= 1) return {};
          const filtered = state.currencies.filter((c) => c.id !== id);
          const removed = state.currencies.find((c) => c.id === id);
          const newBase =
            removed?.code === state.baseCurrencyCode
              ? filtered[0].code
              : state.baseCurrencyCode;
          return { currencies: filtered, baseCurrencyCode: newBase };
        });
      },

      changeCurrency: (id: string, newCode: string) => {
        set((state) => {
          if (state.currencies.some((c) => c.code === newCode && c.id !== id)) return {};
          const updated = state.currencies.map((c) =>
            c.id === id ? { ...c, code: newCode } : c,
          );
          const wasBase = state.currencies.find((c) => c.id === id)?.code === state.baseCurrencyCode;
          return {
            currencies: updated,
            baseCurrencyCode: wasBase ? newCode : state.baseCurrencyCode,
          };
        });
      },

      reorderCurrency: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const next = [...state.currencies];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { currencies: next };
        });
      },

      loadRates: async () => {
        set({ isLoading: true });
        try {
          const result = await fetchLatestRates();
          set({
            rates: result.rates,
            ratesDate: result.date,
            isOffline: false,
            isLoading: false,
          });
        } catch {
          // Fall back to cached data
          const cached = getCachedRates();
          if (cached?.rates) {
            set({
              rates: cached.rates,
              ratesDate: cached.date,
              isOffline: true,
              isLoading: false,
            });
          } else {
            set({ isOffline: true, isLoading: false });
          }
        }
      },
    }),
    {
      name: 'exchange:state',
      // Only persist UI preferences, not runtime state
      partialize: (state) => ({
        currencies: state.currencies,
        baseCurrencyCode: state.baseCurrencyCode,
      }),
    },
  ),
);
