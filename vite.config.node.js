import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: './src/env/node.js',
    },
    rollupOptions: {
      output: [
        {
          format: 'cjs',
          entryFileNames: 'index.node.cjs',
          compact: true,
        },
        {
          format: 'es',
          entryFileNames: 'index.node.js',
          compact: true,
        },
      ],
    },
    ssr: true
  },
});
