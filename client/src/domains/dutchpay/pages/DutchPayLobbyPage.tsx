import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ExternalLink, Copy, Check, ArrowRight, History, Loader2 } from 'lucide-react';
import { dutchpayApi } from '../api';

type VisitedGroup = { id: string; title: string; visitedAt: string };

export function DutchPayLobbyPage() {
  const navigate = useNavigate();
  const [visitedGroups, setVisitedGroups] = useState<VisitedGroup[]>([]);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(false);

  /* ── localStorage에서 방문 그룹 로드 ── */
  useEffect(() => {
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
  }, []);

  /* ── 방 ID로 이동 ── */
  const handleGoToRoom = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setRoomIdInput('');
    navigate(`/dutch-pay/${trimmed}`);
  };

  /* ── 새 방 만들기 ── */
  const handleCreateNewRoom = async () => {
    setIsCreating(true);
    setCreateError(false);
    try {
      const data = await dutchpayApi.createGroup({
        title: '새 정산',
        budget: 0,
        members: [],
        expenses: [],
        completed_settlements: [],
      });
      navigate(`/dutch-pay/${data.id}`);
    } catch {
      setCreateError(true);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
            <History size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">정산하기</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* ── 새 방 만들기 ── */}
        <section>
          <button
            onClick={handleCreateNewRoom}
            disabled={isCreating}
            className="w-full flex items-center justify-between px-5 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl shadow-md shadow-indigo-200 transition-all disabled:opacity-70"
          >
            <div className="flex items-center gap-3">
              {isCreating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Plus size={20} />
              )}
              <div className="text-left">
                <p className="text-sm font-bold">{isCreating ? '방 만드는 중...' : '새 정산 방 만들기'}</p>
                <p className="text-xs text-indigo-200 mt-0.5">새로운 링크 생성 후 바로 시작</p>
              </div>
            </div>
            <ArrowRight size={18} className="opacity-70" />
          </button>
          {createError && (
            <p className="mt-2 text-xs text-rose-500 text-center">방 생성 실패. 네트워크를 확인해 주세요.</p>
          )}
        </section>

        {/* ── 공유 ID 입력 ── */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">공유 ID로 참여</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoToRoom(roomIdInput)}
              placeholder="방 ID 입력 (예: abc123...)"
              className="flex-1 min-w-0 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 shadow-sm"
            />
            <button
              onClick={() => handleGoToRoom(roomIdInput)}
              disabled={!roomIdInput.trim()}
              className="px-4 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <ExternalLink size={15} />
              입장
            </button>
          </div>
        </section>

        {/* ── 방문 기록 ── */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            <span className="inline-flex items-center gap-1"><History size={11} /> 최근 정산</span>
          </p>

          {visitedGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-300">
              <History size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">방문한 정산이 없습니다</p>
              <p className="text-xs mt-1">위에서 새 방을 만들거나 ID로 참여해 보세요</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visitedGroups.map((room) => (
                <li key={room.id}>
                  <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    {/* 방 정보 + 이동 */}
                    <button
                      onClick={() => handleGoToRoom(room.id)}
                      className="flex-1 min-w-0 text-left active:scale-[0.98] transition-all"
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">{room.title || '정산'}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{room.id}</p>
                      {room.visitedAt && (
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          {new Date(room.visitedAt).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </button>

                    {/* ID 복사 */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await navigator.clipboard.writeText(room.id);
                        setCopiedRoomId(room.id);
                        setTimeout(() => setCopiedRoomId(null), 2000);
                      }}
                      className="flex-shrink-0 flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                      title="방 ID 복사"
                    >
                      {copiedRoomId === room.id ? (
                        <>
                          <Check size={14} className="text-emerald-500" />
                          <span className="text-[9px] text-emerald-500 font-semibold">복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} className="text-slate-300" />
                          <span className="text-[9px] text-slate-300 font-medium">ID복사</span>
                        </>
                      )}
                    </button>

                    {/* 이동 */}
                    <button
                      onClick={() => handleGoToRoom(room.id)}
                      className="flex-shrink-0 p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                      title="방으로 이동"
                    >
                      <ExternalLink size={14} className="text-slate-300" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
