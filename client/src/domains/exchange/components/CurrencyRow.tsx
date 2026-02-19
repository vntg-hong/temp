import { useRef } from 'react';
import { ChevronDown, Trash2, GripVertical, Calculator } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CURRENCY_MAP, ZERO_DECIMAL_CURRENCIES, getFlagUrl } from '../constants';

interface CurrencyRowProps {
  id: string;
  code: string;
  onChangeCurrency: (id: string) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  onGripPointerDown?: (e: React.PointerEvent) => void;
  onGripPointerMove?: (e: React.PointerEvent) => void;
  onGripPointerUp?: (e: React.PointerEvent) => void;
}

function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? '';
  } catch {
    return '';
  }
}

function getAmountSizeClass(len: number, isBase: boolean): string {
  // Base row is actively edited — keep size fixed to avoid layout jumps while typing
  if (isBase) return 'text-lg';
  if (len > 20) return 'text-sm';
  if (len > 12) return 'text-base';
  return 'text-lg';
}

function formatAmount(amount: number, code: string): string {
  if (!isFinite(amount) || amount === 0) return '0';
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Cross-browser caret position from pointer coordinates */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) return { node: r.startContainer, offset: r.startOffset };
  }
  // Firefox (standard API)
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (docAny.caretPositionFromPoint) {
    const p = docAny.caretPositionFromPoint(x, y);
    if (p) return { node: p.offsetNode, offset: p.offset };
  }
  return null;
}

export function CurrencyRow({
  id,
  code,
  onChangeCurrency,
  onDelete,
  isDragging = false,
  onGripPointerDown,
  onGripPointerMove,
  onGripPointerUp,
}: CurrencyRowProps) {
  const { baseCurrencyCode, setBaseCurrency, computeValue, inputString, cursorPos, setCursorPos, openCalc } =
    useExchangeStore();
  const isBase = baseCurrencyCode === code;
  const currencyInfo = CURRENCY_MAP.get(code);
  const amount = computeValue(code);
  const symbol = getCurrencySymbol(code);

  // Base currency row shows raw input string; others show computed + formatted value
  const displayValue = isBase ? inputString || '0' : formatAmount(amount, code);
  const sizeClass = getAmountSizeClass(displayValue.length, isBase || isDragging);

  // Cursor position clamped to actual string length
  const clampedCursor = Math.min(cursorPos, inputString.length);

  const amountSpanRef = useRef<HTMLSpanElement>(null);

  /**
   * On tap/click in the base row amount area, calculate which character position
   * was tapped using the browser's caret-from-point API, then move the cursor there.
   */
  const handleAmountClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (!inputString) return; // placeholder '0' — leave cursor at 0

    const caret = caretAt(e.clientX, e.clientY);
    if (!caret || !amountSpanRef.current) return;

    // Walk all text nodes inside the span, accumulating character count
    // until we reach the tapped text node, then add the in-node offset.
    const walker = document.createTreeWalker(amountSpanRef.current, NodeFilter.SHOW_TEXT);
    let totalChars = 0;
    let found = false;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node === caret.node) {
        totalChars += caret.offset;
        found = true;
        break;
      }
      totalChars += node.length;
    }

    if (!found) {
      // Tapped past the last character
      totalChars = symbol.length + inputString.length;
    }

    // The symbol prefix is not part of inputString, so subtract its length
    const newPos = Math.max(0, Math.min(totalChars - symbol.length, inputString.length));
    setCursorPos(newPos);
  };

  return (
    <div
      className={[
        'min-h-16 py-3 flex items-center gap-3 px-4 border-b border-slate-100 transition-shadow',
        'select-none',
        isDragging
          ? 'bg-blue-50 shadow-lg relative z-10 cursor-grabbing'
          : isBase
            ? 'cursor-pointer bg-blue-50 border-l-4 border-l-blue-500'
            : 'cursor-pointer bg-white hover:bg-slate-50 active:bg-slate-100',
      ].join(' ')}
      onClick={isDragging ? undefined : () => setBaseCurrency(code)}
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
          if (!isDragging) onChangeCurrency(id);
        }}
        aria-label={`${code} 변경`}
      >
        <div className="flex items-center gap-1">
          <span
            className={`text-sm font-semibold ${
              isDragging ? 'text-blue-700' : isBase ? 'text-blue-700' : 'text-slate-800'
            }`}
          >
            {code}
          </span>
          <ChevronDown size={12} className="text-slate-400" />
        </div>
        <span className="text-xs text-slate-400 truncate max-w-[90px]">
          {currencyInfo?.nameKo || currencyInfo?.name}
        </span>
      </button>

      {/* Converted amount */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <span
          ref={amountSpanRef}
          onClick={isBase && !isDragging ? handleAmountClick : undefined}
          className={[
            'flex-1 min-w-0 tabular-nums break-all text-right',
            isBase && !isDragging ? 'cursor-text' : '',
            sizeClass,
            isBase || isDragging ? 'font-extrabold text-blue-900' : 'font-bold text-slate-900',
          ].join(' ')}
        >
          {symbol && (
            <span
              className={`mr-0.5 font-medium ${isBase || isDragging ? 'text-blue-600' : 'text-slate-500'}`}
            >
              {symbol}
            </span>
          )}

          {/* Base row: render text split by cursor position */}
          {isBase && inputString ? (
            <>
              {inputString.slice(0, clampedCursor)}
              <span
                aria-hidden
                className="inline-block w-[2px] rounded-sm bg-blue-500 animate-pulse align-text-bottom"
                style={{ height: '0.85em' }}
              />
              {inputString.slice(clampedCursor)}
            </>
          ) : (
            displayValue
          )}
        </span>
        {isBase && !isDragging && (
          <>
            <span className="text-blue-500 text-sm flex-shrink-0">✓</span>
            <button
              className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-blue-500 active:bg-blue-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                openCalc();
              }}
              aria-label="계산기 열기"
            >
              <Calculator size={17} />
            </button>
          </>
        )}
      </div>

      {/* Drag grip handle */}
      <button
        className={[
          'flex-shrink-0 transition-colors touch-none p-1 -mr-1',
          isDragging ? 'text-blue-400 cursor-grabbing' : 'text-slate-300 hover:text-slate-500 cursor-grab',
        ].join(' ')}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          onGripPointerDown?.(e);
        }}
        onPointerMove={(e) => onGripPointerMove?.(e)}
        onPointerUp={(e) => onGripPointerUp?.(e)}
        onPointerCancel={(e) => onGripPointerUp?.(e)}
        aria-label="순서 변경"
      >
        <GripVertical size={20} />
      </button>
    </div>
  );
}
