import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'StackedScroll',
      fileName: 'stacked-scroll',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['gsap', 'gsap/ScrollTrigger'],
      output: {
        exports: 'default',
        globals: {
          gsap: 'gsap',
          'gsap/ScrollTrigger': 'ScrollTrigger'
        }
      }
    }
  }
});
