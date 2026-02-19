import { ChevronDown, Trash2 } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CURRENCY_MAP, ZERO_DECIMAL_CURRENCIES, getFlagUrl } from '../constants';

interface CurrencyRowProps {
  id: string;
  code: string;
  onChangeCurrency: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatAmount(amount: number, code: string): string {
  if (!isFinite(amount) || amount === 0) return '0';
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function CurrencyRow({ id, code, onChangeCurrency, onDelete }: CurrencyRowProps) {
  const { baseCurrencyCode, setBaseCurrency, computeValue, inputString } = useExchangeStore();
  const isBase = baseCurrencyCode === code;
  const currencyInfo = CURRENCY_MAP.get(code);
  const amount = computeValue(code);

  // Base currency row shows raw input string; others show computed + formatted value
  const displayValue = isBase ? inputString || '0' : formatAmount(amount, code);

  return (
    <div
      className={[
        'h-16 flex items-center gap-3 px-4 border-b border-slate-100',
        'cursor-pointer select-none',
        isBase ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white hover:bg-slate-50 active:bg-slate-100',
      ].join(' ')}
      onClick={() => setBaseCurrency(code)}
    >
      {/* Delete button */}
      <button
        className="flex-shrink-0 text-red-400 hover:text-red-600 active:text-red-700 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        aria-label={`${code} 삭제`}
      >
        <Trash2 size={18} />
      </button>

      {/* Flag */}
      <img
        src={getFlagUrl(code, 40)}
        alt={`${code} flag`}
        className="w-9 h-6 rounded object-cover flex-shrink-0 shadow-sm"
        onError={(e) => {
          e.currentTarget.src = 'https://flagcdn.com/w40/un.png';
        }}
      />

      {/* Currency code + name (tap to change) */}
      <button
        className="flex flex-col items-start min-w-0 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onChangeCurrency(id);
        }}
        aria-label={`${code} 변경`}
      >
        <div className="flex items-center gap-1">
          <span className={`text-sm font-semibold ${isBase ? 'text-blue-700' : 'text-slate-800'}`}>
            {code}
          </span>
          <ChevronDown size={12} className="text-slate-400" />
        </div>
        <span className="text-xs text-slate-400 truncate max-w-[90px]">
          {currencyInfo?.nameKo || currencyInfo?.name}
        </span>
      </button>

      {/* Converted amount */}
      <div className="flex-1 flex items-center justify-end gap-1.5 overflow-hidden">
        <span
          className={[
            'tabular-nums truncate',
            isBase
              ? 'text-xl font-extrabold text-blue-900'
              : 'text-lg font-bold text-slate-900',
          ].join(' ')}
        >
          {displayValue}
        </span>
        {isBase && <span className="text-blue-500 text-sm flex-shrink-0">✓</span>}
      </div>
    </div>
  );
}
