import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: './src/index.node.js',
      formats: ['cjs', 'es'],
      fileName: (format) =>
        format === 'cjs' ? 'index.node.cjs' : 'index.node.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks: (id) => 'one chunk',
      },
    },
    ssr: true
  },
});
