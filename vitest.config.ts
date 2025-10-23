import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // Alias cloudflare generator to local generator for tests
      // This allows tests to run without WASM dependencies
      '../../../prisma/generated/cloudflare/client': '../../../prisma/generated/local',
      '../../prisma/generated/cloudflare/client': '../../prisma/generated/local',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.config.{ts,js}',
        '**/routeTree.gen.ts',
      ],
    },
  },
})
