import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, Plus, Menu } from 'lucide-react';
import { MenuDrawer } from '../../../core/ui/MenuDrawer';
import { useAlertStore } from '../store';
import { useExchangeStore } from '../../exchange/store';
import { AlertCard } from '../components/AlertCard';
import { AlertSetupSheet } from '../components/AlertSetupSheet';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

function getKrwRate(code: string, rates: Record<string, number>): number | null {
  if (!rates['KRW'] || !rates[code]) return null;
  return rates['KRW'] / rates[code];
}

async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.requestPermissions();
}

export function AlertPage() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const { alerts, addAlert, removeAlert, toggleAlert } = useAlertStore();
  const rates = useExchangeStore((s) => s.rates);

  const handleSetupOpen = async () => {
    await requestNotificationPermission();
    setIsSetupOpen(true);
  };

  const handleSave = (data: Parameters<typeof addAlert>[0]) => {
    addAlert({ ...data, isActive: true, triggered: false });
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

          <h1 className="text-base font-semibold text-slate-900">환율 알림</h1>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors"
            aria-label="메뉴"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* ── 본문 ── */}
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full pb-24 text-center px-6">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Bell size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">설정된 알림이 없습니다</p>
              <p className="text-xs text-slate-300 mt-1">+ 버튼을 눌러 목표 환율을 설정해 보세요</p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  currentKrwRate={getKrwRate(alert.currencyCode, rates)}
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => removeAlert(alert.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── 새 알림 추가 FAB ── */}
        <div
          className="flex-shrink-0 px-4 pb-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <button
            onClick={handleSetupOpen}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl transition-all shadow-lg"
          >
            <Plus size={20} />
            <span className="text-sm font-bold">새 알림 추가</span>
          </button>
        </div>
      </div>

      {/* 메뉴 드로어 */}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentPath={location.pathname}
      />

      {/* 알림 설정 시트 */}
      <AlertSetupSheet
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onSave={handleSave}
        rates={rates}
      />
    </div>
  );
}
