import { useState, useEffect, useRef } from 'react';
import { X, Search, Check } from 'lucide-react';
import { CURRENCIES, getFlagUrl } from '../../exchange/constants';
import type { AlertCondition } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    currencyCode: string;
    targetRate: number;
    refRate: number;
    condition: AlertCondition;
    repeat: boolean;
  }) => void;
  /** rates Record<string, number> (USD-base) to compute current KRW rates */
  rates: Record<string, number>;
}

function getKrwRate(code: string, rates: Record<string, number>): number | null {
  if (!rates['KRW'] || !rates[code]) return null;
  return rates['KRW'] / rates[code];
}

function fmtRate(rate: number): string {
  return rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function AlertSetupSheet({ isOpen, onClose, onSave, rates }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('USD');
  const [targetInput, setTargetInput] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('below');
  const [repeat, setRepeat] = useState(false);
  const [step, setStep] = useState<'currency' | 'config'>('currency');
  const inputRef = useRef<HTMLInputElement>(null);

  const currentKrwRate = getKrwRate(selectedCode, rates);

  /* 시트 열릴 때 초기화 */
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setStep('currency');
      setSelectedCode('USD');
      setCondition('below');
      setRepeat(false);
      setTargetInput('');
    }
  }, [isOpen]);

  /* currency 선택 후 config 단계로 이동 시 현재 환율 자동 입력 */
  useEffect(() => {
    if (step === 'config' && currentKrwRate !== null) {
      setTargetInput(currentKrwRate.toFixed(2));
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code !== 'KRW' &&
      (c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.nameKo.includes(search) ||
        c.name.toLowerCase().includes(search.toLowerCase())),
  );

  const applyQuick = (pct: number) => {
    if (currentKrwRate === null) return;
    const newRate = currentKrwRate * (1 + pct / 100);
    setTargetInput(newRate.toFixed(2));
  };

  const handleSave = () => {
    const targetRate = parseFloat(targetInput);
    if (!targetRate || targetRate <= 0) return;
    const refRate = currentKrwRate ?? targetRate;
    onSave({ currencyCode: selectedCode, targetRate, refRate, condition, repeat });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 백드롭 */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* 시트 패널 */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
      >
        {/* 핸들 + 헤더 */}
        <div className="flex-shrink-0 pt-3 px-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step === 'config' && (
                <button
                  onClick={() => setStep('currency')}
                  className="text-slate-400 hover:text-slate-700 text-sm"
                >
                  ← 통화 재선택
                </button>
              )}
              {step === 'currency' && (
                <h2 className="text-base font-bold text-slate-900">통화 선택</h2>
              )}
              {step === 'config' && (
                <h2 className="text-base font-bold text-slate-900">알림 설정</h2>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: 통화 선택 ── */}
          {step === 'currency' && (
            <div className="px-4 pt-3 pb-4 space-y-3">
              {/* 검색 */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <Search size={15} className="text-slate-400 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="통화 검색 (USD, 달러 ...)"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300"
                />
              </div>

              {/* 통화 목록 */}
              <ul className="space-y-1">
                {filteredCurrencies.map((c) => (
                  <li key={c.code}>
                    <button
                      onClick={() => { setSelectedCode(c.code); setStep('config'); }}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                        selectedCode === c.code ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800',
                      ].join(' ')}
                    >
                      <img
                      src={getFlagUrl(c.code, 40)}
                      alt={c.code}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-slate-100"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = getFlagUrl('un', 40); }}
                    />
                      <div className="flex-1 text-left min-w-0">
                        <p className={['text-sm font-semibold', selectedCode === c.code ? 'text-white' : 'text-slate-900'].join(' ')}>
                          {c.code}
                        </p>
                        <p className={['text-xs truncate', selectedCode === c.code ? 'text-white/70' : 'text-slate-400'].join(' ')}>
                          {c.nameKo}
                        </p>
                      </div>
                      {selectedCode === c.code && <Check size={16} className="text-white flex-shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Step 2: 알림 설정 ── */}
          {step === 'config' && (
            <div className="px-4 pt-4 pb-4 space-y-5">
              {/* 현재 환율 표시 */}
              {currentKrwRate !== null && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                  <img
                    src={getFlagUrl(selectedCode, 40)}
                    alt={selectedCode}
                    className="w-7 h-7 rounded-full object-cover bg-slate-100"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = getFlagUrl('un', 40); }}
                  />
                  <div>
                    <p className="text-xs text-slate-400">현재 환율</p>
                    <p className="text-sm font-bold text-slate-900">1 {selectedCode} = {fmtRate(currentKrwRate)}원</p>
                  </div>
                </div>
              )}

              {/* 목표 환율 입력 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">목표 환율 (원)</p>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                />

                {/* 퀵 버튼 */}
                <div className="flex gap-2 mt-2">
                  {(condition === 'below'
                    ? [{ label: '-1%', pct: -1 }, { label: '-3%', pct: -3 }, { label: '-5%', pct: -5 }]
                    : [{ label: '+1%', pct: 1 }, { label: '+3%', pct: 3 }, { label: '+5%', pct: 5 }]
                  ).map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => applyQuick(pct)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 조건 선택 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">알림 조건</p>
                <div className="flex gap-2">
                  {([
                    { value: 'below', label: '이하 (하락 시)', icon: '📉' },
                    { value: 'above', label: '이상 (상승 시)', icon: '📈' },
                  ] as const).map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => setCondition(value)}
                      className={[
                        'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all',
                        condition === value
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600',
                      ].join(' ')}
                    >
                      <span className="text-lg">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 반복 여부 */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-semibold text-slate-800">반복 알림</p>
                  <p className="text-xs text-slate-400 mt-0.5">조건 충족 시마다 반복 발송</p>
                </div>
                <button
                  onClick={() => setRepeat((v) => !v)}
                  className={[
                    'w-11 h-6 rounded-full relative transition-colors duration-200',
                    repeat ? 'bg-slate-900' : 'bg-slate-200',
                  ].join(' ')}
                  aria-label={repeat ? '반복 비활성화' : '반복 활성화'}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
                      repeat ? 'translate-x-5' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={!targetInput || parseFloat(targetInput) <= 0}
                className="w-full py-4 bg-slate-900 text-white text-sm font-bold rounded-2xl disabled:opacity-30 active:scale-[0.98] transition-all"
              >
                알림 추가
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
