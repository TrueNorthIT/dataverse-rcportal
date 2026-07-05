/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 is wired in as a Vite plugin — no separate postcss/tailwind.config file.
  plugins: [react(), tailwindcss()],
  test: {
    // Component tests need a DOM; jsdom gives us one in Node.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // env.ts fails fast if these are unset — provide test values so importing
    // any module that reads config doesn't throw at load time.
    env: {
      VITE_ENTRA_TENANT_ID: 'test-tenant',
      VITE_ENTRA_CLIENT_ID: 'test-client',
      VITE_ENTRA_API_SCOPE: 'api://test/access_as_user',
      VITE_API_BASE_URL: 'https://api.test.local/api/v2/rcportal',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Only source that runs; exclude type-only files, generated code, the
      // browser/MSAL bootstrap (needs a real DOM root), and the test kit itself.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**', // provisional/generated record shapes — types only
        'src/test/**', // the test harness itself
        'src/main.tsx', // MSAL + createRoot bootstrap — wiring, not logic
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
