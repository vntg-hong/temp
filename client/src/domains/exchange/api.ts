import type { RatesCache } from './types';

const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'exchange:rates';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RatesCache;
  } catch {
    return null;
  }
}

function saveCache(data: Omit<RatesCache, 'cachedAt'>): void {
  try {
    const toSave: RatesCache = { ...data, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage quota errors
  }
}

export interface FetchRatesResult {
  base: string;
  date: string;
  rates: Record<string, number>;
  fromCache: boolean;
}

export async function fetchLatestRates(): Promise<FetchRatesResult> {
  const cached = loadCache();
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { base: cached.base, date: cached.date, rates: cached.rates, fromCache: true };
  }

  const response = await fetch(EXCHANGE_RATE_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json() as {
    result: string;
    base_code: string;
    rates: Record<string, number>;
    time_last_update_unix: number;
  };
  if (data.result !== 'success') throw new Error('API returned non-success result');

  const rates: Record<string, number> = data.rates;
  const d = new Date(data.time_last_update_unix * 1000);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;

  saveCache({ base: 'USD', date, rates });

  return { base: 'USD', date, rates, fromCache: false };
}

export function getCachedRates(): RatesCache | null {
  return loadCache();
}
