import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hong.currencycalc',
  appName: 'Currency Calc',
  webDir: 'dist',
  server: {
    // APK 빌드 시 실제 서버 URL로 변경 필요
    // 예: androidScheme: 'https', url: 'https://your-api-server.com'
    androidScheme: 'https',
    cleartext: true, // HTTP 허용 (개발 환경용, 운영 시 제거 권장)
  },
};

export default config;
