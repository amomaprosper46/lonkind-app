import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lonkind.app',
  appName: 'Lonkind',
  webDir: 'out',
  server: {
    url: 'https://impactful-ideas.web.app',
    cleartext: true
  }
};

export default config;
