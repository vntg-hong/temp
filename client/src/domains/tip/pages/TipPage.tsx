import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, RotateCcw, Menu } from 'lucide-react';
import { useTipStore, computeTip } from '../store';
import { TIP_COUNTRIES } from '../constants';
import { MenuDrawer } from '../../../core/ui/MenuDrawer';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', CAD: 'CA$', GBP: '£', AUD: 'A$', EUR: '€',
  SEK: 'kr', MXN: '$', BRL: 'R$', ZAR: 'R', THB: '฿',
  SGD: 'S$', HKD: 'HK$', AED: 'AED', INR: '₹',
  KRW: '₩', JPY: '¥', CNY: '¥',
};

const ZERO_DECIMAL = new Set(['KRW', 'JPY']);

function fmt(value: number, currency: string): string {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  return `${sym}${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function TipPage() {
  const {
    selectedCountry,
    billAmount,
    tipPercent,
    peopleCount,
    isCustomTip,
    customTipInput,
    setCountry,
    setBillAmount,
    setTipPercent,
    setPeopleCount,
    setCustomTip,
    applyCustomTip,
    reset,
  } = useTipStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const countryScrollRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Mouse drag-to-scroll for PC
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = countryScrollRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
  };
  const onDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.active || !countryScrollRef.current) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    countryScrollRef.current.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onDragEnd = () => { drag.current.active = false; };
  // Suppress click on child buttons when drag occurred
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  // Scroll selected country into view — directly manipulate scrollLeft
  // (avoid scrollIntoView which can affect parent vertical scroll)
  useEffect(() => {
    const idx = TIP_COUNTRIES.findIndex((c) => c.code === selectedCountry?.code);
    const container = countryScrollRef.current;
    if (idx === -1 || !container) return;
    const chip = container.children[idx] as HTMLElement;
    if (!chip) return;
    const scrollTarget = chip.offsetLeft - container.clientWidth / 2 + chip.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [selectedCountry]);

  const country = selectedCountry ?? TIP_COUNTRIES[0];
  const { tipAmount, total, perPerson } = computeTip(billAmount, tipPercent, peopleCount);
  const hasBill = parseFloat(billAmount) > 0;

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center">
      <div
        className="h-screen w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
          <Link
            to="/"
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="text-base font-semibold text-slate-900">팁 계산기</h1>

          <div className="flex items-center">
            <button
              onClick={reset}
              className="p-2 text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-lg transition-colors"
              aria-label="초기화"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
              aria-label="메뉴"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Country selector — lives OUTSIDE the vertical scroll container
             so horizontal touch events don't conflict with page scroll */}
        <div className="flex-shrink-0 border-b border-slate-100 bg-white">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">여행 국가</p>
          </div>
          <div
            ref={countryScrollRef}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onClickCapture={onClickCapture}
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 cursor-grab active:cursor-grabbing select-none"
            style={{
              WebkitOverflowScrolling: 'touch', /* iOS momentum scroll */
              touchAction: 'pan-x',             /* tell browser: handle only horizontal touch */
            } as React.CSSProperties}
          >
            {TIP_COUNTRIES.map((c) => {
              const isSelected = c.code === country.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setCountry(c)}
                  className={[
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all active:scale-95',
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200',
                  ].join(' ')}
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
          {country.note && (
            <p className="mx-4 mb-3 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              ℹ️ {country.note}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Bill Amount */}
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">결제 금액</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 pointer-events-none select-none">
                {CURRENCY_SYMBOLS[country.currency] ?? ''}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-3 text-right text-2xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Tip Percentage */}
          <div className="px-4 pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">팁 비율</p>

            {country.noTip ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-2xl">
                <span className="text-xl">{country.flag}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{country.name}은 팁 문화가 없습니다</p>
                  <p className="text-xs text-slate-400">팁 없이 계산하려면 0%를 선택하세요</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-2">
              {country.suggestions.map((pct) => {
                const isSelected = !isCustomTip && tipPercent === pct;
                return (
                  <button
                    key={pct}
                    onClick={() => setTipPercent(pct)}
                    className={[
                      'px-4 py-2 rounded-xl border text-sm font-bold transition-all',
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
                    ].join(' ')}
                  >
                    {pct}%
                  </button>
                );
              })}

              {/* Custom tip button */}
              <button
                onClick={() => {
                  setCustomTip(isCustomTip ? customTipInput : '');
                  setTimeout(() => customInputRef.current?.focus(), 50);
                }}
                className={[
                  'px-4 py-2 rounded-xl border text-sm font-bold transition-all',
                  isCustomTip
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                ].join(' ')}
              >
                직접 입력
              </button>
            </div>

            {isCustomTip && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  ref={customInputRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.5"
                  value={customTipInput}
                  onChange={(e) => setCustomTip(e.target.value)}
                  onBlur={applyCustomTip}
                  onKeyDown={(e) => e.key === 'Enter' && applyCustomTip()}
                  placeholder="팁 % 입력"
                  className="flex-1 px-4 py-2.5 text-right text-lg font-bold text-slate-900 bg-slate-50 border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                />
                <span className="text-lg font-bold text-slate-700">%</span>
                <button
                  onClick={applyCustomTip}
                  className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  적용
                </button>
              </div>
            )}
          </div>

          {/* People Count */}
          <div className="px-4 pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">인원수</p>
            <div className="flex items-center gap-4">
              <Users size={18} className="text-slate-400" />
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-2 py-1 border border-slate-200">
                <button
                  onClick={() => setPeopleCount(peopleCount - 1)}
                  disabled={peopleCount <= 1}
                  className="w-9 h-9 flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center text-lg font-bold text-slate-900 select-none">
                  {peopleCount}
                </span>
                <button
                  onClick={() => setPeopleCount(peopleCount + 1)}
                  className="w-9 h-9 flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-slate-500">명</span>
            </div>
          </div>

          {/* Result Card */}
          <div className="px-4 pt-5" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">계산 결과</p>
            <div className="bg-slate-900 text-white rounded-2xl overflow-hidden">
              {/* Tip row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">팁 금액</p>
                  <p className="text-xs text-slate-400">{tipPercent}% 적용</p>
                </div>
                <p className={['text-xl font-bold tabular-nums', hasBill ? 'text-white' : 'text-slate-600'].join(' ')}>
                  {hasBill ? fmt(tipAmount, country.currency) : '—'}
                </p>
              </div>

              {/* Total row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <p className="text-sm text-slate-300">최종 합계</p>
                <p className={['text-2xl font-black tabular-nums', hasBill ? 'text-white' : 'text-slate-600'].join(' ')}>
                  {hasBill ? fmt(total, country.currency) : '—'}
                </p>
              </div>

              {/* Per person row */}
              {peopleCount > 1 && (
                <div className="flex items-center justify-between px-5 py-4 bg-indigo-600/30">
                  <div>
                    <p className="text-sm text-slate-300">1인당 금액</p>
                    <p className="text-xs text-slate-400">{peopleCount}명 기준</p>
                  </div>
                  <p className={['text-2xl font-black tabular-nums', hasBill ? 'text-indigo-300' : 'text-slate-600'].join(' ')}>
                    {hasBill ? fmt(perPerson, country.currency) : '—'}
                  </p>
                </div>
              )}

              {!hasBill && (
                <div className="px-5 py-3 text-center">
                  <p className="text-xs text-slate-500">결제 금액을 입력하면 계산됩니다</p>
                </div>
              )}
            </div>

            {/* Tip culture info */}
            <div className="mt-3 px-4 py-3 bg-slate-50 rounded-2xl">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-700">{country.flag} {country.name}</span> 팁 문화:&nbsp;
                {country.noTip
                  ? '팁을 주지 않는 문화입니다.'
                  : `일반적으로 ${country.suggestions.join('%, ')}% 수준의 팁이 적절합니다.`}
              </p>
            </div>
          </div>
        </div>
      </div>
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentPath={location.pathname}
      />
    </div>
  );
}
