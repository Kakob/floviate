import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig uses jsx: preserve for Next; tests need JSX compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './__tests__/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
