import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileDownload } from '../../../core/plugins/fileDownload';
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
  Share2,
  Lock,
  History,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { supabase } from '../../../core/supabase/client';
import { useDutchPayStore, genId } from '../store';
import { dutchpayApi } from '../api';
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
    title,
    setTitle,
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
  const navigate = useNavigate();
  const { uuid } = useParams<{ uuid?: string }>();

  // ── 공유/동기화/잠금 상태 ──────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockVerified, setLockVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  // 마지막으로 서버에서 받아온 데이터 스냅샷 (sync 중복 방지)
  const loadedSnapRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [visitedGroups, setVisitedGroups] = useState<Array<{ id: string; title: string; visitedAt: string }>>([]);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
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
          // Android 10+ : MediaStore.Downloads API (권한 불필요)
          // Android 9-  : 직접 파일 쓰기 (WRITE_EXTERNAL_STORAGE)
          // → 내 파일 > 내장 메모리 > Download > a 폴더에 저장
          await FileDownload.writeToDownloads({
            filename,
            data: json,
            subfolder: 'a',
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

  /* ── UUID 있을 때 서버에서 초기 데이터 로드 ── */
  useEffect(() => {
    if (!uuid) return;
    (async () => {
      try {
        setIsSyncing(true);
        const data = await dutchpayApi.getGroup(uuid);
        importData({
          title: data.title,
          members: data.members,
          expenses: data.expenses,
          initialBudget: data.budget,
          completedSettlements: data.completed_settlements,
        });
        setBudgetInput(data.budget ? String(data.budget) : '');
        setIsLocked(data.is_locked);
        // 방문 기록 저장 (최근 정산 대시보드용)
        const visited: Array<{ id: string; title: string; visitedAt: string }> = (() => {
          try {
            const raw = JSON.parse(localStorage.getItem('visited-groups') ?? '[]');
            // 구형 string[] 포맷 마이그레이션
            if (raw.length > 0 && typeof raw[0] === 'string') {
              return raw.map((id: string) => ({ id, title: '정산', visitedAt: new Date().toISOString() }));
            }
            return raw;
          } catch { return []; }
        })();
        const filtered = visited.filter((v) => v.id !== uuid);
        const updated = [{ id: uuid, title: data.title, visitedAt: new Date().toISOString() }, ...filtered].slice(0, 20);
        localStorage.setItem('visited-groups', JSON.stringify(updated));
        // 최초 로드 스냅샷 설정 (이후 sync가 바로 트리거되지 않도록)
        loadedSnapRef.current = JSON.stringify({
          title: data.title,
          members: data.members,
          expenses: data.expenses,
          initialBudget: data.budget,
          completedSettlements: data.completed_settlements,
        });
      } catch {
        setSyncError(true);
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Supabase 실시간 구독: 다른 사용자 변경 사항 즉시 반영 ── */
  useEffect(() => {
    if (!uuid) return;

    const channel = supabase
      .channel(`room:${uuid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settlement_groups', filter: `id=eq.${uuid}` },
        (payload) => {
          const remote = payload.new as {
            title: string;
            budget: number;
            members: unknown[];
            expenses: unknown[];
            completed_settlements: string[];
            is_locked: boolean;
          };
          const newSnap = JSON.stringify({
            title: remote.title,
            members: remote.members,
            expenses: remote.expenses,
            initialBudget: remote.budget,
            completedSettlements: remote.completed_settlements,
          });
          // 내가 보낸 변경이면 무시 (loadedSnapRef와 동일한 경우)
          if (newSnap === loadedSnapRef.current) return;

          isRemoteUpdateRef.current = true;
          importData({
            title: remote.title,
            members: remote.members as import('../types').Member[],
            expenses: remote.expenses as import('../types').Expense[],
            initialBudget: remote.budget,
            completedSettlements: remote.completed_settlements,
          });
          setIsLocked(remote.is_locked);
          loadedSnapRef.current = newSnap;
          isRemoteUpdateRef.current = false;
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 동기화 모드: 데이터 변경 시 서버에 PATCH (500ms debounce) ── */
  useEffect(() => {
    if (!uuid || loadedSnapRef.current === null) return;
    if (isRemoteUpdateRef.current) return; // 원격 업데이트 중이면 skip

    const currentSnap = JSON.stringify({ title, members, expenses, initialBudget, completedSettlements });
    if (currentSnap === loadedSnapRef.current) return; // 변경 없으면 skip

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        setIsSyncing(true);
        setSyncError(false);
        await dutchpayApi.updateGroup(uuid, {
          title,
          budget: initialBudget,
          members,
          expenses,
          completed_settlements: completedSettlements,
        });
        loadedSnapRef.current = currentSnap;
      } catch {
        setSyncError(true);
      } finally {
        setIsSyncing(false);
      }
    }, 500);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [uuid, title, members, expenses, initialBudget, completedSettlements]);

  /* ── title 변경 시 visited-groups localStorage & visitedGroups 상태 즉시 갱신 ── */
  useEffect(() => {
    if (!uuid || !title) return;
    try {
      const raw: Array<{ id: string; title: string; visitedAt: string }> = JSON.parse(
        localStorage.getItem('visited-groups') ?? '[]',
      );
      const updated = raw.map((v) => (v.id === uuid ? { ...v, title } : v));
      localStorage.setItem('visited-groups', JSON.stringify(updated));
      setVisitedGroups((prev) => prev.map((v) => (v.id === uuid ? { ...v, title } : v)));
    } catch { /* ignore */ }
  }, [uuid, title]);

  /* ── 공유 URL 생성 or 복사 ── */
  const handleShare = async () => {
    if (uuid) {
      await navigator.clipboard.writeText(`${window.location.origin}/dutch-pay/${uuid}`);
      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 2000);
      return;
    }
    setIsCreatingShare(true);
    try {
      const data = await dutchpayApi.createGroup({
        title: '정산',
        budget: initialBudget,
        members,
        expenses,
        completed_settlements: completedSettlements,
      });
      navigate(`/dutch-pay/${data.id}`);
    } catch {
      setSyncError(true);
    } finally {
      setIsCreatingShare(false);
    }
  };

  /* ── 새 방 만들기 (빈 방 생성 후 이동) ── */
  const [isCreatingNewRoom, setIsCreatingNewRoom] = useState(false);
  const handleCreateNewRoom = async () => {
    setIsCreatingNewRoom(true);
    try {
      const data = await dutchpayApi.createGroup({ title: '새 정산', budget: 0, members: [], expenses: [], completed_settlements: [] });
      setIsRoomListOpen(false);
      navigate(`/dutch-pay/${data.id}`);
    } catch {
      setSyncError(true);
    } finally {
      setIsCreatingNewRoom(false);
    }
  };

  /* ── 방 목록 열기 — localStorage에서 최신 데이터 로드 ── */
  const openRoomList = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('visited-groups') ?? '[]');
      if (raw.length > 0 && typeof raw[0] === 'string') {
        setVisitedGroups(raw.map((id: string) => ({ id, title: '정산', visitedAt: '' })));
      } else {
        setVisitedGroups(raw);
      }
    } catch {
      setVisitedGroups([]);
    }
    setIsRoomListOpen(true);
  };

  /* ── 방 ID로 이동 ── */
  const handleGoToRoom = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setIsRoomListOpen(false);
    setRoomIdInput('');
    navigate(`/dutch-pay/${trimmed}`);
  };

  /* ── 잠금 비밀번호 검증 ── */
  const handleVerifyPassword = async () => {
    if (!uuid || !passwordInput.trim()) return;
    setIsVerifying(true);
    setPasswordError(false);
    const ok = await dutchpayApi.verifyPassword(uuid, passwordInput);
    setIsVerifying(false);
    if (ok) {
      setLockVerified(true);
    } else {
      setPasswordError(true);
    }
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
        className="relative h-screen w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* ────────── 잠금 화면 ────────── */}
        {uuid && isLocked && !lockVerified && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-8">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
              <Lock size={28} className="text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">비밀번호로 잠긴 정산</h2>
            <p className="text-sm text-slate-400 mb-7 text-center">
              비밀번호를 입력하면 접근할 수 있어요
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl mb-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {passwordError && (
              <p className="text-xs text-rose-500 mb-3">비밀번호가 올바르지 않습니다</p>
            )}
            <button
              onClick={handleVerifyPassword}
              disabled={isVerifying || !passwordInput.trim()}
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isVerifying && <Loader2 size={16} className="animate-spin" />}
              확인
            </button>
          </div>
        )}
        {/* ────────── 헤더 ────────── */}
        <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
          {/* 좌측: 뒤로가기 + URL 복사/공유 */}
          <div className="flex items-center gap-0.5 -ml-2">
            <Link
              to="/"
              className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
              aria-label="뒤로가기"
            >
              <ArrowLeft size={20} />
            </Link>
            <button
              onClick={handleShare}
              disabled={isCreatingShare}
              className="p-2 text-indigo-500 hover:text-indigo-700 active:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
              aria-label="공유"
              title={uuid ? 'URL 복사' : '공유 URL 만들기'}
            >
              {isCreatingShare ? (
                <Loader2 size={18} className="animate-spin" />
              ) : shareUrlCopied ? (
                <Check size={18} className="text-emerald-500" />
              ) : (
                <Share2 size={18} />
              )}
            </button>
          </div>

          {/* 중앙: 제목 (편집 가능) + 동기화 인디케이터 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isEditingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const next = titleDraft.trim() || title;
                  setTitle(next);
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const next = titleDraft.trim() || title;
                    setTitle(next);
                    setIsEditingTitle(false);
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                maxLength={30}
                className="text-base font-semibold text-slate-900 bg-transparent border-b-2 border-indigo-400 outline-none text-center w-36 truncate"
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(title); setIsEditingTitle(true); }}
                className="text-base font-semibold text-slate-900 hover:text-indigo-600 transition-colors truncate max-w-[140px]"
                title="방 이름 변경"
              >
                {title || '여행/모임 정산'}
              </button>
            )}
            {uuid && (
              isSyncing ? (
                <Loader2 size={11} className="animate-spin text-indigo-400 flex-shrink-0" />
              ) : syncError ? (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block flex-shrink-0" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
              )
            )}
          </div>

          {/* 우측: 방 목록 + 초기화 + 메뉴 */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={openRoomList}
              className="p-2 text-slate-500 hover:text-slate-800 active:bg-slate-100 rounded-lg transition-colors"
              aria-label="방 목록"
              title="방 목록 / ID로 입력"
            >
              <History size={18} />
            </button>
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

      {/* ────────── 방 목록 & ID 입력 바텀 시트 ────────── */}
      {isRoomListOpen && (
        <>
          {/* 백드롭 */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setIsRoomListOpen(false)}
          />
          {/* 시트 */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}>
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-900">방 목록</h2>
              <button
                onClick={() => setIsRoomListOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-8">
              {/* ── 새 방 만들기 ── */}
              <button
                onClick={handleCreateNewRoom}
                disabled={isCreatingNewRoom}
                className="w-full flex items-center justify-center gap-2 py-3.5 mb-5 bg-indigo-600 text-white font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {isCreatingNewRoom ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <PlusCircle size={18} />
                )}
                새 방 만들기
              </button>

              {/* ── 방 ID 직접 입력 ── */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">방 ID로 바로가기</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGoToRoom(roomIdInput)}
                    placeholder="방 ID 입력"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                  />
                  <button
                    onClick={() => handleGoToRoom(roomIdInput)}
                    disabled={!roomIdInput.trim()}
                    className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink size={15} />
                    이동
                  </button>
                </div>
              </div>

              {/* ── 최근 방 목록 ── */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">최근 방</p>
                {visitedGroups.length === 0 ? (
                  <div className="py-8 text-center text-slate-300 text-sm">
                    방문한 방이 없습니다
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
                    {visitedGroups.map((room) => (
                      <li key={room.id}>
                        <div className={[
                          'flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all',
                          room.id === uuid
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-slate-50 border-slate-100',
                        ].join(' ')}>
                          {/* 방 정보 + 이동 */}
                          <button
                            onClick={() => handleGoToRoom(room.id)}
                            className="flex-1 min-w-0 text-left active:scale-[0.98] transition-all"
                          >
                            <p className={['text-sm font-semibold truncate', room.id === uuid ? 'text-indigo-700' : 'text-slate-800'].join(' ')}>
                              {room.title || '정산'}
                              {room.id === uuid && (
                                <span className="ml-2 text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full">현재</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                              {room.id}
                            </p>
                            {room.visitedAt && (
                              <p className="text-[10px] text-slate-300 mt-0.5">
                                {new Date(room.visitedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </button>

                          {/* ID 복사 버튼 */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await navigator.clipboard.writeText(room.id);
                              setCopiedRoomId(room.id);
                              setTimeout(() => setCopiedRoomId(null), 2000);
                            }}
                            className="flex-shrink-0 flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-white active:scale-95 transition-all"
                            title="방 ID 복사"
                          >
                            {copiedRoomId === room.id ? (
                              <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-[9px] text-emerald-500 font-semibold whitespace-nowrap">복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} className="text-slate-300" />
                                <span className="text-[9px] text-slate-300 font-medium">ID복사</span>
                              </>
                            )}
                          </button>

                          {/* 이동 아이콘 */}
                          <button
                            onClick={() => handleGoToRoom(room.id)}
                            className="flex-shrink-0 p-2 rounded-xl hover:bg-white active:scale-95 transition-all"
                            title="방으로 이동"
                          >
                            <ExternalLink size={14} className={room.id === uuid ? 'text-indigo-400' : 'text-slate-300'} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
