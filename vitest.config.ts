import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Setting `exclude` replaces Vitest's defaults rather than merging with
    // them, so start from configDefaults.exclude (which already excludes
    // node_modules anywhere in the tree) and add e2e/ on top.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
