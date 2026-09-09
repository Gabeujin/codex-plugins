import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
  server: {
    strictPort: true,
  },
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'json-summary'] },
  },
});
