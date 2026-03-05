import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { RateAlert } from '../types';
import { CURRENCY_MAP, getFlagUrl } from '../../exchange/constants';

interface Props {
  alert: RateAlert;
  currentKrwRate: number | null; // KRW per 1 unit of currency
  onToggle: () => void;
  onDelete: () => void;
}

function fmtRate(rate: number): string {
  return rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function AlertCard({ alert, currentKrwRate, onToggle, onDelete }: Props) {
  const currency = CURRENCY_MAP.get(alert.currencyCode);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const DELETE_THRESHOLD = 72; // px to reveal delete button

  /* ── 스와이프 핸들러 ── */
  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    containerRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    setTranslateX(Math.max(-DELETE_THRESHOLD, Math.min(0, dx)));
  };
  const onPointerUp = () => {
    startXRef.current = null;
    setTranslateX((prev) => (prev < -DELETE_THRESHOLD / 2 ? -DELETE_THRESHOLD : 0));
  };

  /* ── 진행률 계산 ── */
  const progress = (() => {
    if (currentKrwRate === null) return 0;
    const { refRate, targetRate, condition } = alert;
    const range = Math.abs(targetRate - refRate);
    if (range === 0) return currentKrwRate >= targetRate ? 100 : 0;
    const moved =
      condition === 'below'
        ? refRate - currentKrwRate
        : currentKrwRate - refRate;
    return Math.min(100, Math.max(0, (moved / range) * 100));
  })();

  const gapPct =
    currentKrwRate !== null
      ? (((currentKrwRate - alert.targetRate) / alert.targetRate) * 100).toFixed(1)
      : null;

  const progressColor =
    progress >= 80 ? 'bg-emerald-400' : progress >= 50 ? 'bg-amber-400' : 'bg-slate-300';

  const conditionLabel =
    alert.condition === 'below' ? `${fmtRate(alert.targetRate)}원 이하 시` : `${fmtRate(alert.targetRate)}원 이상 시`;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 삭제 버튼 (배경) */}
      <div className="absolute inset-y-0 right-0 w-[72px] flex items-center justify-center bg-rose-500 rounded-2xl">
        <button onClick={onDelete} className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition-all">
          <Trash2 size={18} />
          <span className="text-[9px] font-semibold">삭제</span>
        </button>
      </div>

      {/* 카드 본체 (스와이프 가능) */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${translateX}px)`, transition: startXRef.current !== null ? 'none' : 'transform 0.2s ease' }}
        className={[
          'relative bg-white border border-slate-100 rounded-2xl p-4 select-none touch-pan-y',
          !alert.isActive && 'opacity-50',
        ].filter(Boolean).join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          {/* 통화 정보 */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={getFlagUrl(alert.currencyCode, 40)}
              alt={alert.currencyCode}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-slate-100"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = getFlagUrl('un', 40); }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{alert.currencyCode}</p>
              <p className="text-xs text-slate-400 truncate">{currency?.nameKo ?? alert.currencyCode}</p>
            </div>
          </div>

          {/* 토글 스위치 */}
          <button
            onClick={onToggle}
            className={[
              'flex-shrink-0 w-11 h-6 rounded-full relative transition-colors duration-200',
              alert.isActive ? 'bg-slate-900' : 'bg-slate-200',
            ].join(' ')}
            aria-label={alert.isActive ? '비활성화' : '활성화'}
          >
            <span
              className={[
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
                alert.isActive ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

        {/* 조건 + 현재 상태 */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{conditionLabel}</span>
          {currentKrwRate !== null && (
            <span className="text-slate-400">
              현재 {fmtRate(currentKrwRate)}원
              {gapPct !== null && (
                <span className={parseFloat(gapPct) > 0 ? ' text-rose-400' : ' text-emerald-500'}>
                  {' '}({parseFloat(gapPct) > 0 ? '+' : ''}{gapPct}%)
                </span>
              )}
            </span>
          )}
        </div>

        {/* 진행률 게이지 */}
        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-slate-300">
          <span>시작</span>
          <span>{progress.toFixed(0)}%</span>
          <span>목표</span>
        </div>

        {/* 배지 */}
        <div className="mt-2 flex gap-1.5">
          {alert.repeat ? (
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[10px] font-semibold rounded-full">반복</span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-semibold rounded-full">1회성</span>
          )}
          {alert.triggered && !alert.repeat && (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-500 text-[10px] font-semibold rounded-full">발송완료</span>
          )}
        </div>
      </div>
    </div>
  );
}
