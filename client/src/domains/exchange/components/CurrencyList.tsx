import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CurrencyRow } from './CurrencyRow';
import { CurrencySelector } from './CurrencySelector';

interface SelectorState {
  isOpen: boolean;
  mode: 'add' | 'change';
  targetId: string | null;
}

export function CurrencyList() {
  const { currencies, removeCurrency } = useExchangeStore();

  const [selector, setSelector] = useState<SelectorState>({
    isOpen: false,
    mode: 'add',
    targetId: null,
  });

  const openAdd = () => setSelector({ isOpen: true, mode: 'add', targetId: null });
  const openChange = (id: string) => setSelector({ isOpen: true, mode: 'change', targetId: id });
  const closeSelector = () => setSelector((s) => ({ ...s, isOpen: false }));

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-white">
        {currencies.map((entry) => (
          <CurrencyRow
            key={entry.id}
            id={entry.id}
            code={entry.code}
            onChangeCurrency={openChange}
            onDelete={removeCurrency}
          />
        ))}

        {/* Add currency button */}
        <button
          onClick={openAdd}
          className="w-full h-14 flex items-center justify-center gap-2 bg-slate-50 border-t border-dashed border-slate-300 text-blue-500 text-sm font-semibold hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <Plus size={18} />
          통화 추가
        </button>
      </div>

      <CurrencySelector
        isOpen={selector.isOpen}
        mode={selector.mode}
        targetId={selector.targetId}
        onClose={closeSelector}
      />
    </>
  );
}
