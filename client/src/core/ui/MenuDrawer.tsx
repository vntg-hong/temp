import { X, Calculator, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}

const NAV_ITEMS = [
  {
    path: '/',
    label: '환율 계산기',
    icon: Calculator,
    description: '실시간 환율 변환',
  },
  {
    path: '/tip',
    label: '팁 계산기',
    icon: Percent,
    description: '나라별 팁 계산',
  },
];

export function MenuDrawer({ isOpen, onClose, currentPath }: MenuDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={[
          'fixed top-0 right-0 h-full w-64 z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Drawer header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700">메뉴</span>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon, description }) => {
            const isActive = currentPath === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={[
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    isActive ? 'bg-white/20' : 'bg-slate-100',
                  ].join(' ')}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-600'} />
                </div>
                <div>
                  <p className={['text-sm font-semibold', isActive ? 'text-white' : 'text-slate-800'].join(' ')}>
                    {label}
                  </p>
                  <p className={['text-xs', isActive ? 'text-white/70' : 'text-slate-400'].join(' ')}>
                    {description}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
