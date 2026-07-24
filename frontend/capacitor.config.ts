import type { CapacitorConfig } from '@capacitor/cli';

// The native iOS shell. The React frontend is bundled into the app at CI
// build time (with VITE_API_URL baked in, pointing at the Railway backend),
// so Railway and the web version continue exactly as they are.
const config: CapacitorConfig = {
  appId: 'com.advisorydeck.app',
  appName: 'AdvisoryDeck',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
