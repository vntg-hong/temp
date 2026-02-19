import { Menu } from 'lucide-react';
import { useExchangeStore } from '../store';

export function ExchangeHeader() {
  const { isLoading, ratesDate } = useExchangeStore();

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="w-10" /> {/* 좌측 여백용 (중앙 정렬 유지) */}

      <div className="flex flex-col items-center">
        <h1 className="text-base font-semibold text-slate-900">환율계산기</h1>
        {isLoading && (
          <span className="text-xs text-slate-400">환율 업데이트 중...</span>
        )}
        {!isLoading && ratesDate && (
          <span className="text-xs text-slate-400">
            환율 갱신 시간 : {ratesDate.replace(/\.\s/g, '.')}
          </span>
        )}
      </div>

      <div className="flex items-center">
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
