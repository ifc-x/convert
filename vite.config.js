import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.js',
      name: 'convert',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'index.js';
        if (format === 'cjs') return 'index.cjs';
        if (format === 'umd') return 'index.umd.js';
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks: () => '@ifc-x/convert',
        assetFileNames: (assetInfo) => 'assets/[name][extname]',
      },
    },
  },
});