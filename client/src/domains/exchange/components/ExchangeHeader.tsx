import { ArrowLeft, Search, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExchangeStore } from '../store';

export function ExchangeHeader() {
  const navigate = useNavigate();
  const { isLoading, ratesDate } = useExchangeStore();

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
      <button
        onClick={() => navigate('/')}
        className="p-2 -ml-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
        aria-label="뒤로"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="flex flex-col items-center">
        <h1 className="text-base font-semibold text-slate-900">Exchange Calculator</h1>
        {isLoading && (
          <span className="text-xs text-slate-400">환율 업데이트 중...</span>
        )}
        {!isLoading && ratesDate && (
          <span className="text-xs text-slate-400">{ratesDate}</span>
        )}
      </div>

      <div className="flex items-center">
        <button
          className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
          aria-label="검색"
        >
          <Search size={20} />
        </button>
        <button
          className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
          aria-label="메뉴"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
