import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CURRENCY_MAP, ZERO_DECIMAL_CURRENCIES } from '../constants';

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

const DELETE_BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = 40;

export function CurrencyRow({ id, code, onChangeCurrency, onDelete }: CurrencyRowProps) {
  const { baseCurrencyCode, setBaseCurrency, computeValue, inputString } = useExchangeStore();
  const isBase = baseCurrencyCode === code;
  const currencyInfo = CURRENCY_MAP.get(code);
  const amount = computeValue(code);

  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const didMoveRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
    didMoveRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 5) didMoveRef.current = true;
    if (delta < 0) {
      setSwipeX(Math.max(delta, -DELETE_BUTTON_WIDTH));
    } else if (swipeX < 0) {
      setSwipeX(Math.min(0, swipeX + delta));
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    if (swipeX < -SWIPE_THRESHOLD) {
      setSwipeX(-DELETE_BUTTON_WIDTH);
    } else {
      setSwipeX(0);
    }
  };

  const handleRowClick = () => {
    if (didMoveRef.current) {
      // Swiped: if open, close it; if closed, do nothing
      if (swipeX !== 0) setSwipeX(0);
      return;
    }
    setBaseCurrency(code);
  };

  // Base currency row shows raw input string; others show computed + formatted value
  const displayValue = isBase ? inputString || '0' : formatAmount(amount, code);

  return (
    <div className="relative overflow-hidden">
      {/* Delete button revealed on swipe-left */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500"
        style={{ width: DELETE_BUTTON_WIDTH }}
      >
        <button
          className="text-white text-sm font-semibold w-full h-full"
          onClick={() => onDelete(id)}
        >
          삭제
        </button>
      </div>

      {/* Row content */}
      <div
        className={[
          'relative h-16 flex items-center justify-between px-4 border-b border-slate-100',
          'cursor-pointer select-none touch-pan-y bg-white',
          isBase ? 'bg-blue-50 border-l-4 border-l-blue-500' : '',
        ].join(' ')}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleRowClick}
      >
        {/* Left: flag + currency code dropdown */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0" role="img" aria-label={code}>
            {currencyInfo?.flag ?? '🏳'}
          </span>
          <button
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChangeCurrency(id);
            }}
            aria-label={`${code} 변경`}
          >
            <span
              className={`text-sm font-semibold ${isBase ? 'text-blue-700' : 'text-slate-800'}`}
            >
              {code}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
        </div>

        {/* Right: converted amount */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
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
    </div>
  );
}
