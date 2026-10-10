import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jimelyo.shoplogic',
  appName: 'ShopLogic Pro',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f1f5f9',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
