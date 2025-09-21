import { defineConfig } from 'vite';
import { terser } from 'rollup-plugin-terser';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: './src/env/browser.js',
      fileName: (format) =>
        format === 'es' ? 'index.browser.js' : 'index.umd.js',
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
          inlineDynamicImports: false,
          manualChunks: (id) => 'one chunk',
          plugins: [terser()],
        },
        {
          format: 'umd',
          name: 'IFCxConvert',
          inlineDynamicImports: false,
          manualChunks: (id) => 'one chunk',
          footer: 'window.IFCx ||= {}; window.IFCx.convert = IFCxConvert.convert;',
          plugins: [terser()],
        },
      ],
    },
    minify: false,
  },
});
