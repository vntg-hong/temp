import { useState, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useExchangeStore } from '../store';
import { CurrencyRow } from './CurrencyRow';
import { CurrencySelector } from './CurrencySelector';

const ROW_HEIGHT = 64;

interface SelectorState {
  isOpen: boolean;
  mode: 'add' | 'change';
  targetId: string | null;
}

interface DragState {
  fromIndex: number;
  overIndex: number;
}

export function CurrencyList() {
  const { currencies, removeCurrency, reorderCurrency } = useExchangeStore();
  const listRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const [selector, setSelector] = useState<SelectorState>({
    isOpen: false,
    mode: 'add',
    targetId: null,
  });

  const openAdd = () => setSelector({ isOpen: true, mode: 'add', targetId: null });
  const openChange = (id: string) => setSelector({ isOpen: true, mode: 'change', targetId: id });
  const closeSelector = () => setSelector((s) => ({ ...s, isOpen: false }));

  const draggedId = dragState !== null ? currencies[dragState.fromIndex]?.id : null;

  // Compute visually reordered list during drag
  const visualCurrencies = useMemo(() => {
    if (dragState === null) return currencies;
    const arr = [...currencies];
    const [item] = arr.splice(dragState.fromIndex, 1);
    arr.splice(dragState.overIndex, 0, item);
    return arr;
  }, [currencies, dragState]);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleGripPointerDown = (e: React.PointerEvent, entryId: string) => {
    cancelLongPress();
    const index = currencies.findIndex((c) => c.id === entryId);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      navigator.vibrate?.(40);
      setDragState({ fromIndex: index, overIndex: index });
    }, 400);
  };

  const handleGripPointerMove = (e: React.PointerEvent) => {
    // Cancel long press if user moves before it triggers
    if (dragState === null) {
      cancelLongPress();
      return;
    }
    const listEl = listRef.current;
    if (!listEl) return;
    const rect = listEl.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const overIndex = Math.max(
      0,
      Math.min(currencies.length - 1, Math.floor(relativeY / ROW_HEIGHT)),
    );
    if (overIndex !== dragState.overIndex) {
      setDragState((prev) => (prev ? { ...prev, overIndex } : null));
    }
  };

  const handleGripPointerUp = () => {
    cancelLongPress();
    if (dragState !== null && dragState.fromIndex !== dragState.overIndex) {
      reorderCurrency(dragState.fromIndex, dragState.overIndex);
    }
    setDragState(null);
  };

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto bg-white">
        {visualCurrencies.map((entry) => (
          <CurrencyRow
            key={entry.id}
            id={entry.id}
            code={entry.code}
            onChangeCurrency={openChange}
            onDelete={removeCurrency}
            isDragging={entry.id === draggedId}
            onGripPointerDown={(e) => handleGripPointerDown(e, entry.id)}
            onGripPointerMove={handleGripPointerMove}
            onGripPointerUp={handleGripPointerUp}
          />
        ))}

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
