import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_ENV_'],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      // Prefer workspace package.json "exports" for @agapi/*
      dedupe: ['@agapi/stdlib', '@agapi/host-tauri', '@agapi/host-protocol'],
    },
    server: {
      allowedHosts: true,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ["**/src-tauri/**"],
      },
    },
    build: {
      // matter.js ships native class private fields (#field) and relies on
      // a "constructor returns a different object" trick (Callable, in
      // @matter/general/util/Function.ts) to make class instances directly
      // invocable. esbuild's default (pre-ES2022) target downlevel-compiles
      // private fields to a WeakMap-based __privateGet/__privateSet
      // emulation that doesn't correctly rebind `this` after such a
      // constructor substitution — instances end up not actually callable
      // ("X.call is not a function"), even though every real Tauri webview
      // target (WebKitGTK/WebView2/WKWebView) supports native private
      // fields directly. esnext skips that transform entirely.
      target: 'esnext',
      rollupOptions: {
        input: {
          main: 'index.html',
        },
      },
    },
    // Allow importing .ts sources from workspace packages
    optimizeDeps: {
      exclude: ['@agapi/stdlib', '@agapi/host-tauri', '@agapi/host-protocol'],
      esbuildOptions: {
        // Same reasoning as build.target above — this is the target actually
        // used when esbuild pre-bundles node_modules deps like matter.js for
        // the dev server.
        target: 'esnext',
      },
    },
  };
});
