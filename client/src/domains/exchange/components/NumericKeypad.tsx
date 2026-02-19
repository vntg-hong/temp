import { type ReactNode } from 'react';
import { Delete } from 'lucide-react';
import { useExchangeStore } from '../store';

type KeyConfig = {
  label: string | ReactNode;
  action: () => void;
  variant: 'number' | 'function' | 'clear' | 'swap';
  colSpan?: number;
};

function KeyButton({
  config,
  height = 'h-14',
}: {
  config: KeyConfig;
  height?: string;
}) {
  const baseClass = 'flex items-center justify-center rounded-xl active:scale-95 transition-transform select-none touch-manipulation';

  const variantClass = {
    number: 'bg-white text-slate-900 font-semibold text-xl active:bg-slate-200',
    function: 'bg-white text-slate-600 font-semibold text-sm active:bg-slate-200',
    clear: 'bg-white text-red-500 font-semibold text-sm active:bg-red-50',
    swap: 'bg-white text-blue-500 font-semibold text-sm active:bg-blue-50',
  }[config.variant];

  const colSpanClass = config.colSpan === 2 ? 'col-span-2' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${height} ${colSpanClass}`}
      onPointerDown={(e) => {
        e.preventDefault(); // Prevent focus steal on input rows
        config.action();
      }}
    >
      {config.label}
    </button>
  );
}

export function NumericKeypad() {
  const { appendDigit, appendOperator, clearInput, backspace, swapWithBase } = useExchangeStore();

  const keys: (KeyConfig & { height?: string })[] = [
    // Row 1: C (span-2) and ⇄ (span-2)
    {
      label: 'C',
      action: clearInput,
      variant: 'clear',
      colSpan: 2,
      height: 'h-12',
    },
    {
      label: '⇄',
      action: swapWithBase,
      variant: 'swap',
      colSpan: 2,
      height: 'h-12',
    },

    // Row 2: 7 8 9 +
    { label: '7', action: () => appendDigit('7'), variant: 'number' },
    { label: '8', action: () => appendDigit('8'), variant: 'number' },
    { label: '9', action: () => appendDigit('9'), variant: 'number' },
    { label: '+', action: () => appendOperator('+'), variant: 'function' },

    // Row 3: 4 5 6 −
    { label: '4', action: () => appendDigit('4'), variant: 'number' },
    { label: '5', action: () => appendDigit('5'), variant: 'number' },
    { label: '6', action: () => appendDigit('6'), variant: 'number' },
    { label: '−', action: () => appendOperator('-'), variant: 'function' },

    // Row 4: 1 2 3 ×
    { label: '1', action: () => appendDigit('1'), variant: 'number' },
    { label: '2', action: () => appendDigit('2'), variant: 'number' },
    { label: '3', action: () => appendDigit('3'), variant: 'number' },
    { label: '×', action: () => appendOperator('×'), variant: 'function' },

    // Row 5: . 0 ⌫ ÷
    { label: '.', action: () => appendDigit('.'), variant: 'number' },
    { label: '0', action: () => appendDigit('0'), variant: 'number' },
    {
      label: <Delete size={20} />,
      action: backspace,
      variant: 'function',
    },
    { label: '÷', action: () => appendOperator('÷'), variant: 'function' },
  ];

  return (
    <div className="bg-slate-100 p-2 flex-shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
      <div className="grid grid-cols-4 gap-1.5">
        {keys.map((key, i) => (
          <KeyButton key={i} config={key} height={key.height ?? 'h-14'} />
        ))}
      </div>
    </div>
  );
}
