export interface CurrencyInfo {
  code: string;
  name: string;
  nameKo: string;
  flag: string;
}

export interface CurrencyEntry {
  id: string;
  code: string;
}

export interface RatesCache {
  base: string;
  date: string;
  rates: Record<string, number>;
  cachedAt: number;
}
