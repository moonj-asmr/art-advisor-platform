import type { CapacitorConfig } from '@capacitor/cli';

// The native iOS shell. The React frontend is bundled into the app at CI
// build time (with VITE_API_URL baked in, pointing at the Railway backend),
// so Railway and the web version continue exactly as they are.
const config: CapacitorConfig = {
  appId: 'com.advisorydeck.app',
  appName: 'AdvisoryDeck',
  webDir: 'dist',
  ios: {
    // The web app handles safe areas itself (env(safe-area-inset-*) CSS with
    // viewport-fit=cover). 'automatic' would make iOS add its own insets on
    // top, shoving the bottom nav into the home-indicator zone where taps
    // trigger the home gesture instead of the buttons.
    contentInset: 'never',
  },
};

export default config;
