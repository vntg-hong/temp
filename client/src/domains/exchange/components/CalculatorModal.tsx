import { useRef } from 'react';
import { X, Delete } from 'lucide-react';
import { useExchangeStore } from '../store';

type KeyConfig = {
  label: React.ReactNode;
  action: () => void;
  variant: 'number' | 'function' | 'clear' | 'confirm';
  colSpan?: number;
};

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) return { node: r.startContainer, offset: r.startOffset };
  }
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (docAny.caretPositionFromPoint) {
    const p = docAny.caretPositionFromPoint(x, y);
    if (p) return { node: p.offsetNode, offset: p.offset };
  }
  return null;
}

function CalcKey({ config }: { config: KeyConfig }) {
  const variantClass = {
    number: 'bg-white text-slate-900 font-semibold text-xl active:bg-slate-200',
    function: 'bg-slate-200 text-slate-600 font-semibold text-base active:bg-slate-300',
    clear: 'bg-slate-200 text-red-500 font-semibold text-base active:bg-red-100',
    confirm: 'bg-blue-500 text-white font-bold text-2xl active:bg-blue-600',
  }[config.variant];

  const colSpanClass = config.colSpan === 2 ? 'col-span-2' : '';

  return (
    <button
      className={[
        'h-14 flex items-center justify-center rounded-xl',
        'active:scale-95 transition-transform select-none touch-manipulation',
        variantClass,
        colSpanClass,
      ].join(' ')}
      onPointerDown={(e) => {
        e.preventDefault();
        config.action();
      }}
    >
      {config.label}
    </button>
  );
}

export function CalculatorModal() {
  const {
    isCalcOpen,
    calcExpression,
    calcCursorPos,
    computeCalcValue,
    closeCalc,
    confirmCalc,
    calcAppendDigit,
    calcAppendOperator,
    calcAppendParenthesis,
    calcBackspace,
    calcClear,
    setCalcCursorPos,
  } = useExchangeStore();

  const exprRef = useRef<HTMLDivElement>(null);

  if (!isCalcOpen) return null;

  const clampedCursor = Math.min(calcCursorPos, calcExpression.length);
  const previewValue = calcExpression ? computeCalcValue() : 0;

  const handleExprClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!calcExpression) return;
    const caret = caretAt(e.clientX, e.clientY);
    if (!caret || !exprRef.current) return;

    const walker = document.createTreeWalker(exprRef.current, NodeFilter.SHOW_TEXT);
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

    if (!found) totalChars = calcExpression.length;
    setCalcCursorPos(Math.max(0, Math.min(totalChars, calcExpression.length)));
  };

  const keys: KeyConfig[] = [
    // Row 1
    { label: 'C', action: calcClear, variant: 'clear' },
    { label: '( )', action: calcAppendParenthesis, variant: 'function' },
    { label: <Delete size={20} />, action: calcBackspace, variant: 'function' },
    { label: '÷', action: () => calcAppendOperator('÷'), variant: 'function' },
    // Row 2
    { label: '7', action: () => calcAppendDigit('7'), variant: 'number' },
    { label: '8', action: () => calcAppendDigit('8'), variant: 'number' },
    { label: '9', action: () => calcAppendDigit('9'), variant: 'number' },
    { label: '×', action: () => calcAppendOperator('×'), variant: 'function' },
    // Row 3
    { label: '4', action: () => calcAppendDigit('4'), variant: 'number' },
    { label: '5', action: () => calcAppendDigit('5'), variant: 'number' },
    { label: '6', action: () => calcAppendDigit('6'), variant: 'number' },
    { label: '−', action: () => calcAppendOperator('-'), variant: 'function' },
    // Row 4
    { label: '1', action: () => calcAppendDigit('1'), variant: 'number' },
    { label: '2', action: () => calcAppendDigit('2'), variant: 'number' },
    { label: '3', action: () => calcAppendDigit('3'), variant: 'number' },
    { label: '+', action: () => calcAppendOperator('+'), variant: 'function' },
    // Row 5
    { label: '.', action: () => calcAppendDigit('.'), variant: 'number' },
    { label: '0', action: () => calcAppendDigit('0'), variant: 'number' },
    { label: '=', action: confirmCalc, variant: 'confirm', colSpan: 2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={closeCalc}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-colors"
            onPointerDown={(e) => {
              e.preventDefault();
              closeCalc();
            }}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
          <span className="text-xs text-slate-400 font-medium tracking-wide">계산기</span>
          <div className="w-8" />
        </div>

        {/* Expression display */}
        <div className="px-4 py-3 flex flex-col items-end">
          <div
            ref={exprRef}
            onClick={handleExprClick}
            className="w-full text-right text-3xl font-extrabold text-slate-900 cursor-text tabular-nums break-all leading-snug min-h-[2.5rem]"
          >
            {calcExpression ? (
              <>
                {calcExpression.slice(0, clampedCursor)}
                <span
                  aria-hidden
                  className="inline-block w-[2px] rounded-sm bg-blue-500 animate-pulse align-text-bottom"
                  style={{ height: '0.85em' }}
                />
                {calcExpression.slice(clampedCursor)}
              </>
            ) : (
              <span className="text-slate-300 font-bold">0</span>
            )}
          </div>

          {/* Live result preview */}
          <div className="text-sm text-slate-400 mt-0.5 h-5">
            {calcExpression && previewValue !== 0 && (
              <>= {previewValue.toLocaleString('en-US', { maximumFractionDigits: 10 })}</>
            )}
          </div>
        </div>

        {/* Keypad */}
        <div className="bg-slate-100 p-2">
          <div className="grid grid-cols-4 gap-1.5">
            {keys.map((key, i) => (
              <CalcKey key={i} config={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
