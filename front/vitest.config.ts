import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      projects: [
        {
          resolve: {
            alias: {
              '@': path.resolve(__dirname, './src'),
            },
          },
          test: {
            name: 'unit',
            environment: 'node',
            include: ['src/**/*.test.ts'],
          },
        },
        {
          resolve: {
            alias: {
              '@': path.resolve(__dirname, './src'),
            },
          },
          test: {
            name: 'components',
            environment: 'jsdom',
            include: ['src/**/*.test.tsx'],
            setupFiles: ['./src/test/setup.ts'],
          },
        },
      ],
      passWithNoTests: false,
    },
  }),
);
