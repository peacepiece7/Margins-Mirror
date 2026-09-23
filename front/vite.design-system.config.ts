import path from 'node:path';
import { mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(base, {
  build: {
    outDir: 'dist-design-system',
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'index.html'),
        gallery: path.resolve(__dirname, 'design-system.html'),
      },
    },
  },
});
