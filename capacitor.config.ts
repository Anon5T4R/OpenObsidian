import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.openobsidian.app',
  appName: 'OpenObsidian',
  webDir: 'www',
  server: {
    // Use https scheme so cookies/storage work properly on Android
    androidScheme: 'https',
  },
  android: {
    // Allow cleartext (needed for local file URIs shared via Share plugin)
    allowMixedContent: true,
  },
  plugins: {
    Filesystem: {
      // Request permissions at runtime; no additional config needed
    },
  },
}

export default config
