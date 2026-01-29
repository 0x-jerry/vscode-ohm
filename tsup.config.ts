import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/node/lsp.ts', 'src/node/extension.ts'],
    outDir: 'dist/node',
    platform: 'node',
    clean: true,
    external: ['vscode'],
  },
  {
    entry: ['src/web/lsp.ts', 'src/web/extension.ts'],
    outDir: 'dist/web',
    platform: 'browser',
    clean: true,
    external: ['vscode'],
  },
])
