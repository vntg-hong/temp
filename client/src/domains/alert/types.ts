export type AlertCondition = 'below' | 'above';

export interface RateAlert {
  id: string;
  currencyCode: string;   // 'USD', 'JPY', etc.
  targetRate: number;     // KRW per 1 unit of currency
  refRate: number;        // KRW rate at the time of creation (for progress bar)
  condition: AlertCondition;
  repeat: boolean;        // false = 1회성, true = 조건 충족 시마다
  isActive: boolean;
  triggered: boolean;     // 1회성 알림에서 이미 발송된 경우
  createdAt: string;
}
