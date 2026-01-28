import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/node/lsp.ts', 'src/node/extension.ts'],
    outDir: 'dist/node',
    platform: 'node',
    sourcemap: true,
    clean: true,
    external: ['vscode'],
  },
  {
    entry: ['src/web/lsp.ts', 'src/web/extension.ts'],
    outDir: 'dist/web',
    platform: 'browser',
    sourcemap: true,
    clean: true,
    external: ['vscode'],
  },
])
