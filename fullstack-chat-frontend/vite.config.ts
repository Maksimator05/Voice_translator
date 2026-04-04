import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/pages/LandingPage.tsx',
        'src/pages/ResourcesPage.tsx',
        'src/pages/AuthPage.tsx',
        'src/components/auth/ProtectedRoute.tsx',
        'src/hooks/useRBAC.ts',
        'src/store/authSlice.ts',
      ],
      exclude: ['src/test/**'],
      thresholds: {
        statements: 85,
        lines: 85,
        branches: 70,
        functions: 65,
      },
    },
  },
});
