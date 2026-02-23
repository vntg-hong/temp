import { create } from 'zustand';
import type { TipState, CountryTip } from './types';
import { TIP_COUNTRIES } from './constants';

export const useTipStore = create<TipState>()((set, get) => ({
  selectedCountry: TIP_COUNTRIES[0], // default: 미국
  billAmount: '',
  tipPercent: TIP_COUNTRIES[0].commonTip,
  peopleCount: 1,
  isCustomTip: false,
  customTipInput: '',

  setCountry: (country: CountryTip) =>
    set({
      selectedCountry: country,
      tipPercent: country.commonTip,
      isCustomTip: false,
      customTipInput: '',
    }),

  setBillAmount: (amount: string) => set({ billAmount: amount }),

  setTipPercent: (percent: number) =>
    set({ tipPercent: percent, isCustomTip: false, customTipInput: '' }),

  setPeopleCount: (count: number) => set({ peopleCount: Math.max(1, count) }),

  setCustomTip: (value: string) => {
    // Allow digits and single decimal point only
    const cleaned = value.replace(/[^0-9.]/g, '');
    set({ customTipInput: cleaned, isCustomTip: true });
  },

  applyCustomTip: () => {
    const { customTipInput } = get();
    const parsed = parseFloat(customTipInput);
    if (!isNaN(parsed) && parsed >= 0) {
      set({ tipPercent: Math.min(parsed, 100), isCustomTip: true });
    }
  },

  reset: () => {
    const country = get().selectedCountry;
    set({
      billAmount: '',
      tipPercent: country?.commonTip ?? 0,
      peopleCount: 1,
      isCustomTip: false,
      customTipInput: '',
    });
  },
}));

/** Derived computation — call from component, no store overhead */
export function computeTip(
  billAmount: string,
  tipPercent: number,
  peopleCount: number,
): { tipAmount: number; total: number; perPerson: number } {
  const bill = parseFloat(billAmount) || 0;
  const tipAmount = (bill * tipPercent) / 100;
  const total = bill + tipAmount;
  const perPerson = peopleCount > 0 ? total / peopleCount : total;
  return { tipAmount, total, perPerson };
}
