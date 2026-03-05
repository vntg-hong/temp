import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * 각 경로의 논리적 부모 경로를 반환. null이면 루트(앱 최소화)
 */
function getParentPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/exchange') return null;
  if (pathname === '/tip') return null;
  if (pathname === '/dutch-pay') return null;
  if (pathname.startsWith('/dutch-pay/')) return '/dutch-pay';
  if (pathname === '/alert') return null;
  return null;
}

/**
 * 안드로이드 하드웨어 뒤로가기 버튼 처리 훅.
 * - 논리적 부모가 있으면 부모 경로로 이동
 * - 루트 페이지에서는 앱 최소화 (종료 방지)
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener('backButton', () => {
      const parent = getParentPath(location.pathname);
      if (parent !== null) {
        navigate(parent);
      } else {
        App.minimizeApp();
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove());
    };
  }, [navigate, location.pathname]);
}
