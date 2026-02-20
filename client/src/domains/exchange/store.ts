import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrencyEntry } from './types';
import { DEFAULT_CURRENCIES, ZERO_DECIMAL_CURRENCIES } from './constants';
import { fetchLatestRates, getCachedRates } from './api';

type Operator = '+' | '-' | '×' | '÷';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Safely evaluates a math expression string (digits + operators + parentheses) */
function evaluateInput(input: string): number {
  if (!input) return 0;
  // Remove trailing operators and lone opening parens
  const cleaned = input.replace(/[+\-×÷(]+$/, '');
  if (!cleaned) return 0;
  let jsExpr = cleaned.replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d.+\-*/()]+$/.test(jsExpr)) return 0;
  // Auto-close unclosed parentheses
  const unclosed = (jsExpr.match(/\(/g) || []).length - (jsExpr.match(/\)/g) || []).length;
  if (unclosed > 0) jsExpr += ')'.repeat(unclosed);
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
  cursorPos: number;
  // Calculator modal state
  isCalcOpen: boolean;
  calcExpression: string;
  calcCursorPos: number;
  calcError: string | null;
  rates: Record<string, number>;
  ratesDate: string | null;
  isOffline: boolean;
  isLoading: boolean;

  // Selectors
  computeValue: (code: string) => number;
  computeCalcValue: () => number;

  // Actions
  setBaseCurrency: (code: string) => void;
  appendDigit: (digit: string) => void;
  appendOperator: (op: Operator) => void;
  appendParenthesis: () => void;
  clearInput: () => void;
  backspace: () => void;
  setCursorPos: (pos: number) => void;
  // Calculator modal actions
  openCalc: () => void;
  closeCalc: () => void;
  confirmCalc: () => void;
  calcAppendDigit: (digit: string) => void;
  calcAppendOperator: (op: Operator) => void;
  calcAppendParenthesis: () => void;
  calcBackspace: () => void;
  calcClear: () => void;
  setCalcCursorPos: (pos: number) => void;
  setCalcError: (msg: string | null) => void;
  swapWithBase: () => void;
  addCurrency: (code: string) => void;
  removeCurrency: (id: string) => void;
  changeCurrency: (id: string, newCode: string) => void;
  reorderCurrency: (fromIndex: number, toIndex: number) => void;
  loadRates: (force?: boolean) => Promise<void>;
}

