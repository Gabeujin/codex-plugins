import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    // Keep prior ignored build artifacts recoverable during local verification.
    emptyOutDir: false,
  },
  server: {
    strictPort: true,
  },
  test: {
    environment: 'node',
    exclude: ['tests/browser/**'],
    coverage: { reporter: ['text', 'json-summary'] },
  },
});
