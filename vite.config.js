import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'PagedScroll',
      fileName: 'paged-scroll',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['gsap', 'gsap/ScrollTrigger'],
      output: {
        globals: {
          gsap: 'gsap',
          'gsap/ScrollTrigger': 'ScrollTrigger'
        }
      }
    }
  }
});
