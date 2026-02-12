import type { RatesCache } from './types';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';
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

  const response = await fetch(`${FRANKFURTER_URL}?from=USD`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  // Include USD itself with rate 1
  const rates: Record<string, number> = { USD: 1, ...data.rates };

  saveCache({ base: 'USD', date: data.date as string, rates });

  return { base: 'USD', date: data.date as string, rates, fromCache: false };
}

export function getCachedRates(): RatesCache | null {
  return loadCache();
}
