import { defineConfig } from 'vite';
import { terser } from 'rollup-plugin-terser';

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
          plugins: [terser()],
        },
        {
          format: 'es',
          entryFileNames: 'index.node.js',
          compact: true,
          plugins: [terser()],
        },
      ],
    },
    minify: false,
    ssr: true
  },
});
