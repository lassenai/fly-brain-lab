import {defineConfig} from 'vite';
export default defineConfig({base:'./', build:{chunkSizeWarningLimit:1500,rollupOptions:{input:{compare:'compare.html'}}}});
