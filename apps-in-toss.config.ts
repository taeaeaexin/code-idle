import { defineConfig } from '@apps-in-toss/web-framework/config';

// 토스 미니앱(앱인토스) 설정. appName은 콘솔에 등록한 이름과 같아야 함
export default defineConfig({
  appName: 'dev-idle',
  permissions: [{ name: 'clipboard', access: 'write' }],
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
  },
  webBundleDir: 'dist',
});
