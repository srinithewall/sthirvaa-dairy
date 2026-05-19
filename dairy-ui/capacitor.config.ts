import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sthirvaa.dairy',
  appName: 'Sthirvaa Farms',
  webDir: 'out',
  server: {
    url: 'https://farm.sthirvaa.com',
    cleartext: true
  }
};

export default config;
