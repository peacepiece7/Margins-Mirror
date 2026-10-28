import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const backendTarget = env.MARGINS_BACKEND_URL || 'http://localhost:5813';
  const frontendPort = Number(env.MARGINS_FRONTEND_PORT || '9613');

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      {
        name: 'margins-production-design-system-boundary',
        apply: 'build',
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type !== 'chunk') continue;
            for (const id of Object.keys(output.modules)) {
              if (
                /\.stories\.[jt]sx?$|\.mdx$|[\\/]node_modules[\\/](?:@storybook|storybook)[\\/]|[\\/]src[\\/]testing[\\/]storybook|[\\/]src[\\/]app[\\/]design-system/.test(
                  id,
                )
              ) {
                this.error('Production artifact imports design-system-only module: ' + id);
              }
            }
          }
        },
      },
    ],
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    server: {
      watch: { ignored: ['**/storybook-static/**'] },
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
