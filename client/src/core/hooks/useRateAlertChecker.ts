import { useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useExchangeStore } from '../../domains/exchange/store';
import { useAlertStore } from '../../domains/alert/store';
import { CURRENCY_MAP } from '../../domains/exchange/constants';

let notificationId = 1000;

function getKrwRate(code: string, rates: Record<string, number>): number | null {
  if (!rates['KRW'] || !rates[code]) return null;
  return rates['KRW'] / rates[code];
}

function fmtRate(rate: number): string {
  return rate.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

async function ensureNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: 'rate-alert',
    name: '환율 알림',
    description: '목표 환율 도달 시 알림',
    importance: 4, // HIGH
    vibration: true,
    sound: 'default',
  });
}

async function sendNotification(currencyCode: string, targetRate: number, currentRate: number, condition: 'below' | 'above') {
  if (!Capacitor.isNativePlatform()) {
    console.log(`[RateAlert] ${currencyCode} 목표 달성! 현재: ${currentRate}, 목표: ${targetRate}`);
    return;
  }

  const currency = CURRENCY_MAP.get(currencyCode);
  const nameKo = currency?.nameKo ?? currencyCode;
  const conditionText = condition === 'below' ? '아래로 내려갔습니다' : '위로 올라갔습니다';

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId++,
        channelId: 'rate-alert',
        title: '[환율 기회 🔔] 지금이 타이밍입니다!',
        body: `${nameKo}(${currencyCode})가 설정하신 목표가 ${fmtRate(targetRate)}원 ${conditionText}. (현재: ${fmtRate(currentRate)}원)`,
        schedule: { at: new Date(Date.now() + 100) },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#1e293b',
      },
    ],
  });
}

/**
 * 환율이 업데이트될 때마다 활성 알림들의 조건을 확인하고
 * 목표 달성 시 푸시 알림을 발송하는 훅.
 * AppRoutes에서 호출하여 앱 전역에서 동작.
 */
export function useRateAlertChecker() {
  const rates = useExchangeStore((s) => s.rates);
  const ratesDate = useExchangeStore((s) => s.ratesDate);
  const { alerts, markTriggered } = useAlertStore();

  const channelCreated = useRef(false);
  const prevRatesDate = useRef<string | null>(null);

  /* 채널 최초 1회 생성 */
  useEffect(() => {
    if (!channelCreated.current) {
      channelCreated.current = true;
      ensureNotificationChannel().catch(console.error);
    }
  }, []);

  /* ratesDate가 변경될 때(= 환율 업데이트 시)만 알림 체크 */
  useEffect(() => {
    if (!ratesDate || ratesDate === prevRatesDate.current) return;
    if (Object.keys(rates).length === 0) return;

    prevRatesDate.current = ratesDate;

    const activeAlerts = alerts.filter((a) => {
      if (!a.isActive) return false;
      if (a.triggered && !a.repeat) return false; // 1회성이고 이미 발송
      return true;
    });

    activeAlerts.forEach(async (alert) => {
      const currentRate = getKrwRate(alert.currencyCode, rates);
      if (currentRate === null) return;

      const triggered =
        (alert.condition === 'below' && currentRate <= alert.targetRate) ||
        (alert.condition === 'above' && currentRate >= alert.targetRate);

      if (triggered) {
        await sendNotification(alert.currencyCode, alert.targetRate, currentRate, alert.condition);
        if (!alert.repeat) {
          markTriggered(alert.id);
        }
      }
    });
  }, [ratesDate]); // eslint-disable-line react-hooks/exhaustive-deps
}
