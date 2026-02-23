export interface CountryTip {
  code: string;
  name: string;
  flag: string;
  currency: string;
  commonTip: number;
  suggestions: number[];
  note?: string;
  noTip?: boolean;
}

export interface TipState {
  selectedCountry: CountryTip | null;
  billAmount: string;
  tipPercent: number;
  peopleCount: number;
  isCustomTip: boolean;
  customTipInput: string;

  setCountry: (country: CountryTip) => void;
  setBillAmount: (amount: string) => void;
  setTipPercent: (percent: number) => void;
  setPeopleCount: (count: number) => void;
  setCustomTip: (value: string) => void;
  applyCustomTip: () => void;
  reset: () => void;
}
