import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  ArrowLeft,
  Menu,
  Plus,
  Trash2,
  X,
  Copy,
  Download,
  Upload,
  RotateCcw,
  ArrowRight,
  Users,
  Receipt,
  BarChart3,
  Check,
  Pencil,
  Circle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useDutchPayStore, genId } from '../store';
import {
  calculateSettlement,
  getTotalExpenseKRW,
  getMemberStats,
  getBudgetStats,
  fmtKRW,
  BUDGET_PAYER_ID,
} from '../utils';
import type { MemberStat } from '../utils';
import { MenuDrawer } from '../../../core/ui/MenuDrawer';
import type { SplitType, DutchPayTab, Expense } from '../types';

/* ─────────────────────────────── 상수 ─────────────────────────────── */
const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'THB', 'SGD', 'HKD', 'AUD'];
const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: '₩', USD: '$', JPY: '¥', EUR: '€', GBP: '£',
  CNY: '¥', THB: '฿', SGD: 'S$', HKD: 'HK$', AUD: 'A$',
};
const SPLIT_LABELS: Record<SplitType, string> = {
  EQUAL: '균등',
  AMOUNT: '금액 지정',
  WEIGHT: '비중',
};

/* ─────────────────────────────── 폼 타입 ─────────────────────────── */
type ParticipantEntry = { checked: boolean; value: string };
type FormState = {
  title: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  payerId: string;
  splitType: SplitType;
  participants: Record<string, ParticipantEntry>;
};

const buildBlankForm = (
  members: { id: string; name: string }[],
  defaultPayerId = '',
): FormState => ({
  title: '',
  amount: '',
  currency: 'KRW',
  exchangeRate: '1',
  payerId: defaultPayerId || members[0]?.id || '',
  splitType: 'EQUAL',
  participants: Object.fromEntries(
    members.map((m) => [m.id, { checked: true, value: '' }]),
  ),
});

const buildFormFromExpense = (
  expense: Expense,
  members: { id: string; name: string }[],
): FormState => {
  const pMap = new Map(expense.participants.map((p) => [p.memberId, p]));
  return {
    title: expense.title,
    amount: String(expense.amount),
    currency: expense.currency,
    exchangeRate: String(expense.exchangeRate),
    payerId: expense.payerId,
    splitType: expense.splitType,
    participants: Object.fromEntries(
      members.map((m) => {
        const p = pMap.get(m.id);
        let value = '';
        if (p) {
          if (expense.splitType === 'AMOUNT') value = String(p.amount ?? '');
          else if (expense.splitType === 'WEIGHT') value = String(p.weight ?? '');
        }
        return [m.id, { checked: !!p, value }];
      }),
    ),
  };
};

