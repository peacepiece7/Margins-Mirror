import path from 'node:path';
import { defineConfig } from 'vite';

// Storybook never inherits the app's backend proxy or environment credentials.
export default defineConfig({
  optimizeDeps: { include: ['react/jsx-runtime', 'react/jsx-dev-runtime'] },
  envDir: path.resolve(import.meta.dirname, 'env'),
  envPrefix: 'STORYBOOK_',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src') } },
  define: {
    'import.meta.env.VITE_MARGINS_TURNSTILE_SITE_KEY': JSON.stringify('storybook-fixture'),
  },
});
