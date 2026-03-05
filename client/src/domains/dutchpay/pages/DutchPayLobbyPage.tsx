import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, ExternalLink, Copy, Check, History, Loader2, Menu } from 'lucide-react';
import { MenuDrawer } from '../../../core/ui/MenuDrawer';
import { dutchpayApi } from '../api';

type VisitedGroup = { id: string; title: string; visitedAt: string };

export function DutchPayLobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <div className="min-h-screen bg-slate-200 flex justify-center">
      <div
        className="h-screen w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* ── 헤더 ── */}
        <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
          <Link
            to="/"
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="text-base font-semibold text-slate-900">여행/모임 정산</h1>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="메뉴"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* ── 스크롤 가능 본문 ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 space-y-5">

            {/* 새 방 만들기 */}
            <section>
              <button
                onClick={handleCreateNewRoom}
                disabled={isCreating}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl transition-all disabled:opacity-70"
              >
                <div className="flex items-center gap-3">
                  {isCreating ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Plus size={20} />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-bold">{isCreating ? '방 만드는 중...' : '새 정산 방 만들기'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">새로운 링크 생성 후 바로 시작</p>
                  </div>
                </div>
                <ExternalLink size={16} className="opacity-50" />
              </button>
              {createError && (
                <p className="mt-2 text-xs text-rose-500 text-center">방 생성 실패. 네트워크를 확인해 주세요.</p>
              )}
            </section>

            {/* 공유 ID로 참여 */}
            <section>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">공유 ID로 참여</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGoToRoom(roomIdInput)}
                  placeholder="방 ID 입력"
                  className="flex-1 min-w-0 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                />
                <button
                  onClick={() => handleGoToRoom(roomIdInput)}
                  disabled={!roomIdInput.trim()}
                  className="px-4 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all"
                >
                  입장
                </button>
              </div>
            </section>

            {/* 최근 정산 */}
            <section>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <History size={11} />
                최근 정산
              </p>

              {visitedGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-300">
                  <History size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">방문한 정산이 없습니다</p>
                  <p className="text-xs mt-1 text-slate-200">위에서 새 방을 만들거나 ID로 참여해 보세요</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {visitedGroups.map((room) => (
                    <li key={room.id}>
                      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
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
                          className="flex-shrink-0 flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-white active:scale-95 transition-all"
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
                          className="flex-shrink-0 p-2 rounded-xl hover:bg-white active:scale-95 transition-all"
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

          </div>
        </div>
      </div>

      {/* 메뉴 드로어 */}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentPath={location.pathname}
      />
    </div>
  );
}
