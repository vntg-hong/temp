import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CURRENCIES } from '../constants';

interface CurrencySelectorProps {
  isOpen: boolean;
  mode: 'add' | 'change';
  targetId: string | null;
  onClose: () => void;
}

export function CurrencySelector({ isOpen, mode, targetId, onClose }: CurrencySelectorProps) {
  const { currencies, addCurrency, changeCurrency } = useExchangeStore();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const usedCodes = new Set(currencies.map((c) => c.code));
  const targetCode = targetId
    ? currencies.find((c) => c.id === targetId)?.code
    : undefined;

  const filtered = CURRENCIES.filter((c) => {
    // In 'add' mode, hide already-added currencies
    if (mode === 'add' && usedCodes.has(c.code)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.nameKo.includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (code: string) => {
    if (mode === 'add') {
      addCurrency(code);
    } else if (targetId) {
      changeCurrency(targetId, code);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-50 bg-white rounded-t-3xl flex flex-col max-h-[80vh] shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Title + Close */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900">통화 선택</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-3">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="국가 또는 통화코드 검색..."
              className="bg-transparent flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Currency List */}
        <div className="overflow-y-auto flex-1 pb-safe">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">검색 결과가 없습니다</p>
          )}
          {filtered.map((currency) => {
            const isCurrentTarget = currency.code === targetCode;
            return (
              <button
                key={currency.code}
                onClick={() => handleSelect(currency.code)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  isCurrentTarget
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-slate-50 active:bg-slate-100',
                ].join(' ')}
              >
                <span className="text-2xl flex-shrink-0" role="img" aria-label={currency.code}>
                  {currency.flag}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-bold ${isCurrentTarget ? 'text-blue-700' : 'text-slate-800'}`}
                  >
                    {currency.code}
                  </span>
                  <span className="text-sm text-slate-400 ml-2">{currency.nameKo}</span>
                </div>
                {isCurrentTarget && (
                  <span className="text-blue-500 text-sm flex-shrink-0">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
