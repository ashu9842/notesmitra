import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Exclude pdfjs-dist so Vite doesn't pre-bundle it — the worker ?url import
    // needs the original module structure to avoid version-mismatch errors.
    exclude: ['pdfjs-dist'],
  },
  // ── Production build hardening ─────────────────────────────────────────────
  build: {
    sourcemap: false,
    minify: 'esbuild',
    // Warn when a single chunk exceeds 600 kB (default 500)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
        manualChunks(id) {
          // React core — loaded first, small and critical
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // PDF viewer — huge, only needed when a purchased note is opened
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdf';
          }
          // Firebase — large SDK, needed only after login/auth actions
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          // MUI — large, only used inside admin/seller panels
          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
            return 'vendor-mui';
          }
          // Recharts — only used in analytics sections
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // Radix UI primitives
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Socket.io — real-time, only after login
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'vendor-socket';
          }
        },
      },
    },
  },
  // Strip console.* calls and debugger statements from the production bundle
  esbuild: {
    drop: ['console', 'debugger'],
    // Mangle all exported identifiers in the final bundle
    legalComments: 'none',
  },
})
