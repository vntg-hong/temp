import { useEffect } from 'react';
import { useExchangeStore } from '../store';
import { ExchangeHeader } from '../components/ExchangeHeader';
import { StatusBar } from '../components/StatusBar';
import { CurrencyList } from '../components/CurrencyList';
import { NumericKeypad } from '../components/NumericKeypad';

export function ExchangePage() {
  const { loadRates, isOffline, ratesDate } = useExchangeStore();

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  return (
    /* Mobile-first: full height, centered on desktop with max-w-sm */
    <div className="min-h-screen bg-slate-200 flex justify-center">
      <div className="h-screen w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl">
        <ExchangeHeader />
        {isOffline && <StatusBar lastUpdate={ratesDate} />}
        <CurrencyList />
        <NumericKeypad />
      </div>
    </div>
  );
}