/* ─────────────────────────────── 컴포넌트 ─────────────────────────── */
export function DutchPayPage() {
  const {
    members,
    expenses,
    initialBudget,
    addMember,
    deleteMember,
    setInitialBudget,
    addExpense,
    updateExpense,
    deleteExpense,
    completedSettlements,
    toggleSettlementCompleted,
    clearCompletedSettlements,
    importData,
    reset,
  } = useDutchPayStore();

  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DutchPayTab>('members');
  const [memberInput, setMemberInput] = useState('');
  const [budgetInput, setBudgetInput] = useState(initialBudget ? String(initialBudget) : '');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => buildBlankForm(members));
  const [copied, setCopied] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const importRef = useRef<HTMLInputElement>(null);

  /* ── 파생 계산 ── */
  const totalKRW = getTotalExpenseKRW(expenses);
  const remaining = initialBudget - totalKRW;
  const settlementResults = calculateSettlement(members, expenses);
  const memberStats = getMemberStats(members, expenses);
  const checkedCount = Object.values(form.participants).filter((v) => v.checked).length;
  const memberName = (id: string) => {
    if (id === BUDGET_PAYER_ID) return '공동자금';
    return members.find((m) => m.id === id)?.name ?? '?';
  };

  // 공동자금 현황 (정산 탭 표시용)
  const budgetStats = getBudgetStats(expenses, initialBudget, members.length);

  // 폼 내 공동자금 잔액 (현재 수정 중인 지출 제외)
  const budgetUsedForForm = expenses
    .filter((e) => e.payerId === BUDGET_PAYER_ID && e.id !== (editingId ?? ''))
    .reduce((s, e) => s + e.amount * e.exchangeRate, 0);
  const budgetRemainingForForm = initialBudget - budgetUsedForForm;

  const sKey = (r: { from: string; to: string; amount: number }) =>
    `${r.from}::${r.to}::${r.amount}`;
  const completedCount = settlementResults.filter((r) =>
    completedSettlements.includes(sKey(r)),
  ).length;
  const allCompleted = settlementResults.length > 0 && completedCount === settlementResults.length;

  /* ── 멤버 추가 ── */
  const handleAddMember = () => {
    const name = memberInput.trim();
    if (!name || members.some((m) => m.name === name)) return;
    addMember(name);
    setMemberInput('');
    // 폼이 열려 있으면 참여자 목록에 신규 멤버 추가
    setForm((f) => ({
      ...f,
      participants: { ...f.participants, [genId()]: { checked: true, value: '' } },
    }));
  };

  /* ── 예산 저장 ── */
  const handleBudgetSave = () => {
    const v = parseFloat(budgetInput);
    setInitialBudget(isNaN(v) || v < 0 ? 0 : v);
  };

  /* ── 신규 지출 폼 열기 ── */
  const openForm = () => {
    setEditingId(null);
    setForm(buildBlankForm(members));
    setShowForm(true);
  };

  /* ── 수정 폼 열기 ── */
  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
    setForm(buildFormFromExpense(expense, members));
    setShowForm(true);
  };

  /* ── 폼 닫기 ── */
  const closeForm = () => {
    setEditingId(null);
    setShowForm(false);
  };

  /* ── 폼 필드 헬퍼 ── */
  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleParticipant = (id: string) =>
    setForm((f) => ({
      ...f,
      participants: {
        ...f.participants,
        [id]: { ...f.participants[id], checked: !f.participants[id]?.checked },
      },
    }));

  const setParticipantValue = (id: string, value: string) =>
    setForm((f) => ({
      ...f,
      participants: { ...f.participants, [id]: { ...f.participants[id], value } },
    }));

  const selectAllParticipants = () =>
    setForm((f) => ({
      ...f,
      participants: Object.fromEntries(
        members.map((m) => [m.id, { ...f.participants[m.id], checked: true }]),
      ),
    }));

  const deselectAllParticipants = () =>
    setForm((f) => ({
      ...f,
      participants: Object.fromEntries(
        members.map((m) => [m.id, { ...f.participants[m.id], checked: false }]),
      ),
    }));

  /* ── 지출 저장 ── */
  const handleSubmit = () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || isNaN(amount) || amount <= 0 || !form.payerId) return;
    const rate = form.currency === 'KRW' ? 1 : parseFloat(form.exchangeRate) || 1;
    const checked = Object.entries(form.participants).filter(([, v]) => v.checked);
    if (checked.length === 0) return;

    // AMOUNT: 빈칸 참여자는 나머지 균등 배분
    const amtSpecified = checked
      .filter(([, v]) => v.value.trim())
      .reduce((s, [, v]) => s + (parseFloat(v.value) || 0), 0);
    const amtBlankCnt = checked.filter(([, v]) => !v.value.trim()).length;
    const amtRemainder = amtBlankCnt > 0 ? (amount - amtSpecified) / amtBlankCnt : 0;

    const participants = checked.map(([memberId, v]) => {
      if (form.splitType === 'AMOUNT')
        return { memberId, amount: v.value.trim() ? parseFloat(v.value) || 0 : amtRemainder };
      if (form.splitType === 'WEIGHT') return { memberId, weight: parseFloat(v.value) || 1 };
      return { memberId };
    });

    const payload = {
      title: form.title.trim(),
      amount,
      currency: form.currency,
      exchangeRate: rate,
      payerId: form.payerId,
      participants,
      splitType: form.splitType,
      date: editingId
        ? (expenses.find((e) => e.id === editingId)?.date ?? new Date().toISOString())
        : new Date().toISOString(),
    };

    if (editingId) {
      updateExpense(editingId, payload);
    } else {
      addExpense(payload);
    }
    setEditingId(null);
    setShowForm(false);
  };

  /* ── 카카오톡 공유 텍스트 ── */
  const handleCopyShare = async () => {
    const memberName = (id: string) => {
      if (id === BUDGET_PAYER_ID) return '공동자금';
      return members.find((m) => m.id === id)?.name ?? '?';
    };

    const expenseLines = expenses.map((e) => {
      const sym = CURRENCY_SYMBOLS[e.currency] ?? '';
      const amtStr =
        e.currency === 'KRW'
          ? fmtKRW(e.amount)
          : `${sym}${e.amount.toLocaleString()} ${e.currency} (≈${fmtKRW(e.amount * e.exchangeRate)})`;
      return `• ${e.title}: ${amtStr} — 결제: ${memberName(e.payerId)}`;
    });

    const breakdownLines: string[] = [];
    for (const e of expenses) {
      const totalKRW = e.amount * e.exchangeRate;
      const sym = CURRENCY_SYMBOLS[e.currency] ?? '';
      const amtStr =
        e.currency === 'KRW'
          ? fmtKRW(e.amount)
          : `${sym}${e.amount.toLocaleString()} ${e.currency} (≈${fmtKRW(totalKRW)})`;
      breakdownLines.push(`▸ ${e.title}  [${amtStr} / 결제: ${memberName(e.payerId)}]`);

      const shares: { memberId: string; amount: number }[] = (() => {
        if (e.splitType === 'AMOUNT')
          return e.participants.map((p) => ({
            memberId: p.memberId,
            amount: (p.amount ?? 0) * e.exchangeRate,
          }));
        if (e.splitType === 'WEIGHT') {
          const tw = e.participants.reduce((s, p) => s + (p.weight ?? 1), 0);
          return e.participants.map((p) => ({
            memberId: p.memberId,
            amount: tw > 0 ? totalKRW * ((p.weight ?? 1) / tw) : 0,
          }));
        }
        const share = e.participants.length > 0 ? totalKRW / e.participants.length : 0;
        return e.participants.map((p) => ({ memberId: p.memberId, amount: share }));
      })();

      for (const { memberId, amount } of shares) {
        const tag = memberId === e.payerId ? ' (결제)' : '';
        breakdownLines.push(`  • ${memberName(memberId)}${tag}: ${fmtKRW(amount)}`);
      }
    }

    const statLines = memberStats.map((s) => {
      const netTag =
        s.net > 0.5
          ? `총 ${fmtKRW(s.net)} 입금예정`
          : s.net < -0.5
            ? `${fmtKRW(Math.abs(s.net))} 송금 필요`
            : '정산 완료';
      return `• ${s.name}: 결제 ${fmtKRW(s.paid)} | 부담 ${fmtKRW(s.owed)} → ${netTag}`;
    });

    const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    const settlementLines = settlementResults.length
      ? settlementResults.map(
        (r, i) =>
          `${CIRCLE_NUMS[i] ?? `${i + 1}.`}  ${r.from}  →  ${r.to}  :  ${fmtKRW(r.amount)}`,
      )
      : ['✅ 추가 송금 없음'];

    const lines = [
      '🧮 여행/모임 정산 결과',
      '',
      `💰 총 지출: ${fmtKRW(totalKRW)}`,
      '',
      `📋 지출 내역 (${expenses.length}건)`,
      '─────────────────',
      ...expenseLines,
      '─────────────────',
      '',
      '📊 지출별 분담 내역',
      '─────────────────',
      ...breakdownLines,
      '─────────────────',
      '',
      '👤 개인별 사용 내역',
      '─────────────────',
      ...statLines,
      '─────────────────',
      '',
      '══════════════════════',
      `💸 최종 송금 내역 (${settlementResults.length}건)`,
      '══════════════════════',
      ...settlementLines,
      '══════════════════════',
      '',
      '👆 위 금액 확인 후 송금해주세요!',
      `✅ 총 ${settlementResults.length}건의 송금으로 정산 완료!`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  /* ── JSON 내보내기 ── */
  const handleExport = async () => {
    const json = JSON.stringify({ members, expenses, initialBudget }, null, 2);
    const filename = `dutch-pay-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/i.test(ua);

    setExportStatus('saving');
    try {
      // 0. Capacitor Native Platform (Android/iOS App)
      if (Capacitor.isNativePlatform()) {
        if (isAndroid) {
          // Android: Documents 폴더에 직접 저장
          await Filesystem.writeFile({
            path: filename,
            data: json,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true,
          });
          setExportStatus('done');
          return;
        }

        // iOS Native: Cache에 저장 후 share sheet (Files 앱에 저장 가능)
        const result = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: '정산 데이터 내보내기',
          files: [result.uri],
          dialogTitle: '데이터 저장 및 공유',
        });
        setExportStatus('done');
        return;
      }

      // ① Android Browser: await 없이 즉시 blob URL anchor download
      if (isAndroid) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportStatus('done');
        return;
      }

      // ② iOS Browser: navigator.share 또는 fallback
      if (isIOS) {
        if (typeof navigator.share === 'function') {
          const file = new File([blob], filename, { type: 'application/json' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: '정산 데이터' });
            setExportStatus('done');
            return;
          }
        }
        window.open(URL.createObjectURL(blob), '_blank');
        setExportStatus('done');
        return;
      }

      // ③ Desktop Chrome·Edge: showSaveFilePicker
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (
            window as Window & {
              showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
            }
          ).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'JSON 파일', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setExportStatus('done');
          return;
        } catch (err) {
          if ((err as DOMException).name === 'AbortError') {
            setExportStatus('idle');
            return;
          }
        }
      }

      // ④ Desktop 기타 브라우저 fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus('done');
    } catch {
      setExportStatus('error');
    } finally {
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  /* ── JSON 가져오기 ── */
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data.members) && Array.isArray(data.expenses)) {
          importData(data);
        }
      } catch {
        /* invalid JSON — 무시 */
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ── AMOUNT / WEIGHT 파생 계산 ── */
  const totalAmount = parseFloat(form.amount || '0');
  const checkedMembers = members.filter((m) => form.participants[m.id]?.checked);

  // AMOUNT: 값 입력된 참여자 합계, 빈칸 참여자 수, 나머지 1인분
  const amountSpecifiedSum =
    form.splitType === 'AMOUNT'
      ? checkedMembers.reduce((s, m) => {
        const val = (form.participants[m.id]?.value ?? '').trim();
        return s + (val ? parseFloat(val) || 0 : 0);
      }, 0)
      : 0;
  const amountBlankCount =
    form.splitType === 'AMOUNT'
      ? checkedMembers.filter((m) => !(form.participants[m.id]?.value ?? '').trim()).length
      : 0;
  const amountRemainder = totalAmount - amountSpecifiedSum;
  const amountRemainderPerPerson = amountBlankCount > 0 ? amountRemainder / amountBlankCount : 0;

  // 저장 불가 조건: 지정 합계가 총액 초과 OR (모두 지정인데 합계 불일치)
  const amountMismatch =
    form.splitType === 'AMOUNT' &&
    !!form.amount &&
    totalAmount > 0 &&
    (amountSpecifiedSum > totalAmount + 0.01 ||
      (amountBlankCount === 0 && Math.abs(amountSpecifiedSum - totalAmount) > 0.01));

  // WEIGHT: 각자 부담 금액 계산
  const weightTotal =
    form.splitType === 'WEIGHT'
      ? checkedMembers.reduce(
        (s, m) => s + (parseFloat(form.participants[m.id]?.value) || 1),
        0,
      )
      : 0;
  const getWeightedAmount = (memberId: string) =>
    weightTotal > 0
      ? totalAmount * ((parseFloat(form.participants[memberId]?.value) || 1) / weightTotal)
      : 0;

  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-200 flex justify-center">
      <div
        className="h-screen w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* ────────── 헤더 ────────── */}
        <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
          <Link
            to="/"
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold text-slate-900">여행/모임 정산</h1>
          <div className="flex items-center">
            <button
              onClick={() => {
                if (confirm('전체 데이터를 초기화할까요?')) {
                  reset();
                  setBudgetInput('');
                }
              }}
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

        {/* ────────── 대시보드 ────────── */}
        <div className="flex-shrink-0 bg-slate-900 px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { label: '초기 예산', value: fmtKRW(initialBudget), sub: '' },
            { label: '총 지출', value: fmtKRW(totalKRW), sub: `${expenses.length}건` },
            {
              label: '잔액',
              value: fmtKRW(Math.abs(remaining)),
              sub: remaining < 0 ? '예산 초과' : '남음',
              warn: remaining < 0,
            },
          ].map(({ label, value, sub, warn }) => (
            <div key={label} className="bg-white/10 rounded-xl px-2 py-2 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
              <p
                className={[
                  'text-sm font-bold tabular-nums truncate',
                  warn ? 'text-red-400' : 'text-white',
                ].join(' ')}
              >
                {value}
              </p>
              {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ────────── 탭 바 ────────── */}
        <div className="flex-shrink-0 flex border-b border-slate-100">
          {(
            [
              { key: 'members', label: '멤버/예산', icon: Users },
              { key: 'expenses', label: '지출 내역', icon: Receipt },
              { key: 'settlement', label: '정산 결과', icon: BarChart3 },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2',
                activeTab === key
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-400 border-transparent',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ────────── 탭 콘텐츠 ────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ 멤버/예산 탭 ══ */}
          {activeTab === 'members' && (
            <div
              className="px-4 py-4 space-y-5"
              style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {/* 초기 예산 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  초기 예산 (KRW)
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">
                      ₩
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      onBlur={handleBudgetSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleBudgetSave()}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                    />
                  </div>
                  <button
                    onClick={handleBudgetSave}
                    className="px-4 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl active:scale-95 transition-all"
                  >
                    저장
                  </button>
                </div>
              </div>

              {/* 멤버 추가 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  멤버 ({members.length}명)
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                    placeholder="이름 입력 (최대 6자)"
                    maxLength={6}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleAddMember}
                    disabled={!memberInput.trim()}
                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                    aria-label="멤버 추가"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    멤버를 추가해 주세요
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {m.name[0]}
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{m.name}</span>
                        </div>
                        <button
                          onClick={() => deleteMember(m.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 active:bg-red-50 rounded-lg transition-colors"
                          aria-label={`${m.name} 삭제`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ 지출 내역 탭 ══ */}
          {activeTab === 'expenses' && (
            <div className="flex flex-col h-full">
              <div className="px-4 pt-4 pb-2 flex-shrink-0">
                <button
                  onClick={openForm}
                  disabled={members.length < 2}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40 active:scale-95 transition-all"
                >
                  <Plus size={18} />
                  지출 추가
                </button>
                {members.length < 2 && (
                  <p className="text-xs text-center text-slate-400 mt-1.5">
                    멤버를 2명 이상 추가해야 지출을 기록할 수 있어요
                  </p>
                )}
              </div>

              <div
                className="flex-1 overflow-y-auto px-4 space-y-2"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
              >
                {expenses.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                    아직 지출 내역이 없습니다
                  </div>
                ) : (
                  expenses.map((e) => (
                    <div
                      key={e.id}
                      className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{e.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            결제:{' '}
                            <span className="font-semibold text-slate-700">
                              {memberName(e.payerId)}
                            </span>
                            &nbsp;·&nbsp;{SPLIT_LABELS[e.splitType]}
                            &nbsp;·&nbsp;{e.participants.length}명
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(e.date).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-900">
                            {CURRENCY_SYMBOLS[e.currency] ?? ''}
                            {e.amount.toLocaleString()}
                            {e.currency !== 'KRW' && (
                              <span className="text-[10px] font-normal text-slate-400">
                                {' '}{e.currency}
                              </span>
                            )}
                          </p>
                          {e.currency !== 'KRW' && (
                            <p className="text-[11px] text-slate-400">
                              {fmtKRW(e.amount * e.exchangeRate)}
                            </p>
                          )}
                          <div className="mt-1 flex justify-end gap-1">
                            <button
                              onClick={() => openEditForm(e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                              aria-label="수정"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteExpense(e.id)}
                              className="p-1 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                              aria-label="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══ 정산 결과 탭 ══ */}
          {activeTab === 'settlement' && (
            <div
              className="px-4 py-4 space-y-4"
              style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {/* 공동자금 현황 */}
              {initialBudget > 0 && budgetStats.budgetUsed > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    공동자금 현황
                  </p>
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-800">초기 예산</span>
                      <span className="text-sm font-bold text-amber-900 tabular-nums">
                        {fmtKRW(initialBudget)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-600">사용</span>
                      <span className="text-xs font-semibold text-amber-800 tabular-nums">
                        {fmtKRW(budgetStats.budgetUsed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                      <span className="text-xs font-semibold text-amber-700">잔액</span>
                      <span
                        className={[
                          'text-sm font-black tabular-nums',
                          budgetStats.budgetRemaining < 0 ? 'text-red-600' : 'text-emerald-600',
                        ].join(' ')}
                      >
                        {budgetStats.budgetRemaining < 0 ? '-' : ''}
                        {fmtKRW(Math.abs(budgetStats.budgetRemaining))}
                      </span>
                    </div>
                    {budgetStats.shortfall > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        <p className="text-[11px] text-red-600 font-semibold">
                          ⚠ 공동자금 {fmtKRW(budgetStats.shortfall)} 초과
                        </p>
                        {members.length > 0 && (
                          <p className="text-[11px] text-red-500 mt-0.5">
                            → {members.length}명, 1인당{' '}
                            <span className="font-bold">
                              {fmtKRW(budgetStats.shortfallPerMember)}
                            </span>{' '}
                            추가 필요
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 개인별 사용 내역 */}
              {expenses.length > 0 && members.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    개인별 사용 내역
                  </p>
                  <div className="space-y-2">
                    {memberStats.map((s: MemberStat) => (
                      <div
                        key={s.id}
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {s.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900">{s.name}</p>
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-[11px] text-slate-500">
                                결제 <span className="font-semibold text-slate-700">{fmtKRW(s.paid)}</span>
                              </span>
                              <span className="text-[11px] text-slate-400">|</span>
                              <span className="text-[11px] text-slate-500">
                                부담 <span className="font-semibold text-slate-700">{fmtKRW(s.owed)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {Math.abs(s.net) < 0.5 ? (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                정산 완료
                              </span>
                            ) : s.net > 0 ? (
                              <div>
                                <p className="text-sm font-black text-emerald-600 tabular-nums">
                                  +{fmtKRW(s.net)}
                                </p>
                                <p className="text-[10px] text-emerald-500">받을 돈</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-black text-red-500 tabular-nums">
                                  -{fmtKRW(Math.abs(s.net))}
                                </p>
                                <p className="text-[10px] text-red-400">줄 돈</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 지출별 분담 내역 */}
              {expenses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    지출별 분담 내역
                  </p>
                  <div className="space-y-2">
                    {expenses.map((e) => {
                      const totalKRW = e.amount * e.exchangeRate;
                      const shares: { memberId: string; amount: number }[] = (() => {
                        if (e.splitType === 'AMOUNT')
                          return e.participants.map((p) => ({
                            memberId: p.memberId,
                            amount: (p.amount ?? 0) * e.exchangeRate,
                          }));
                        if (e.splitType === 'WEIGHT') {
                          const tw = e.participants.reduce((s, p) => s + (p.weight ?? 1), 0);
                          return e.participants.map((p) => ({
                            memberId: p.memberId,
                            amount: tw > 0 ? totalKRW * ((p.weight ?? 1) / tw) : 0,
                          }));
                        }
                        // EQUAL
                        const share =
                          e.participants.length > 0 ? totalKRW / e.participants.length : 0;
                        return e.participants.map((p) => ({ memberId: p.memberId, amount: share }));
                      })();

                      return (
                        <div
                          key={e.id}
                          className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3"
                        >
                          {/* 지출 헤더 */}
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{e.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                결제:{' '}
                                <span className="font-semibold text-slate-600">
                                  {memberName(e.payerId)}
                                </span>
                                {' '}·{' '}{SPLIT_LABELS[e.splitType]}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-slate-900 flex-shrink-0 ml-2 tabular-nums">
                              {fmtKRW(totalKRW)}
                            </p>
                          </div>

                          {/* 참여자별 분담 */}
                          <div className="space-y-1.5">
                            {shares.map(({ memberId, amount }) => {
                              const isPayer = memberId === e.payerId;
                              return (
                                <div key={memberId} className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      className={[
                                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                                        isPayer
                                          ? 'bg-slate-900 text-white'
                                          : 'bg-slate-200 text-slate-600',
                                      ].join(' ')}
                                    >
                                      {memberName(memberId)[0]}
                                    </div>
                                    <span className="text-xs text-slate-700 font-medium">
                                      {memberName(memberId)}
                                    </span>
                                    {isPayer && (
                                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                        결제
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={[
                                      'text-xs font-bold tabular-nums',
                                      isPayer ? 'text-slate-900' : 'text-slate-600',
                                    ].join(' ')}
                                  >
                                    {fmtKRW(amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 결과 카드 */}
              {settlementResults.length === 0 && expenses.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-6 text-center">
                  <p className="text-3xl mb-1">🎉</p>
                  <p className="text-sm font-bold text-emerald-700">모두 정산 완료!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">추가 송금이 필요 없습니다</p>
                </div>
              ) : settlementResults.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                  지출을 입력하면 정산 결과가 표시됩니다
                </div>
              ) : (
                <>
                  <div>
                    {/* 헤더 + 완료 진행도 */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        송금 목록 ({settlementResults.length}건)
                      </p>
                      <div className="flex items-center gap-2">
                        {completedCount > 0 && (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {completedCount}/{settlementResults.length} 완료
                          </span>
                        )}
                        {completedCount > 0 && (
                          <button
                            onClick={clearCompletedSettlements}
                            className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                          >
                            초기화
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 전체 완료 배너 */}
                    {allCompleted && (
                      <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <span className="text-lg">🎉</span>
                        <p className="text-sm font-bold text-emerald-700">모든 송금이 완료됐어요!</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {settlementResults.map((r, i) => {
                        const key = sKey(r);
                        const done = completedSettlements.includes(key);
                        return (
                          <div
                            key={i}
                            className={[
                              'rounded-2xl px-4 py-3 flex items-center gap-3 transition-all',
                              done ? 'bg-slate-700/60' : 'bg-slate-900',
                            ].join(' ')}
                          >
                            {/* 완료 체크 버튼 */}
                            <button
                              onClick={() => toggleSettlementCompleted(key)}
                              className="flex-shrink-0 transition-transform active:scale-90"
                              aria-label={done ? '완료 취소' : '완료 표시'}
                            >
                              {done ? (
                                <CheckCircle2 size={22} className="text-emerald-400" />
                              ) : (
                                <Circle size={22} className="text-slate-600" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div
                                className={[
                                  'flex items-center gap-1.5 text-sm',
                                  done ? 'opacity-40 line-through' : '',
                                ].join(' ')}
                              >
                                <span className="font-bold text-white truncate">{r.from}</span>
                                <ArrowRight size={13} className="text-slate-400 flex-shrink-0" />
                                <span className="font-bold text-slate-300 truncate">{r.to}</span>
                              </div>
                            </div>

                            <p
                              className={[
                                'text-base font-black tabular-nums flex-shrink-0 transition-all',
                                done ? 'text-slate-500 line-through' : 'text-white',
                              ].join(' ')}
                            >
                              {fmtKRW(r.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 카카오톡 공유 */}
                  <button
                    onClick={handleCopyShare}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 text-slate-900 text-sm font-bold rounded-2xl active:scale-95 transition-all"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? '복사 완료!' : '카카오톡 공유용 복사'}
                  </button>
                </>
              )}

              {/* 데이터 관리 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  데이터 관리
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={
                      (members.length === 0 && expenses.length === 0) ||
                      exportStatus === 'saving'
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {exportStatus === 'saving' && <Loader2 size={15} className="animate-spin" />}
                    {exportStatus === 'done' && <Check size={15} className="text-green-600" />}
                    {exportStatus === 'error' && <X size={15} className="text-red-500" />}
                    {exportStatus === 'idle' && <Download size={15} />}
                    {exportStatus === 'saving'
                      ? '저장 중...'
                      : exportStatus === 'done'
                        ? '저장 완료!'
                        : exportStatus === 'error'
                          ? '저장 실패'
                          : '내보내기'}
                  </button>
                  <button
                    onClick={() => importRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl active:scale-95 transition-all"
                  >
                    <Upload size={15} /> 불러오기
                  </button>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ 지출 입력 Bottom Sheet ════════════════ */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={closeForm}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
            <div
              className="w-full max-w-sm bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{
                maxHeight: '90vh',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* 시트 헤더 */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? '지출 수정' : '지출 추가'}
                </h3>
                <button
                  onClick={closeForm}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                  aria-label="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 폼 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* 항목명 */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    항목명
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="예: 저녁 식사, 숙소, 교통비..."
                    maxLength={30}
                    className="mt-1.5 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                  />
                </div>

                {/* 금액 + 통화 */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    금액
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setField('amount', e.target.value)}
                      placeholder="0"
                      className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                    />
                    <select
                      value={form.currency}
                      onChange={(e) => {
                        setField('currency', e.target.value);
                        if (e.target.value === 'KRW') setField('exchangeRate', '1');
                      }}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 환율 (KRW가 아닐 때) */}
                {form.currency !== 'KRW' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      환율 (1 {form.currency} = ? KRW)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.exchangeRate}
                      onChange={(e) => setField('exchangeRate', e.target.value)}
                      placeholder="환율 입력"
                      className="mt-1.5 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                    />
                    {form.amount && form.exchangeRate && (
                      <p className="text-xs text-slate-400 text-right mt-1">
                        ≈&nbsp;{fmtKRW(parseFloat(form.amount || '0') * parseFloat(form.exchangeRate || '1'))}
                      </p>
                    )}
                  </div>
                )}

                {/* 결제자 */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    결제자
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {/* 공동자금 버튼 */}
                    {initialBudget > 0 && (
                      <button
                        onClick={() => setField('payerId', BUDGET_PAYER_ID)}
                        className={[
                          'px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all',
                          form.payerId === BUDGET_PAYER_ID
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400',
                        ].join(' ')}
                      >
                        공동자금
                      </button>
                    )}
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setField('payerId', m.id)}
                        className={[
                          'px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all',
                          form.payerId === m.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                        ].join(' ')}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>

                  {/* 공동자금 선택 시 잔액 및 초과 경고 */}
                  {form.payerId === BUDGET_PAYER_ID && (
                    <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-amber-600">공동자금 잔액</span>
                        <span
                          className={[
                            'text-[11px] font-bold',
                            budgetRemainingForForm < 0 ? 'text-red-600' : 'text-amber-700',
                          ].join(' ')}
                        >
                          {fmtKRW(Math.abs(budgetRemainingForForm))}
                          {budgetRemainingForForm < 0 ? ' (초과)' : ' 남음'}
                        </span>
                      </div>
                      {totalAmount > 0 && totalAmount > budgetRemainingForForm && budgetRemainingForForm > 0 && (
                        <p className="text-[11px] text-red-500">
                          ⚠ 잔액 초과 {fmtKRW(totalAmount - budgetRemainingForForm)} — 별도 정산 필요
                        </p>
                      )}
                      {budgetRemainingForForm <= 0 && (
                        <p className="text-[11px] text-red-500">
                          ⚠ 공동자금이 소진됐습니다 — 별도 정산 필요
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 참여자 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      참여자 ({checkedCount}명 선택)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllParticipants}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                      >
                        전체 선택
                      </button>
                      <span className="text-slate-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={deselectAllParticipants}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
                      >
                        전체 해제
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {members.map((m) => {
                      const p = form.participants[m.id];
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleParticipant(m.id)}
                          className={[
                            'px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all',
                            p?.checked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                          ].join(' ')}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 정산 방식 */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    정산 방식
                  </label>
                  <div className="mt-1.5 flex rounded-xl overflow-hidden border border-slate-200">
                    {(['EQUAL', 'AMOUNT', 'WEIGHT'] as SplitType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setField('splitType', type)}
                        className={[
                          'flex-1 py-2.5 text-xs font-bold transition-colors',
                          form.splitType === type
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {SPLIT_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {form.splitType === 'EQUAL' && '참여 인원이 동일하게 나눕니다'}
                    {form.splitType === 'AMOUNT' && '각자 부담할 금액을 직접 입력합니다'}
                    {form.splitType === 'WEIGHT' && '비중을 입력하면 그 비율로 나눕니다 (예: 1, 2, 1)'}
                  </p>
                </div>

                {/* AMOUNT / WEIGHT 개별 입력 */}
                {(form.splitType === 'AMOUNT' || form.splitType === 'WEIGHT') && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {form.splitType === 'AMOUNT' ? '개별 부담 금액' : '비중 (숫자)'}
                    </label>
                    <div className="mt-1.5 space-y-2">
                      {checkedMembers.map((m) => {
                        const isBlank = !(form.participants[m.id]?.value ?? '').trim();
                        // AMOUNT: 빈칸일 때 placeholder에 자동 계산값 표시
                        const amountPlaceholder =
                          form.splitType === 'AMOUNT' &&
                            isBlank &&
                            amountBlankCount > 0 &&
                            amountRemainder >= 0 &&
                            totalAmount > 0
                            ? `≈ ${Math.round(amountRemainderPerPerson).toLocaleString()} (자동)`
                            : form.splitType === 'AMOUNT'
                              ? '금액 입력'
                              : '비중 (기본 1)';

                        return (
                          <div key={m.id} className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                              {m.name[0]}
                            </div>
                            <span className="w-12 text-xs font-semibold text-slate-700 truncate flex-shrink-0">
                              {m.name}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={form.participants[m.id]?.value ?? ''}
                              onChange={(e) => setParticipantValue(m.id, e.target.value)}
                              placeholder={amountPlaceholder}
                              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:text-xs"
                            />
                            {/* AMOUNT: 통화 단위 */}
                            {form.splitType === 'AMOUNT' && (
                              <span className="text-xs text-slate-400 w-8 text-center flex-shrink-0">
                                {form.currency}
                              </span>
                            )}
                            {/* WEIGHT: 계산된 금액 표시 */}
                            {form.splitType === 'WEIGHT' && totalAmount > 0 && (
                              <span className="text-[11px] text-indigo-500 font-semibold w-20 text-right flex-shrink-0 tabular-nums">
                                ≈ {fmtKRW(getWeightedAmount(m.id))}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* AMOUNT: 나머지 균등 안내 */}
                    {form.splitType === 'AMOUNT' && amountBlankCount > 0 && totalAmount > 0 && (
                      amountRemainder >= 0 ? (
                        <div className="mt-2 flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                          <span className="text-indigo-400 text-xs">÷</span>
                          <p className="text-[11px] text-indigo-600">
                            나머지{' '}
                            <span className="font-bold">
                              {fmtKRW(amountRemainder)}
                            </span>
                            {' '}÷ {amountBlankCount}명 ={' '}
                            <span className="font-bold">
                              {fmtKRW(amountRemainderPerPerson)}
                            </span>
                            /인 자동 배분
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-500 mt-1.5">
                          ⚠ 지정 금액 합계가 총 금액을 초과했습니다
                        </p>
                      )
                    )}

                    {/* AMOUNT: 모두 입력했는데 합계 불일치 */}
                    {amountMismatch && amountBlankCount === 0 && (
                      <p className="text-xs text-red-500 mt-1.5">
                        ⚠ 개별 금액 합계(
                        {(CURRENCY_SYMBOLS[form.currency] ?? '') +
                          amountSpecifiedSum.toLocaleString()}
                        )가 총 금액과 다릅니다
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 저장 / 취소 버튼 */}
              <div className="px-5 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
                <button
                  onClick={closeForm}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    !form.title.trim() ||
                    !parseFloat(form.amount) ||
                    !form.payerId ||
                    checkedCount === 0 ||
                    amountMismatch
                  }
                  className="flex-1 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                >
                  {editingId ? '수정 완료' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentPath={location.pathname}
      />
    </div>
  );
}