export const useExchangeStore = create<ExchangeState>()(
  persist(
    (set, get) => ({
      currencies: DEFAULT_CURRENCIES.map((code) => ({ id: generateId(), code })),
      baseCurrencyCode: DEFAULT_CURRENCIES[0],
      inputString: '',
      cursorPos: 0,
      isCalcOpen: false,
      calcExpression: '',
      calcCursorPos: 0,
      calcError: null,
      rates: {},
      ratesDate: null,
      isOffline: false,
      isLoading: false,

      computeCalcValue: () => evaluateInput(get().calcExpression),

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

          return { baseCurrencyCode: code, inputString: newInput, cursorPos: newInput.length };
        });
      },

      appendDigit: (digit: string) => {
        set((state) => {
          const { inputString: current, cursorPos } = state;

          if (current.length >= 1000) return {};

          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);

          if (digit === '.') {
            // Check the number segment around the cursor for an existing decimal
            const lastOpBefore = Math.max(
              before.lastIndexOf('+'), before.lastIndexOf('-'),
              before.lastIndexOf('×'), before.lastIndexOf('÷'), before.lastIndexOf('('),
            );
            const segBefore = before.slice(lastOpBefore + 1);
            const nextOpAfterIdx = after.search(/[+\-×÷()]/);
            const segAfter = nextOpAfterIdx >= 0 ? after.slice(0, nextOpAfterIdx) : after;
            if (segBefore.includes('.') || segAfter.includes('.')) return {};
          }

          // Prevent leading zeros like "007": if entire input is '0', replace it
          if (digit !== '.' && current === '0') {
            return { inputString: digit, cursorPos: 1 };
          }

          return { inputString: before + digit + after, cursorPos: cursorPos + 1 };
        });
      },

      appendOperator: (op: Operator) => {
        set((state) => {
          const { inputString: current, cursorPos } = state;
          if (!current) return {};

          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);

          // Don't insert operator at the very start
          if (!before) return {};

          // Replace operator immediately before cursor
          if (/[+\-×÷]$/.test(before)) {
            return { inputString: before.slice(0, -1) + op + after, cursorPos };
          }

          return { inputString: before + op + after, cursorPos: cursorPos + 1 };
        });
      },

      appendParenthesis: () => {
        set((state) => {
          const { inputString: current, cursorPos } = state;
          if (current.length >= 1000) return {};

          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);

          const openCount = (current.match(/\(/g) || []).length;
          const closeCount = (current.match(/\)/g) || []).length;
          const unclosed = openCount - closeCount;

          // Close if unclosed parens exist and char before cursor is digit, dot, or ')'
          const paren = unclosed > 0 && /[\d.)]$/.test(before) ? ')' : '(';
          return { inputString: before + paren + after, cursorPos: cursorPos + 1 };
        });
      },

      clearInput: () => set({ inputString: '', cursorPos: 0 }),

      backspace: () => {
        set((state) => {
          const { inputString: current, cursorPos } = state;
          if (cursorPos === 0) return {};
          const before = current.slice(0, cursorPos - 1);
          const after = current.slice(cursorPos);
          return { inputString: before + after, cursorPos: cursorPos - 1 };
        });
      },

      setCursorPos: (pos: number) => {
        set((state) => ({ cursorPos: Math.max(0, Math.min(pos, state.inputString.length)) }));
      },

      // ── Calculator modal ───────────────────────────────────────────────────

      openCalc: () => {
        set((state) => {
          // Seed from inputString only when there is no previous calc expression
          const expr = state.calcExpression || state.inputString;
          return { isCalcOpen: true, calcExpression: expr, calcCursorPos: expr.length };
        });
      },

      closeCalc: () => set({ isCalcOpen: false, calcError: null }),

      confirmCalc: () => {
        set((state) => {
          const result = evaluateInput(state.calcExpression);
          const resultStr = result === 0 ? '' : String(result);
          return {
            isCalcOpen: false,
            inputString: resultStr,
            cursorPos: resultStr.length,
            // Keep calcExpression so the user can resume the same expression later
          };
        });
      },

      calcAppendDigit: (digit: string) => {
        set((state) => {
          const { calcExpression: current, calcCursorPos: cursorPos } = state;
          if (current.length >= 1000) {
            get().setCalcError('계산은 1000자를 넘을 수 없습니다.');
            return {};
          }

          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);

          if (digit === '.') {
            const lastOpBefore = Math.max(
              before.lastIndexOf('+'), before.lastIndexOf('-'),
              before.lastIndexOf('×'), before.lastIndexOf('÷'), before.lastIndexOf('('),
            );
            const segBefore = before.slice(lastOpBefore + 1);
            const nextOpAfterIdx = after.search(/[+\-×÷()]/);
            const segAfter = nextOpAfterIdx >= 0 ? after.slice(0, nextOpAfterIdx) : after;
            if (segBefore.includes('.') || segAfter.includes('.')) return {};
          }

          if (digit !== '.' && current === '0') {
            return { calcExpression: digit, calcCursorPos: 1 };
          }

          return { calcExpression: before + digit + after, calcCursorPos: cursorPos + 1 };
        });
      },

      calcAppendOperator: (op: Operator) => {
        set((state) => {
          const { calcExpression: current, calcCursorPos: cursorPos } = state;
          if (!current) return {};
          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);
          if (!before) return {};
          if (/[+\-×÷]$/.test(before)) {
            return { calcExpression: before.slice(0, -1) + op + after, calcCursorPos: cursorPos };
          }
          return { calcExpression: before + op + after, calcCursorPos: cursorPos + 1 };
        });
      },

      calcAppendParenthesis: () => {
        set((state) => {
          const { calcExpression: current, calcCursorPos: cursorPos } = state;
          if (current.length >= 1000) {
            get().setCalcError('계산은 1000자를 넘을 수 없습니다.');
            return {};
          }
          const before = current.slice(0, cursorPos);
          const after = current.slice(cursorPos);
          const openCount = (current.match(/\(/g) || []).length;
          const closeCount = (current.match(/\)/g) || []).length;
          const unclosed = openCount - closeCount;
          const paren = unclosed > 0 && /[\d.)]$/.test(before) ? ')' : '(';
          return { calcExpression: before + paren + after, calcCursorPos: cursorPos + 1 };
        });
      },

      calcBackspace: () => {
        set((state) => {
          const { calcExpression: current, calcCursorPos: cursorPos } = state;
          if (cursorPos === 0) return {};
          const before = current.slice(0, cursorPos - 1);
          const after = current.slice(cursorPos);
          return { calcExpression: before + after, calcCursorPos: cursorPos - 1 };
        });
      },

      calcClear: () => set({ calcExpression: '', calcCursorPos: 0 }),

      setCalcCursorPos: (pos: number) => {
        set((state) => ({
          calcCursorPos: Math.max(0, Math.min(pos, state.calcExpression.length)),
        }));
      },

      setCalcError: (msg: string | null) => {
        set({ calcError: msg });
        if (msg) {
          setTimeout(() => {
            if (get().calcError === msg) set({ calcError: null });
          }, 3000);
        }
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

      loadRates: async (force = false) => {
        set({ isLoading: true });
        try {
          const result = await fetchLatestRates(force);
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
